const fs=require("fs"), {DatabaseSync}=require("node:sqlite");
const P="/tmp/soc21d.db";
const {SqliteStorage}=require("../server/dist/server/src/sqliteStorage.js");
const {SocDataStore}=require("../server/dist/server/src/socData.js");
const {handleSocRoute}=require("../server/dist/server/src/socRoutes.js");
let p=0,f=0; const ck=(n,c,d="")=>{c?(p++,console.log("  PASS  "+n)):(f++,console.log("  FAIL  "+n+(d?" -> "+d:"")))};
const wipe=()=>{for(const s of ["","-wal","-shm"]) try{fs.unlinkSync(P+s)}catch{}};
const U={email:"a@socgenie.demo",role:"analyst"};
function boot(){const st=new SqliteStorage(P),db=new DatabaseSync(P),soc=new SocDataStore(db);
  return {db,soc,api:(u,m,b)=>handleSocRoute({url:u,method:m,claims:U,body:b},soc)};}

// Mirrors socStoreSync.hydrate*/push* exactly, against the real API+DB.
const nul=v=>{const s=typeof v==="string"?v.trim():""; return s===""?null:s;};
async function hydrateIncidents(b, localSeed){
  const persisted=b.api("/api/incidents","GET",{}).payload.incidents;
  if(persisted.length>0) return {store:persisted.map(r=>({...r,assignedTo:nul(r.assignedTo)})),seeded:false};
  for(const i of localSeed) b.api("/api/incidents","POST",i);
  return {store:localSeed,seeded:localSeed.length>0};
}

wipe(); let b=boot();
console.log("INCIDENT HYDRATION");
const seed=[{ref:"INC-1",title:"Seed one",severity:"high",status:"new",assignedTo:null,alertRefs:["ALT-1"],notes:[],activity:[]},
            {ref:"INC-2",title:"Seed two",severity:"medium",status:"new",assignedTo:"A. Sharma",alertRefs:[],notes:[],activity:[]}];
(async()=>{
let h=await hydrateIncidents(b,seed);
ck("empty DB -> local seed uploaded", h.seeded===true);
ck("2 incidents now persisted", b.api("/api/incidents","GET",{}).payload.incidents.length===2);

b.db.close(); b=boot();                                     // ← RELOAD
h=await hydrateIncidents(b,seed);
ck("second hydration reads DB, does NOT reseed", h.seeded===false);
ck("still exactly 2 — no duplicates", b.api("/api/incidents","GET",{}).payload.incidents.length===2,
   String(b.api("/api/incidents","GET",{}).payload.incidents.length));

console.log("\nMUTATION REACHES THE API");
const inc=b.api("/api/incidents","GET",{}).payload.incidents.find(i=>i.ref==="INC-1");
b.api("/api/incidents","POST",{...inc,status:"contained",severity:"critical",
  notes:[{by:"A. Sharma",text:"contained"}],activity:[{actor:"M. Raghavan",action:"updated"}]});
b.db.close(); b=boot();                                     // ← RELOAD
const after=b.api("/api/incidents","GET",{}).payload.incidents.find(i=>i.ref==="INC-1");
ck("status change persisted", after.status==="contained", after.status);
ck("severity change persisted", after.severity==="critical");
ck("notes persisted", after.notes.length===1);
ck("activity persisted", after.activity.length===1);
ck("linked alerts intact", after.alertRefs.includes("ALT-1"));
ck("NOT reverted to seed", after.status!=="new");

console.log("\nREPEATED HYDRATION DOES NOT DUPLICATE");
for(let i=0;i<3;i++){ b.db.close(); b=boot(); await hydrateIncidents(b,seed); }
ck("still 2 after 3 more hydrations", b.api("/api/incidents","GET",{}).payload.incidents.length===2,
   String(b.api("/api/incidents","GET",{}).payload.incidents.length));

console.log("\nINVESTIGATION HYDRATION");
b.api("/api/alerts","POST",{alerts:[{ref:"ALT-1",title:"a",severity:"high",riskScore:50,
  status:"open",detectionSource:"rule",minutesAgo:1,evidence:[],notes:[]}]});
b.api("/api/investigations/ALT-1","PUT",{status:"investigating",assignedTo:"J. Mehta",
  activity:[{actor:"J. Mehta",action:"opened"}]});
b.db.close(); b=boot();                                     // ← RELOAD
let iv=b.api("/api/investigations","GET",{}).payload.investigations;
ck("investigation hydrates from API", iv.length===1);
ck("status restored", iv[0].status==="investigating");
ck("assignee restored", iv[0].assignedTo==="J. Mehta");
ck("activity restored", iv[0].activity.length===1);

console.log("\nNULL ASSIGNEE IS NEVER SUBSTITUTED");
b.api("/api/investigations/ALT-1","PUT",{status:"open",assignedTo:null,activity:[]});
b.db.close(); b=boot();
iv=b.api("/api/investigations","GET",{}).payload.investigations;
ck("null stays null after reload", iv[0].assignedTo===null, JSON.stringify(iv[0].assignedTo));
ck("viewer identity NOT substituted", iv[0].assignedTo!=="a@socgenie.demo" && iv[0].assignedTo!=="A. Sharma");
b.api("/api/investigations/ALT-1","PUT",{status:"open",assignedTo:"   ",activity:[]});
b.db.close(); b=boot();
ck('whitespace assignee -> null', b.api("/api/investigations","GET",{}).payload.investigations[0].assignedTo===null);
b.api("/api/incidents","POST",{ref:"INC-3",title:"t",assignedTo:""});
ck('incident "" -> null', b.api("/api/incidents","GET",{}).payload.incidents.find(i=>i.ref==="INC-3").assignedTo===null);

console.log("\nSERVER RESTART — everything together");
const counts={inc:b.api("/api/incidents","GET",{}).payload.incidents.length,
              iv:b.api("/api/investigations","GET",{}).payload.investigations.length,
              al:b.api("/api/alerts","GET",{}).payload.alerts.length};
b.db.close(); b=boot(); b.db.close(); b=boot();
ck("incidents survive", b.api("/api/incidents","GET",{}).payload.incidents.length===counts.inc);
ck("investigations survive", b.api("/api/investigations","GET",{}).payload.investigations.length===counts.iv);
ck("alerts survive", b.api("/api/alerts","GET",{}).payload.alerts.length===counts.al);
b.db.close(); wipe();
console.log("\n================ "+p+" passed, "+f+" failed ================");
process.exit(f?1:0);
})();
