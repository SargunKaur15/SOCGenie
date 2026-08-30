const {AssignmentService,InMemoryStorage,isAdminIdentity}=require("../server/dist/server/src/assignmentStore.js");
const {handleAssignmentRoute}=require("../server/dist/server/src/assignmentRoutes.js");
let p=0,f=0; const ck=(n,c,d="")=>{c?(p++,console.log("  PASS  "+n)):(f++,console.log("  FAIL  "+n+(d?" -> "+d:"")))};
const ADMIN={email:"admin@socgenie.demo",role:"admin"};
const ANALYST={email:"analyst@socgenie.demo",role:"analyst"};
const svc=()=>new AssignmentService(new InMemoryStorage());
const call=(s,url,m,c,b)=>handleAssignmentRoute({url,method:m,claims:c,body:b},s);

console.log("(a) ADMIN CANNOT BE ASSIGNED AN ALERT");
let s=svc();
const r=s.assign("M. Raghavan","ALT-1","M. Raghavan");
ck("service refuses admin as target", r.ok===false, JSON.stringify(r));
ck("error names the reason", /management role/.test(r.error||""), r.error);
ck("state unchanged", s.listAssignments().length===0);
ck("no audit written", s.listAudit().length===0);
const api=call(svc(),"/api/assignments","POST",ADMIN,{alertRef:"ALT-1",analyst:"M. Raghavan"});
ck("API refuses admin as target (400)", api.status===400, "status="+api.status);
ck("isAdminIdentity works", isAdminIdentity("M. Raghavan")===true && isAdminIdentity("A. Sharma")===false);

console.log("\n(b) ADMIN IS NEVER SELECTED BY ROUND-ROBIN");
s=svc(); const picks=[];
for(let i=1;i<=12;i++) picks.push(s.roundRobin("M. Raghavan","A"+i).assignment.assignedTo);
ck("12 allocations, admin never chosen", !picks.includes("M. Raghavan"), picks.join(","));
ck("only the 4 analysts rotate", new Set(picks).size===4, [...new Set(picks)].join(","));
// Even if an admin were forced onto the roster, activeAnalysts filters it.
s=svc(); const add=s.addAnalyst("M. Raghavan","M. Raghavan");
ck("addAnalyst refuses an admin identity", add.ok===false, JSON.stringify(add));
ck("roster still 4", s.activeAnalysts().length===4, String(s.activeAnalysts().length));

console.log("\n(c) ADMIN HAS ZERO WORKLOAD");
s=svc(); for(let i=1;i<=8;i++) s.roundRobin("M. Raghavan","W"+i);
const w=s.workload();
ck("admin absent from workload table", !w.some(x=>x.analyst.name==="M. Raghavan"), w.map(x=>x.analyst.name).join(","));
ck("workload rows are analysts only", w.every(x=>x.analyst.role==="analyst"));
ck("8 alerts spread over 4 analysts", w.reduce((t,x)=>t+x.count,0)===8);

console.log("\n(d) ANALYST REMAINS ASSIGNABLE");
s=svc();
ck("assign to A. Sharma works", s.assign("M. Raghavan","ALT-9","A. Sharma").ok===true);
ck("reassign to J. Mehta works", s.assign("M. Raghavan","ALT-9","J. Mehta").ok===true);
ck("unassign -> null", s.unassign("M. Raghavan","ALT-9").assignment.assignedTo===null);
ck("audit actor is the admin", s.listAudit()[0].actor==="M. Raghavan");

console.log("\n(e) REMOVED ANALYST: alerts unassigned, admin NOT substituted");
s=svc(); s.assign("M. Raghavan","R1","A. Sharma"); s.assign("M. Raghavan","R2","A. Sharma");
const rm=s.removeAnalyst("M. Raghavan","A. Sharma");
ck("their alerts became null", s.listAssignments().filter(a=>a.alertRef.startsWith("R")).every(a=>a.assignedTo===null));
ck("alerts not deleted", rm.unassigned.length===2);
const after=[]; for(let i=1;i<=6;i++) after.push(s.roundRobin("M. Raghavan","S"+i).assignment.assignedTo);
ck("removed analyst skipped", !after.includes("A. Sharma"));
ck("admin NOT used as replacement", !after.includes("M. Raghavan"), after.join(","));

console.log("\n(f) ANALYST CANNOT PERFORM ASSIGNMENT MANAGEMENT");
for(const [l,url,m,b] of [["assign","/api/assignments","POST",{alertRef:"X",analyst:"A. Sharma"}],
  ["unassign","/api/assignments","DELETE",{alertRef:"X"}],
  ["round-robin","/api/assignments/round-robin","POST",{alertRef:"X"}],
  ["add analyst","/api/analysts","POST",{name:"Z. Test"}],
  ["remove analyst","/api/analysts","DELETE",{name:"A. Sharma"}]]){
  ck("analyst "+l+" -> 403", call(svc(),url,m,ANALYST,b).status===403);
}

console.log("\nZERO ANALYSTS: never falls back to the admin");
s=svc(); for(const n of ["A. Sharma","J. Mehta","R. Fernandes","K. Iyer"]) s.removeAnalyst("M. Raghavan",n);
const z=call(s,"/api/assignments/round-robin","POST",ADMIN,{alertRef:"Q"});
ck("409 NO_ACTIVE_ANALYSTS", z.status===409, "status="+z.status);
ck("no assignment created", s.listAssignments().filter(a=>a.alertRef==="Q").length===0);
ck("admin not assigned as fallback", !s.listAssignments().some(a=>a.assignedTo==="M. Raghavan"));

console.log("\n================ "+p+" passed, "+f+" failed ================");
process.exit(f?1:0);
