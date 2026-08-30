const fs=require("fs"), {DatabaseSync}=require("node:sqlite");
const P="/tmp/soc21c.db";
const {SqliteStorage}=require("../server/dist/server/src/sqliteStorage.js");
const {SocDataStore}=require("../server/dist/server/src/socData.js");
const {handleSocRoute}=require("../server/dist/server/src/socRoutes.js");
const {handleAssignmentRoute}=require("../server/dist/server/src/assignmentRoutes.js");
const {AssignmentService}=require("../server/dist/server/src/assignmentStore.js");
let p=0,f=0; const ck=(n,c,d="")=>{c?(p++,console.log("  PASS  "+n)):(f++,console.log("  FAIL  "+n+(d?" -> "+d:"")))};
const wipe=()=>{for(const s of ["","-wal","-shm"]) try{fs.unlinkSync(P+s)}catch{}};
const ADMIN={email:"admin@socgenie.demo",role:"admin"}, ANALYST={email:"a@socgenie.demo",role:"analyst"};
function boot(){const st=new SqliteStorage(P),db=new DatabaseSync(P),soc=new SocDataStore(db);
  return {st,db,soc,svc:new AssignmentService(st),
    api:(url,method,claims,body)=>handleSocRoute({url,method,claims,body},soc),
    asn:(url,method,claims,body)=>handleAssignmentRoute({url,method,claims,body},new AssignmentService(st))};}

wipe(); let b=boot();
console.log("API -> SQLITE -> API  (alerts)");
const alert={ref:"ALT-10492",title:"Brute force",severity:"critical",riskScore:91,status:"open",
  detectionSource:"rule",minutesAgo:12,sourceIp:"185.220.101.4",destinationIp:null,host:"WS-042",
  user:"svc_backup",techniqueId:"T1110",evidence:[{label:"Failed attempts",value:"11"}],notes:[],escalatedTo:null};
ck("POST /api/alerts -> 200", b.api("/api/alerts","POST",ADMIN,{alerts:[alert]}).status===200);
ck("GET returns it", b.api("/api/alerts","GET",ANALYST,{}).payload.alerts.length===1);
b.db.close(); b=boot();                                    // ← RESTART
let got=b.api("/api/alerts","GET",ANALYST,{}).payload.alerts;
ck("alert survived restart", got.length===1 && got[0].ref==="ALT-10492");
ck("evidence survived", got[0].evidence[0].value==="11");
ck("riskScore survived", got[0].riskScore===91);

console.log("\nUPDATE -> RESTART");
b.api("/api/alerts","POST",ADMIN,{alerts:[{...alert,status:"resolved",riskScore:91}]});
b.db.close(); b=boot();
got=b.api("/api/alerts","GET",ADMIN,{}).payload.alerts;
ck("status update survived", got[0].status==="resolved", got[0].status);
ck("NO duplicate row created", got.length===1, String(got.length));
ck("NO reseed to original state", got[0].status!=="open");

console.log("\nBATCH INGEST (Phase 12 detection sink)");
const batch=[1,2,3,4,5,6,7].map((i,ix)=>({...alert,ref:"MLA-"+i,title:"det "+i,
  riskScore:[41,49,43,42,42,55,35][ix],status:"open"}));
ck("batch POST -> 200", b.api("/api/alerts","POST",ADMIN,{alerts:batch}).status===200);
b.db.close(); b=boot();
const scores=b.api("/api/alerts","GET",ADMIN,{}).payload.alerts
  .filter(a=>a.ref.startsWith("MLA-")).map(a=>a.riskScore).join(", ");
console.log("    persisted scores: "+scores);
ck("PHASE 12 FINGERPRINT intact through persistence", scores==="41, 49, 43, 42, 42, 55, 35", scores);
ck("invalid alert rejected", b.api("/api/alerts","POST",ADMIN,{alerts:[{title:"no ref"}]}).status===400);
ck("bad item does not half-write", b.api("/api/alerts","GET",ADMIN,{}).payload.alerts.length===8);

console.log("\nINCIDENTS");
ck("POST incident", b.api("/api/incidents","POST",ADMIN,{ref:"INC-2041",title:"Credential attack",
  severity:"high",status:"investigating",assignedTo:"A. Sharma",alertRefs:["ALT-10492"],
  notes:[{by:"A. Sharma",text:"triaged"}],activity:[{actor:"M. Raghavan",action:"created"}]}).status===200);
b.db.close(); b=boot();
let inc=b.api("/api/incidents","GET",ANALYST,{}).payload.incidents[0];
ck("incident survived restart", inc.ref==="INC-2041");
ck("linked alerts intact", inc.alertRefs.includes("ALT-10492"));
ck("notes + activity intact", inc.notes.length===1 && inc.activity.length===1);
b.api("/api/incidents","PATCH",ADMIN,{...inc,status:"resolved"}); b.db.close(); b=boot();
ck("incident status change survived", b.api("/api/incidents","GET",ADMIN,{}).payload.incidents[0].status==="resolved");
ck('incident "" assignee -> null',
   (b.api("/api/incidents","POST",ADMIN,{ref:"INC-X",title:"t",assignedTo:""}),
    b.api("/api/incidents","GET",ADMIN,{}).payload.incidents.find(i=>i.ref==="INC-X").assignedTo===null));

console.log("\nINVESTIGATIONS");
ck("PUT investigation", b.api("/api/investigations/ALT-10492","PUT",ANALYST,
  {status:"investigating",assignedTo:"J. Mehta",activity:[{actor:"J. Mehta",action:"opened"}]}).status===200);
b.db.close(); b=boot();
let iv=b.api("/api/investigations/ALT-10492","GET",ANALYST,{}).payload.investigation;
ck("investigation survived restart", iv.alertRef==="ALT-10492");
ck("status preserved", iv.status==="investigating");
ck("assignee preserved", iv.assignedTo==="J. Mehta");
ck("activity preserved", iv.activity.length===1);
ck("no session fallback: null stays null",
   (b.api("/api/investigations/MLA-1","PUT",ANALYST,{status:"open",assignedTo:null}),
    b.api("/api/investigations/MLA-1","GET",ANALYST,{}).payload.investigation.assignedTo===null));
ck("unknown investigation -> 404", b.api("/api/investigations/NOPE","GET",ANALYST,{}).status===404);

console.log("\nRBAC UNCHANGED (Phase 19)");
ck("unauthenticated read -> 401", b.api("/api/alerts","GET",null,{}).status===401);
ck("analyst assign -> 403", b.asn("/api/assignments","POST",ANALYST,{alertRef:"ALT-10492",analyst:"A. Sharma"}).status===403);
ck("admin assign -> 200", b.asn("/api/assignments","POST",ADMIN,{alertRef:"ALT-10492",analyst:"K. Iyer"}).status===200);
ck("admin not assignable", b.asn("/api/assignments","POST",ADMIN,{alertRef:"ALT-10492",analyst:"M. Raghavan"}).status===400);
b.db.close(); b=boot();
ck("assignment survived restart", b.svc.listAssignments().find(a=>a.alertRef==="ALT-10492")?.assignedTo==="K. Iyer");
b.svc.removeAnalyst("M. Raghavan","J. Mehta"); b.db.close(); b=boot();
ck("removed analyst stays removed", b.svc.listAnalysts().find(a=>a.name==="J. Mehta")?.active===false);
ck("round-robin skips them", !Array.from({length:6},()=>b.svc.roundRobin("M. Raghavan","Q"+Math.random()).assignment.assignedTo).includes("J. Mehta"));
ck("audit survived restart", b.svc.listAudit().length>0);

console.log("\nDB IS THE SOURCE OF TRUTH, NOT SEED");
const n=b.api("/api/alerts","GET",ADMIN,{}).payload.alerts.length;
b.db.close(); b=boot(); b.db.close(); b=boot();
ck("count stable across 2 more restarts", b.api("/api/alerts","GET",ADMIN,{}).payload.alerts.length===n, String(n));
b.db.close(); wipe();
console.log("\n================ "+p+" passed, "+f+" failed ================");
process.exit(f?1:0);
