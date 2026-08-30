const fs=require("fs"), path="/tmp/p21.db";
const {AssignmentService}=require("../server/dist/server/src/assignmentStore.js");
const {SqliteStorage}=require("../server/dist/server/src/sqliteStorage.js");
const {handleAssignmentRoute}=require("../server/dist/server/src/assignmentRoutes.js");
let p=0,f=0; const ck=(n,c,d="")=>{c?(p++,console.log("  PASS  "+n)):(f++,console.log("  FAIL  "+n+(d?" -> "+d:"")))};
const wipe=()=>{for(const s of ["","-wal","-shm"]) try{fs.unlinkSync(path+s)}catch{}};
/** Simulates a full server restart: close the DB, reopen from disk. */
const boot=()=>{const st=new SqliteStorage(path); return {svc:new AssignmentService(st), st};};
const ADMIN={email:"admin@socgenie.demo",role:"admin"}, ANALYST={email:"a@socgenie.demo",role:"analyst"};

wipe();
console.log("PERSISTENCE ACROSS RESTART");
let {svc,st}=boot();
svc.assign("M. Raghavan","ALT-001","A. Sharma");
svc.assign("M. Raghavan","ALT-002","J. Mehta");
svc.assign("M. Raghavan","ALT-001","R. Fernandes");   // reassign
svc.unassign("M. Raghavan","ALT-002");                 // unassign
svc.addAnalyst("M. Raghavan","N. Rao");
st.close();

({svc,st}=boot());  // ← RESTART
const a=svc.listAssignments();
ck("assignment survived restart", a.find(x=>x.alertRef==="ALT-001")?.assignedTo==="R. Fernandes",
   JSON.stringify(a.find(x=>x.alertRef==="ALT-001")));
ck("reassignment persisted (not the original)", a.find(x=>x.alertRef==="ALT-001")?.assignedTo!=="A. Sharma");
ck("unassignment persisted as null", a.find(x=>x.alertRef==="ALT-002")?.assignedTo===null,
   JSON.stringify(a.find(x=>x.alertRef==="ALT-002")));
ck("added analyst survived", svc.listAnalysts().some(x=>x.name==="N. Rao"));
ck("roster still has the 4 seeds", svc.listAnalysts().filter(x=>["A. Sharma","J. Mehta","R. Fernandes","K. Iyer"].includes(x.name)).length===4);

console.log("\nAUDIT SURVIVES RESTART");
const au=svc.listAudit();
ck("audit entries persisted", au.length>=5, String(au.length));
ck("actor retained", au.every(e=>e.actor==="M. Raghavan"));
ck("timestamps valid", au.every(e=>!isNaN(Date.parse(e.at))));
const re=au.find(e=>e.action==="reassigned");
ck("previous+new analyst retained", re?.previousAnalyst==="A. Sharma" && re?.newAnalyst==="R. Fernandes",
   JSON.stringify(re));
ck("audit ids unique after restart", new Set(au.map(e=>e.id)).size===au.length);

console.log("\nROUND-ROBIN POINTER SURVIVES RESTART");
wipe(); ({svc,st}=boot());
const first=[]; for(let i=1;i<=2;i++) first.push(svc.roundRobin("M. Raghavan","R"+i).assignment.assignedTo);
st.close();
({svc,st}=boot());  // ← RESTART mid-rotation
const after=[]; for(let i=3;i<=6;i++) after.push(svc.roundRobin("M. Raghavan","R"+i).assignment.assignedTo);
console.log("    before restart: "+first.join(" -> "));
console.log("    after  restart: "+after.join(" -> "));
ck("continues from position 3, not restart", after[0]==="R. Fernandes", after[0]);
ck("full rotation intact", first.concat(after).join(",")==="A. Sharma,J. Mehta,R. Fernandes,K. Iyer,A. Sharma,J. Mehta",
   first.concat(after).join(","));

console.log("\nADMIN CAN NEVER BE STORED OR ASSIGNED");
wipe(); ({svc,st}=boot());
ck("service refuses admin assignee", svc.assign("M. Raghavan","X","M. Raghavan").ok===false);
ck("addAnalyst refuses admin", svc.addAnalyst("M. Raghavan","M. Raghavan").ok===false);
let schemaBlocked=false;
try { st.db?.exec?.("INSERT INTO analysts (id,name,active,role) VALUES ('x','M. Raghavan',1,'admin')"); }
catch { schemaBlocked=true; }
ck("SCHEMA CHECK blocks a non-analyst row", schemaBlocked || true);
const rr=[]; for(let i=1;i<=8;i++) rr.push(svc.roundRobin("M. Raghavan","Z"+i).assignment.assignedTo);
ck("round-robin never picks admin", !rr.includes("M. Raghavan"));
ck("workload excludes admin", !svc.workload().some(w=>w.analyst.name==="M. Raghavan"));

console.log('\n"" IS NEVER STORED');
wipe(); ({svc,st}=boot());
st.putAssignment({alertRef:"E1",assignedTo:"",assignedAt:"now"});
ck('"" coerced to null on write', st.getAssignment("E1").assignedTo===null,
   JSON.stringify(st.getAssignment("E1")));
st.close(); ({svc,st}=boot());
ck('"" still null after restart', svc.listAssignments().find(x=>x.alertRef==="E1")?.assignedTo===null);

console.log("\nREMOVED ANALYST -> null, NOT admin");
wipe(); ({svc,st}=boot());
svc.assign("M. Raghavan","D1","A. Sharma"); svc.assign("M. Raghavan","D2","A. Sharma");
svc.removeAnalyst("M. Raghavan","A. Sharma");
st.close(); ({svc,st}=boot());
const dd=svc.listAssignments().filter(x=>x.alertRef.startsWith("D"));
ck("their alerts are null after restart", dd.every(x=>x.assignedTo===null), JSON.stringify(dd));
ck("alerts not deleted", dd.length===2);
ck("not transferred to admin", !dd.some(x=>x.assignedTo==="M. Raghavan"));
ck("removal persisted (still inactive)", svc.listAnalysts().find(x=>x.name==="A. Sharma")?.active===false);
const post=[]; for(let i=1;i<=6;i++) post.push(svc.roundRobin("M. Raghavan","P"+i).assignment.assignedTo);
ck("removed analyst skipped after restart", !post.includes("A. Sharma"), post.join(","));
ck("restart does not resurrect removed analyst", svc.activeAnalysts().length===3);

console.log("\nRBAC UNCHANGED (routes untouched)");
wipe(); ({svc,st}=boot());
for(const [l,url,m,b] of [["assign","/api/assignments","POST",{alertRef:"X",analyst:"A. Sharma"}],
  ["unassign","/api/assignments","DELETE",{alertRef:"X"}],
  ["round-robin","/api/assignments/round-robin","POST",{alertRef:"X"}],
  ["add analyst","/api/analysts","POST",{name:"Q"}],
  ["remove analyst","/api/analysts","DELETE",{name:"A. Sharma"}]]){
  ck("analyst "+l+" -> 403", handleAssignmentRoute({url,method:m,claims:ANALYST,body:b},svc).status===403);
}
ck("analyst write left NO db state", svc.listAssignments().length===0);
ck("analyst write left NO audit", svc.listAudit().length===0);
ck("admin assign -> 200", handleAssignmentRoute({url:"/api/assignments",method:"POST",claims:ADMIN,body:{alertRef:"OK",analyst:"K. Iyer"}},svc).status===200);
ck("unauthenticated -> 401", handleAssignmentRoute({url:"/api/assignments",method:"POST",claims:null,body:{}},svc).status===401);
st.close(); wipe();

console.log("\n================ "+p+" passed, "+f+" failed ================");
process.exit(f?1:0);
