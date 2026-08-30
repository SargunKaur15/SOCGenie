const fs=require("fs"), {DatabaseSync}=require("node:sqlite");
const P="/tmp/soc21.db";
const {SqliteStorage}=require("../server/dist/server/src/sqliteStorage.js");
const {SocDataStore}=require("../server/dist/server/src/socData.js");
const {AssignmentService}=require("../server/dist/server/src/assignmentStore.js");
let p=0,f=0; const ck=(n,c,d="")=>{c?(p++,console.log("  PASS  "+n)):(f++,console.log("  FAIL  "+n+(d?" -> "+d:"")))};
const wipe=()=>{for(const s of ["","-wal","-shm"]) try{fs.unlinkSync(P+s)}catch{}};
/** One connection, shared — SqliteStorage creates meta, SocDataStore extends it. */
function boot(){ const st=new SqliteStorage(P); const db=new DatabaseSync(P); const soc=new SocDataStore(db);
  return {st, soc, db, svc:new AssignmentService(st)}; }

wipe();
console.log("SCHEMA + MIGRATION");
let b=boot();
ck("schema_version recorded", b.soc.schemaVersion()===2, String(b.soc.schemaVersion()));
ck("alerts table empty on first boot", b.soc.hasAlerts()===false);
const tables=b.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r=>r.name);
console.log("    tables: "+tables.join(", "));
ck("7 tables present", tables.length>=7, String(tables.length));

console.log("\nALERTS PERSIST");
b.soc.upsertAlert({ref:"ALT-10492",title:"Brute force",severity:"critical",riskScore:91,
  status:"open",detectionSource:"rule",minutesAgo:12,sourceIp:"185.220.101.4",destinationIp:null,
  host:"WS-042",user:"svc_backup",techniqueId:"T1110",
  evidence:[{label:"Failed attempts",value:"11"}],notes:[],escalatedTo:null});
b.soc.upsertAlert({ref:"MLA-63801",title:"BRUTE_FORCE classified",severity:"medium",riskScore:50,
  status:"investigating",detectionSource:"ml",minutesAgo:0,sourceIp:"10.10.20.14",destinationIp:"45.83.91.12",
  host:"WS-007",user:null,techniqueId:"T1110",evidence:[{label:"Model confidence",value:"98.65%"}],
  notes:[],escalatedTo:null});
b.db.close();

b=boot();  // ← RESTART
const al=b.soc.listAlerts();
ck("2 alerts survived restart", al.length===2, String(al.length));
const a1=al.find(x=>x.ref==="ALT-10492");
ck("ref preserved", !!a1);
ck("severity preserved", a1.severity==="critical");
ck("riskScore preserved", a1.riskScore===91);
ck("status preserved", a1.status==="open");
ck("techniqueId preserved", a1.techniqueId==="T1110");
ck("evidence preserved (JSON round-trip)", a1.evidence[0].value==="11", JSON.stringify(a1.evidence));
ck("detectionSource preserved", al.find(x=>x.ref==="MLA-63801").detectionSource==="ml");
b.soc.setAlertStatus("ALT-10492","resolved"); b.db.close();
b=boot();
ck("status CHANGE survived restart", b.soc.listAlerts().find(x=>x.ref==="ALT-10492").status==="resolved");
ck("NO reseed — still exactly 2", b.soc.listAlerts().length===2, String(b.soc.listAlerts().length));

console.log("\nINCIDENTS PERSIST");
b.soc.upsertIncident({ref:"INC-2041",title:"Credential attack",severity:"high",status:"investigating",
  assignedTo:"A. Sharma",host:"WS-042",sourceIp:"185.220.101.4",user:"svc_backup",
  alertRefs:["ALT-10492","MLA-63801"],notes:[{by:"A. Sharma",text:"triaged"}],
  activity:[{actor:"M. Raghavan",action:"created"}]});
b.db.close(); b=boot();
const inc=b.soc.listIncidents()[0];
ck("incident survived restart", inc?.ref==="INC-2041");
ck("status preserved", inc.status==="investigating");
ck("severity preserved", inc.severity==="high");
ck("assignee preserved", inc.assignedTo==="A. Sharma");
ck("linked alerts preserved", inc.alertRefs.length===2 && inc.alertRefs.includes("ALT-10492"));
ck("notes preserved", inc.notes.length===1);
ck("activity preserved", inc.activity.length===1);
b.soc.upsertIncident({...inc,assignedTo:""}); b.db.close(); b=boot();
ck('incident "" assignee -> null', b.soc.listIncidents()[0].assignedTo===null);

console.log("\nINVESTIGATION STATE PERSISTS");
b.soc.upsertInvestigation({alertRef:"ALT-10492",status:"investigating",assignedTo:"J. Mehta",
  activity:[{actor:"J. Mehta",action:"opened"},{actor:"J. Mehta",action:"added a note"}]});
b.db.close(); b=boot();
const iv=b.soc.listInvestigations()[0];
ck("investigation survived restart", iv?.alertRef==="ALT-10492");
ck("status preserved", iv.status==="investigating");
ck("assignee preserved", iv.assignedTo==="J. Mehta");
ck("activity log preserved", iv.activity.length===2, String(iv.activity.length));
b.soc.upsertInvestigation({...iv,status:"resolved"}); b.db.close(); b=boot();
ck("status change survived", b.soc.listInvestigations()[0].status==="resolved");
ck("NO reseed of investigations", b.soc.listInvestigations().length===1);

console.log("\nASSIGNMENT LAYER STILL WORKS ON THE SAME DB");
b.svc.assign("M. Raghavan","ALT-10492","K. Iyer");
b.svc.roundRobin("M. Raghavan","MLA-63801");
b.db.close(); b=boot();
ck("assignment persisted alongside SOC data", b.svc.listAssignments().find(x=>x.alertRef==="ALT-10492")?.assignedTo==="K. Iyer");
ck("audit persisted", b.svc.listAudit().length>=2);
ck("admin still refused as assignee", b.svc.assign("M. Raghavan","ALT-10492","M. Raghavan").ok===false);
ck("roster intact", b.svc.activeAnalysts().length===4);
const rr=b.svc.roundRobin("M. Raghavan","NEW-1").assignment.assignedTo;
ck("round-robin continues from pointer", rr!=="A. Sharma", rr);

console.log("\nNO SILENT RECREATION");
const beforeCounts=[b.soc.listAlerts().length,b.soc.listIncidents().length,b.soc.listInvestigations().length];
b.db.close(); b=boot(); b.db.close(); b=boot();
const afterCounts=[b.soc.listAlerts().length,b.soc.listIncidents().length,b.soc.listInvestigations().length];
ck("counts identical after 2 more restarts", JSON.stringify(beforeCounts)===JSON.stringify(afterCounts),
   JSON.stringify(beforeCounts)+" vs "+JSON.stringify(afterCounts));
b.db.close(); wipe();

console.log("\n================ "+p+" passed, "+f+" failed ================");
process.exit(f?1:0);
