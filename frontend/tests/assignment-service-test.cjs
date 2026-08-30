const {AssignmentService,InMemoryStorage}=require("../server/dist/server/src/assignmentStore.js");
let p=0,f=0; const ck=(n,c,d="")=>{c?(p++,console.log("  PASS  "+n)):(f++,console.log("  FAIL  "+n+(d?" -> "+d:"")))};
const svc=()=>new AssignmentService(new InMemoryStorage());

console.log("ROUND-ROBIN ROTATION");
let s=svc(); const got=[];
for(let i=1;i<=6;i++){const r=s.roundRobin("ADMIN","ALT-00"+i); got.push(r.assignment.assignedTo);}
console.log("    "+got.join(" -> "));
ck("A -> B -> C -> D -> A -> B", got.join(",")==="A. Sharma,J. Mehta,R. Fernandes,K. Iyer,A. Sharma,J. Mehta", got.join(","));
ck("does not repeat the first analyst", new Set(got).size===4);

console.log("\nROUND-ROBIN EDGE CASES");
s=svc();
for(const n of ["J. Mehta","R. Fernandes","K. Iyer"]) s.removeAnalyst("ADMIN",n);
const one=[]; for(let i=1;i<=3;i++) one.push(s.roundRobin("ADMIN","X"+i).assignment.assignedTo);
ck("single analyst gets all", one.every(x=>x==="A. Sharma"), one.join(","));
s.removeAnalyst("ADMIN","A. Sharma");
const zero=s.roundRobin("ADMIN","Y1");
ck("zero analysts fails gracefully", zero.ok===false && /No active analysts/.test(zero.error), JSON.stringify(zero));
ck("zero analysts does not throw", true);

console.log("\nREMOVED ANALYST IS SKIPPED");
s=svc(); s.roundRobin("ADMIN","A1"); s.removeAnalyst("ADMIN","J. Mehta");
const after=[]; for(let i=1;i<=4;i++) after.push(s.roundRobin("ADMIN","B"+i).assignment.assignedTo);
console.log("    after removing J. Mehta: "+after.join(" -> "));
ck("removed analyst never assigned", !after.includes("J. Mehta"), after.join(","));
ck("rotation continues deterministically", new Set(after).size===3);

console.log("\nANALYST ADDED MID-ROTATION");
s=svc(); s.roundRobin("ADMIN","C1"); s.roundRobin("ADMIN","C2");
s.addAnalyst("ADMIN","N. Rao");
const post=[]; for(let i=1;i<=5;i++) post.push(s.roundRobin("ADMIN","D"+i).assignment.assignedTo);
console.log("    after adding N. Rao: "+post.join(" -> "));
ck("new analyst joins rotation", post.includes("N. Rao"));
ck("rotation still deterministic", svc().roundRobin("ADMIN","Z").assignment.assignedTo==="A. Sharma");

console.log("\nASSIGN / REASSIGN / UNASSIGN");
s=svc();
const a1=s.assign("ADMIN","ALT-001","A. Sharma");
ck("assign succeeds", a1.ok && a1.assignment.assignedTo==="A. Sharma");
const a2=s.assign("ADMIN","ALT-001","J. Mehta");
ck("reassign replaces", a2.assignment.assignedTo==="J. Mehta");
const u=s.unassign("ADMIN","ALT-001");
ck("unassign -> null NOT empty string", u.assignment.assignedTo===null, JSON.stringify(u.assignment.assignedTo));
ck("assignedTo is never ''", s.listAssignments().every(x=>x.assignedTo!==""));
const u2=s.unassign("ADMIN","ALT-001");
ck("unassign twice handled gracefully", u2.ok===true);
const same=s.assign("ADMIN","ALT-002","K. Iyer"); s.assign("ADMIN","ALT-002","K. Iyer");
ck("reassign to same analyst is a no-op", s.listAudit().filter(e=>e.alertRef==="ALT-002").length===1,
   String(s.listAudit().filter(e=>e.alertRef==="ALT-002").length));
ck("unknown analyst rejected", s.assign("ADMIN","ALT-9","Nobody").ok===false);

console.log("\nREMOVED ANALYST'S ALERTS");
s=svc(); s.assign("ADMIN","ALT-100","A. Sharma"); s.assign("ADMIN","ALT-101","A. Sharma");
const rm=s.removeAnalyst("ADMIN","A. Sharma");
ck("their alerts are unassigned, not deleted", rm.unassigned.length===2, JSON.stringify(rm.unassigned));
ck("alerts still exist in the queue", s.listAssignments().length===2);
ck("alerts now null", s.listAssignments().every(x=>x.assignedTo===null));
ck("cannot assign to inactive analyst", s.assign("ADMIN","ALT-102","A. Sharma").ok===false);

console.log("\nWORKLOAD (computed, never cached)");
s=svc(); s.assign("ADMIN","W1","A. Sharma"); s.assign("ADMIN","W2","A. Sharma"); s.assign("ADMIN","W3","J. Mehta");
const w=s.workload();
ck("A. Sharma = 2", w.find(x=>x.analyst.name==="A. Sharma").count===2);
ck("J. Mehta = 1", w.find(x=>x.analyst.name==="J. Mehta").count===1);
ck("K. Iyer = 0", w.find(x=>x.analyst.name==="K. Iyer").count===0);
s.unassign("ADMIN","W1");
ck("workload updates immediately", s.workload().find(x=>x.analyst.name==="A. Sharma").count===1);

console.log("\nAUDIT TRAIL");
s=svc(); s.assign("ADMIN","AU1","A. Sharma"); s.assign("ADMIN","AU1","J. Mehta"); s.unassign("ADMIN","AU1");
const au=s.listAudit();
ck("three events recorded", au.length===3, String(au.length));
ck("actor recorded", au.every(e=>e.actor==="ADMIN"));
ck("timestamp valid", au.every(e=>!isNaN(Date.parse(e.at))));
ck("ids unique", new Set(au.map(e=>e.id)).size===3);
const re=au.find(e=>e.action==="reassigned");
ck("reassign records from AND to", re.previousAnalyst==="A. Sharma" && re.newAnalyst==="J. Mehta");
const un=au.find(e=>e.action==="unassigned");
ck("unassign records previous analyst", un.previousAnalyst==="J. Mehta" && un.newAnalyst===null);
s.addAnalyst("ADMIN","T. Test"); s.removeAnalyst("ADMIN","T. Test");
ck("analyst_added audited", s.listAudit().some(e=>e.action==="analyst_added"));
ck("analyst_removed audited", s.listAudit().some(e=>e.action==="analyst_removed"));
ck("round_robin audited", (()=>{const q=svc(); q.roundRobin("ADMIN","R1"); return q.listAudit()[0].action==="round_robin_assigned";})());

console.log("\nSTORAGE ABSTRACTION (Phase 21 swap)");
ck("AssignmentService takes a storage interface", svc() instanceof AssignmentService);
ck("InMemoryStorage is replaceable", typeof InMemoryStorage==="function");
const proto=Object.getOwnPropertyNames(InMemoryStorage.prototype);
for(const m of ["listAnalysts","upsertAnalyst","listAssignments","getAssignment","putAssignment","appendAudit","listAudit","getRoundRobinIndex","setRoundRobinIndex"])
  ck("storage implements "+m, proto.includes(m));

console.log("\n================ "+p+" passed, "+f+" failed ================");
process.exit(f?1:0);
