"""Phase 13-A tests. Everything here runs WITHOUT CIC-IDS2017 and without a
trained model. Tests that require either are Phase 13-B and are absent, not
stubbed to pass."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import numpy as np, pandas as pd
from ml.features.schema import (FEATURE_ORDER, FEATURE_COUNT, RAW_FEATURE_NAMES, TRAINABLE_CLASSES, LEAKAGE_COLUMNS,
    ENGINEERED_FEATURE_NAMES, SchemaError, normalise_label, resolve_schema, is_resolved, RAW_FEATURES)
from ml.features.engineer import FeatureError, build_feature_vector, compute_engineered, assert_feature_order
from ml.preprocess import prepare, drop_header_rows, drop_invalid_duration, PreprocessReport
from ml.service.schemas import ValidationError, normalise_anomaly, prediction, unavailable_response, validate_score_request

P=[0]; F=[0]
def ck(name, cond, detail=""):
    if cond: P[0]+=1; print(f"  PASS  {name}")
    else: F[0]+=1; print(f"  FAIL  {name}{' -> '+detail if detail else ''}")

def raw_row(**over):
    base = dict(flow_duration=500000, fwd_packets=10, bwd_packets=4, fwd_bytes=800, bwd_bytes=400,
        flow_bytes_per_s=1600.0, flow_packets_per_s=28.0, flow_iat_mean=50000.0, flow_iat_std=1200.0,
        fwd_iat_mean=48000.0, syn_flag_count=3, ack_flag_count=9, rst_flag_count=0, psh_flag_count=2,
        pkt_len_mean=85.7, pkt_len_std=30.2, down_up_ratio=1, init_win_fwd=8192)
    base.update(over); return base

print("SCHEMA")
ck("22 features total", FEATURE_COUNT == 22, str(FEATURE_COUNT))
ck("18 raw + 4 engineered", len(RAW_FEATURE_NAMES)==18 and len(ENGINEERED_FEATURE_NAMES)==4)
ck("FEATURE_ORDER has no duplicates", len(set(FEATURE_ORDER))==22)
ck("engineered come last", tuple(FEATURE_ORDER[-4:])==ENGINEERED_FEATURE_NAMES)
ck("schema RESOLVED against real CSE-CIC-IDS2018 headers", is_resolved() is True)
ck("every raw feature has candidates", all(len(f.candidates)>0 for f in RAW_FEATURES))
ck("every raw feature has a verified source column", all(f.source_column is not None for f in RAW_FEATURES))
ck("every source column is among its own candidates", all(f.source_column in f.candidates for f in RAW_FEATURES))
ck("candidates retain 2017 spellings for cross-dataset use",
   any(len(f.candidates) > 1 for f in RAW_FEATURES))

print("\nSCHEMA RESOLUTION")
cols = [f.candidates[0] for f in RAW_FEATURES]
ck("resolves when all columns present", len(resolve_schema(cols))==18)
try: resolve_schema(cols[:-1]); ck("missing column raises", False)
except SchemaError as e: ck("missing column raises", "Unresolved" in str(e))
ck("tolerates whitespace-padded columns", len(resolve_schema([f"  {c} " for c in cols]))==18)

print("\nLABEL MAPPING")
for src, want in [("BENIGN","BENIGN"),("FTP-Patator","BRUTE_FORCE"),("SSH-Patator","BRUTE_FORCE"),
    ("PortScan","PORT_SCAN"),("DoS Hulk","DOS"),("DoS GoldenEye","DOS"),("DDoS","DDOS"),("Bot","BOTNET"),
    ("Web Attack – XSS","WEB_ATTACK"),("Web Attack - Brute Force","WEB_ATTACK")]:
    ck(f"{src} -> {want}", normalise_label(src)==want, str(normalise_label(src)))
for src_lab, want in [("Benign","BENIGN"),("Brute Force -Web","WEB_ATTACK"),
                      ("Brute Force -XSS","WEB_ATTACK"),("SQL Injection","WEB_ATTACK")]:
    ck(f"2018: {src_lab} -> {want}", normalise_label(src_lab)==want, str(normalise_label(src_lab)))
ck("Heartbleed excluded", normalise_label("Heartbleed") is None)
ck("Infiltration excluded", normalise_label("Infiltration") is None)
try: normalise_label("Totally New Attack"); ck("unknown label raises", False)
except SchemaError: ck("unknown label raises (not silently dropped)", True)

print("\nENGINEERED FEATURES")
e = compute_engineered(raw_row())
ck("syn_to_ack_ratio = 3/(9+1)", math.isclose(e["syn_to_ack_ratio"], 0.3))
ck("bytes_per_packet_fwd = 800/11", math.isclose(e["bytes_per_packet_fwd"], 800/11))
ck("pkt_rate_asymmetry = 6/15", math.isclose(e["pkt_rate_asymmetry"], 6/15))
ck("is_short_flow 1 below 1s", e["is_short_flow"]==1.0)
ck("is_short_flow 0 at 1s boundary", compute_engineered(raw_row(flow_duration=1_000_000))["is_short_flow"]==0.0)
ck("deterministic across calls", compute_engineered(raw_row())==e)
ck("zero denominators safe", compute_engineered(raw_row(ack_flag_count=0,fwd_packets=0,bwd_packets=0)) is not None)

print("\nFEATURE VECTOR")
v = build_feature_vector(raw_row())
ck("length 22", len(v)==22, str(len(v)))
ck("ordering follows FEATURE_ORDER", v[0]==500000 and v[-1]==1.0)
ck("identical input -> identical vector", build_feature_vector(raw_row())==v)
for bad, label in [(float("nan"),"NaN"),(float("inf"),"Inf"),("abc","non-numeric")]:
    try: build_feature_vector(raw_row(pkt_len_mean=bad)); ck(f"{label} rejected", False)
    except FeatureError: ck(f"{label} rejected", True)
try: build_feature_vector({k:v for k,v in raw_row().items() if k!="fwd_bytes"}); ck("missing feature rejected", False)
except FeatureError: ck("missing feature rejected", True)
try: assert_feature_order(list(FEATURE_ORDER[::-1])); ck("feature-order mismatch rejected", False)
except SchemaError: ck("feature-order mismatch rejected", True)
ck("correct order accepted", assert_feature_order(list(FEATURE_ORDER)) is None)

print("\nPREPROCESSING (synthetic frames — real dataset is Phase 13-B)")
# Built from RESOLVED source columns so the fixture tracks the schema.
SRC = {f.name: f.source_column for f in RAW_FEATURES}
# 7 rows: 1 duplicate pair, 1 excluded label, 1 Inf, 1 NaN, and TWO attack
# rows that must SURVIVE cleaning — the earlier fixture put the bad values on
# the attack rows, so nothing proved a non-benign class survives.
src = {col: [1,1,2,3,4,5,6] for col in SRC.values()}
src[SRC["flow_duration"]]=[500000,500000,2000000,100,700000,300000,250000]
src[SRC["flow_bytes_per_s"]]=[10.0,10.0,20.0,30.0,40.0,np.inf,np.nan]
src["Label"]=["Benign","Benign","Brute Force -Web","Heartbleed","SQL Injection","Benign","Benign"]
src["Timestamp"]=["22/02/2018 09:00:00"]*7
src["Dst Port"]=[80]*7
out, rep = prepare(pd.DataFrame(src))
ck("duplicates removed", rep.duplicates_removed==1, str(rep.duplicates_removed))
ck("Inf row dropped", rep.inf_rows_dropped==1, str(rep.inf_rows_dropped))
ck("NaN row dropped", rep.nan_rows_dropped==1, str(rep.nan_rows_dropped))
ck("excluded label counted", rep.labels_excluded=={"Heartbleed":1}, str(rep.labels_excluded))
ck("leakage columns dropped", "Dst Port" in rep.leakage_columns_dropped and "Timestamp" in rep.leakage_columns_dropped)
ck("output columns = 22 features + label", list(out.columns)==list(FEATURE_ORDER)+["label"])
ck("class distribution measured", rep.class_distribution=={"BENIGN":1,"WEB_ATTACK":2}, str(rep.class_distribution))
ck("attack rows survive cleaning (not just BENIGN)", rep.class_distribution.get("WEB_ATTACK",0)==2)
ck("preprocessing deterministic", prepare(pd.DataFrame(src))[0].equals(out))
try: prepare(pd.DataFrame({"Label":["BENIGN"]})); ck("missing columns rejected", False)
except SchemaError: ck("missing columns rejected", True)

print("\nREPEATED CSV HEADER ROWS (CSE-CIC-IDS2018 concatenation artefact)")
hdr = pd.DataFrame({"Label": ["Benign", "Label", "Bot", "label", "  LABEL  ",
                              "DoS attacks-Hulk", "Brute Force -Web", "SQL Injection",
                              "Brute Force -XSS", "DoS attacks-SlowHTTPTest", "Infilteration"]})
rep_h = PreprocessReport()
kept = drop_header_rows(hdr, "Label", rep_h)
survivors = kept["Label"].tolist()
ck("header rows counted", rep_h.header_rows_removed == 3, str(rep_h.header_rows_removed))
ck("Label removed", "Label" not in survivors)
ck("lowercase 'label' removed", "label" not in survivors)
ck("whitespace-padded '  LABEL  ' removed", "  LABEL  " not in survivors)
for legit in ["Benign", "Bot", "DoS attacks-Hulk", "DoS attacks-SlowHTTPTest",
              "Brute Force -Web", "Brute Force -XSS", "SQL Injection", "Infilteration"]:
    ck(f"{legit} survives", legit in survivors)
ck("no legitimate label lost", len(survivors) == 8, str(len(survivors)))
rep_none = PreprocessReport()
drop_header_rows(pd.DataFrame({"Label": ["Benign", "Bot"]}), "Label", rep_none)
ck("clean file reports 0 header rows", rep_none.header_rows_removed == 0)

# End-to-end: a header row inside a real-shaped frame must not reach mapping.
src_h = {col: [1, 2, 3] for col in SRC.values()}
src_h[SRC["flow_duration"]] = [500000, 900000, 250000]
src_h[SRC["flow_bytes_per_s"]] = [10.0, 20.0, 30.0]
src_h["Label"] = ["Benign", "Label", "DoS attacks-Hulk"]
src_h["Timestamp"] = ["22/02/2018 09:00:00"] * 3
src_h["Dst Port"] = [80] * 3
out_h, rep_e2e = prepare(pd.DataFrame(src_h))
ck("prepare() removes the header row", rep_e2e.header_rows_removed == 1, str(rep_e2e.header_rows_removed))
ck("prepare() keeps both real rows", rep_e2e.rows_out == 2, str(rep_e2e.rows_out))
ck("header row never reaches label mapping", rep_e2e.class_distribution == {"BENIGN": 1, "DOS": 1}, str(rep_e2e.class_distribution))
ck("header count separate from NaN count", rep_e2e.nan_rows_dropped == 0)

print("\nVERIFIED 2018 LABELS")
for lab, want in [("Benign","BENIGN"),("Bot","BOTNET"),("DoS attacks-Hulk","DOS"),
                  ("DoS attacks-SlowHTTPTest","DOS"),("Brute Force -Web","WEB_ATTACK"),
                  ("Brute Force -XSS","WEB_ATTACK"),("SQL Injection","WEB_ATTACK")]:
    ck(f"{lab} -> {want}", normalise_label(lab)==want, str(normalise_label(lab)))
ck("Infilteration excluded (2018 spelling)", normalise_label("Infilteration") is None)
# Probe with a genuinely unknown label. "DDOS attack-HOIC" was used here while
# it was unsighted; it is now verified and mapped, so it no longer tests this.
try:
    normalise_label("Totally Unseen Attack 9000"); ck("unknown label still raises", False)
except SchemaError:
    ck("unknown label still raises (fails loudly)", True)

print("\nVERIFIED CSE-CIC-IDS2018 LABEL COVERAGE")
for lab, want in [("Benign","BENIGN"),("Bot","BOTNET"),
                  ("DoS attacks-Hulk","DOS"),("DoS attacks-SlowHTTPTest","DOS"),
                  ("DoS attacks-GoldenEye","DOS"),("DoS attacks-Slowloris","DOS"),
                  ("DDOS attack-HOIC","DDOS"),("DDOS attack-LOIC-UDP","DDOS"),
                  ("FTP-BruteForce","BRUTE_FORCE"),("SSH-Bruteforce","BRUTE_FORCE"),
                  ("Brute Force -Web","WEB_ATTACK"),("Brute Force -XSS","WEB_ATTACK"),
                  ("SQL Injection","WEB_ATTACK")]:
    ck(f"{lab} -> {want}", normalise_label(lab)==want, str(normalise_label(lab)))
ck("Infilteration excluded", normalise_label("Infilteration") is None)
ck("FTP-BruteForce is NOT WEB_ATTACK (prefix trap avoided)", normalise_label("FTP-BruteForce")=="BRUTE_FORCE")
ck("SSH-Bruteforce is NOT WEB_ATTACK", normalise_label("SSH-Bruteforce")=="BRUTE_FORCE")
ck("Brute Force -Web is NOT BRUTE_FORCE", normalise_label("Brute Force -Web")=="WEB_ATTACK")

print("\nTRAINABLE CLASS SET")
ck("6 trainable classes", len(TRAINABLE_CLASSES)==6, str(len(TRAINABLE_CLASSES)))
ck("PORT_SCAN NOT trainable", "PORT_SCAN" not in TRAINABLE_CLASSES)
for c in ["BENIGN","BRUTE_FORCE","DOS","DDOS","WEB_ATTACK","BOTNET"]:
    ck(f"{c} trainable", c in TRAINABLE_CLASSES)

print("\nLEAKAGE COLUMN COVERAGE (2018 short forms)")
for c in ["Dst Port","Timestamp","Src IP","Dst IP","Src Port","Flow ID"]:
    ck(f"{c} treated as leakage", c in LEAKAGE_COLUMNS)

print("\nNEGATIVE FLOW DURATION")
neg = pd.DataFrame({"flow_duration":[100, -1, 0, -42, 5000]})
rep_n = PreprocessReport()
kept_n = drop_invalid_duration(neg, rep_n)
ck("negative rows counted", rep_n.invalid_duration_rows==2, str(rep_n.invalid_duration_rows))
ck("zero duration KEPT (instantaneous flow is real)", 0 in kept_n["flow_duration"].tolist())
ck("positive rows kept", len(kept_n)==3, str(len(kept_n)))
rep_z = PreprocessReport(); drop_invalid_duration(pd.DataFrame({"flow_duration":[1,2]}), rep_z)
ck("clean file reports 0 invalid durations", rep_z.invalid_duration_rows==0)

src_d = {col: [1,2,3,4] for col in SRC.values()}
src_d[SRC["flow_duration"]]=[500000,-1,900000,250000]
src_d[SRC["flow_bytes_per_s"]]=[10.0,20.0,30.0,40.0]
src_d["Label"]=["Benign","Bot","DDOS attack-HOIC","FTP-BruteForce"]
src_d["Timestamp"]=["x"]*4; src_d["Dst Port"]=[80]*4; src_d["Src IP"]=["1.1.1.1"]*4
out_d, rep_d = prepare(pd.DataFrame(src_d))
ck("prepare() drops the negative-duration row", rep_d.invalid_duration_rows==1)
ck("invalid duration separate from NaN/Inf", rep_d.nan_rows_dropped==0 and rep_d.inf_rows_dropped==0)
ck("Src IP dropped as leakage", "Src IP" in rep_d.leakage_columns_dropped)
ck("surviving classes correct", rep_d.class_distribution=={"BENIGN":1,"DDOS":1,"BRUTE_FORCE":1}, str(rep_d.class_distribution))

print("\nSERVICE CONTRACT")
ck("BENIGN prediction -> ml_confidence 0", prediction(0,"BENIGN",0.99,0.2)["ml_confidence"]==0.0)
ck("non-BENIGN keeps confidence", prediction(0,"DOS",0.87,0.6)["ml_confidence"]==0.87)
ck("confidence clamped to 1", prediction(0,"DOS",5.0,0.1)["ml_confidence"]==1.0)
ck("anomaly clamped to 0..1", prediction(0,"DOS",0.5,9.0)["anomaly_score"]==1.0)
u = unavailable_response("no model","v1")
ck("unavailable carries no predictions", u["available"] is False and u["predictions"]==[])
ck("unavailable states a reason", u["reason"]=="no model")
ck("anomaly uses training percentiles", math.isclose(normalise_anomaly(-0.55,-0.7,-0.4),0.5))
ck("anomaly is batch-independent", normalise_anomaly(-0.55,-0.7,-0.4)==normalise_anomaly(-0.55,-0.7,-0.4))
try: normalise_anomaly(-0.5,None,None); ck("missing percentiles rejected", False)
except ValidationError: ck("missing percentiles rejected", True)

print("\nREQUEST VALIDATION")
good={"flows":[raw_row()]}
ck("valid request accepted", len(validate_score_request(good))==1)
for body,label in [({}, "no flows"),({"flows":[]},"empty flows"),({"flows":"x"},"non-array"),
    ({"flows":[{**raw_row(),"syn_to_ack_ratio":1.0}]},"engineered field supplied"),
    ({"flows":[{k:v for k,v in raw_row().items() if k!="fwd_bytes"}]},"missing raw feature"),
    ({"flows":[raw_row()]*501},"too many flows")]:
    try: validate_score_request(body); ck(f"{label} rejected", False)
    except ValidationError: ck(f"{label} rejected", True)

print(f"\n================ {P[0]} passed, {F[0]} failed ================")
sys.exit(1 if F[0] else 0)
