const {handleAssignmentRoute}=require("../server/dist/server/src/assignmentRoutes.js");
const {AssignmentService,InMemoryStorage}=require("../server/dist/server/src/assignmentStore.js");
let p=0,f=0; const ck=(n,c,d="")=>{c?(p++,console.log("  PASS  "+n)):(f++,console.log("  FAIL  "+n+(d?" -> "+d:"")))};
const ADMIN={email:"admin@socgenie.demo",role:"admin"};
const ANALYST={email:"analyst@socgenie.demo",role:"analyst"};
const call=(svc,url,method,claims,body)=>handleAssignmentRoute({url,method,claims,body},svc);
const fresh=()=>new AssignmentService(new InMemoryStorage());

console.log("ANALYST IS REJECTED ON EVERY WRITE (403)");
const writes=[
 ["assign","/api/assignments","POST",{alertRef:"ALT-1",analyst:"A. Sharma"}],
 ["reassign","/api/assignments","PUT",{alertRef:"ALT-1",analyst:"J. Mehta"}],
 ["unassign","/api/assignments","DELETE",{alertRef:"ALT-1"}],
 ["round-robin","/api/assignments/round-robin","POST",{alertRef:"ALT-1"}],
 ["add analyst","/api/analysts","POST",{name:"X. Test"}],
 ["remove analyst","/api/analysts","DELETE",{name:"A. Sharma"}],
];
for(const [label,url,method,body] of writes){
  const r=call(fresh(),url,method,ANALYST,body);
  ck("analyst "+label+" -> 403", r.status===403 && r.payload.code==="FORBIDDEN", "status="+r.status);
}
console.log("\nANALYST WRITE HAS NO EFFECT ON STATE");
const s1=fresh();
call(s1,"/api/assignments","POST",ANALYST,{alertRef:"ALT-X",analyst:"A. Sharma"});
ck("no assignment was created", s1.listAssignments().length===0, String(s1.listAssignments().length));
ck("no audit event was written", s1.listAudit().length===0);

console.log("\nUNAUTHENTICATED IS REJECTED (401)");
for(const [label,url,method,body] of writes){
  const r=call(fresh(),url,method,null,body);
  ck("anon "+label+" -> 401", r.status===401, "status="+r.status);
}
ck("anon read -> 401", call(fresh(),"/api/assignments","GET",null,{}).status===401);

console.log("\nADMIN SUCCEEDS ON EVERY WRITE");
const s=fresh();
ck("assign -> 200", call(s,"/api/assignments","POST",ADMIN,{alertRef:"ALT-1",analyst:"A. Sharma"}).status===200);
ck("reassign -> 200", call(s,"/api/assignments","PUT",ADMIN,{alertRef:"ALT-1",analyst:"J. Mehta"}).status===200);
const un=call(s,"/api/assignments","DELETE",ADMIN,{alertRef:"ALT-1"});
ck("unassign -> 200 and null", un.status===200 && un.payload.assignment.assignedTo===null);
ck("round-robin -> 200", call(s,"/api/assignments/round-robin","POST",ADMIN,{alertRef:"ALT-2"}).status===200);
ck("add analyst -> 200", call(s,"/api/analysts","POST",ADMIN,{name:"N. Rao"}).status===200);
ck("remove analyst -> 200", call(s,"/api/analysts","DELETE",ADMIN,{name:"N. Rao"}).status===200);

console.log("\nANALYST CAN READ THEIR QUEUE");
const rd=call(s,"/api/assignments","GET",ANALYST,{});
ck("analyst GET assignments -> 200", rd.status===200);
ck("payload carries workload", Array.isArray(rd.payload.workload));
ck("analyst GET analysts -> 200", call(s,"/api/analysts","GET",ANALYST,{}).status===200);
ck("analyst CANNOT read audit -> 403", call(s,"/api/assignments/audit","GET",ANALYST,{}).status===403);
ck("admin CAN read audit -> 200", call(s,"/api/assignments/audit","GET",ADMIN,{}).status===200);

console.log("\nVALIDATION");
ck("missing alertRef -> 400", call(fresh(),"/api/assignments","POST",ADMIN,{analyst:"A. Sharma"}).status===400);
ck("missing analyst -> 400", call(fresh(),"/api/assignments","POST",ADMIN,{alertRef:"A"}).status===400);
ck("empty string rejected", call(fresh(),"/api/assignments","POST",ADMIN,{alertRef:"A",analyst:"   "}).status===400);
ck("oversized name rejected", call(fresh(),"/api/analysts","POST",ADMIN,{name:"x".repeat(200)}).status===400);
ck("unknown analyst -> 400", call(fresh(),"/api/assignments","POST",ADMIN,{alertRef:"A",analyst:"Ghost"}).status===400);
const z=fresh(); for(const n of ["A. Sharma","J. Mehta","R. Fernandes","K. Iyer"]) z.removeAnalyst("ADMIN",n);
const rr=call(z,"/api/assignments/round-robin","POST",ADMIN,{alertRef:"A"});
ck("zero analysts -> 409 not 500", rr.status===409 && rr.payload.code==="NO_ACTIVE_ANALYSTS", "status="+rr.status);

console.log("\nROUTING");
ck("non-assignment url falls through (null)", handleAssignmentRoute({url:"/api/health",method:"GET",claims:ADMIN,body:{}},fresh())===null);
ck("bad method -> 405", call(fresh(),"/api/assignments","PATCH",ADMIN,{}).status===405);
ck("no secret in any error payload",
   writes.every(([,url,method,body])=>{const r=call(fresh(),url,method,ANALYST,body);
     return !/key|token|secret|bearer/i.test(JSON.stringify(r.payload));}));

console.log("\n================ "+p+" passed, "+f+" failed ================");
process.exit(f?1:0);
