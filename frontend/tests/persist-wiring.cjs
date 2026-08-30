/* Models startPersistence(): hydrate-then-subscribe, debounced, idempotent. */
let p=0,f=0; const ck=(n,c,d="")=>{c?(p++,console.log("  PASS  "+n)):(f++,console.log("  FAIL  "+n+(d?" -> "+d:"")))};
function makeStore(seed){let rows=[...seed],subs=new Set();
  return {getSnapshot:()=>rows, subscribe(l){subs.add(l); return ()=>subs.delete(l);},
    replaceAll(n){rows=[...n]; subs.forEach(l=>l()); return rows.length;},
    mutate(fn){rows=fn(rows); subs.forEach(l=>l());}, subCount:()=>subs.size};}

let server={alerts:[],incidents:[]}, pushes=0;
const api={ list:k=>[...server[k]],
  save:(k,items)=>{pushes++; for(const it of items){const i=server[k].findIndex(x=>x.ref===it.ref);
    if(i===-1) server[k].push({...it}); else server[k][i]={...it};}} };

let ready=false, detach=[];
function debounce(fn,ms){let t=null; const d=()=>{if(t)clearTimeout(t); t=setTimeout(fn,ms);}; d.flush=()=>{if(t){clearTimeout(t);t=null;fn();}}; return d;}
async function start(store,key){
  detach.forEach(o=>o()); detach=[]; ready=false;
  const persisted=api.list(key);
  if(persisted.length>0) store.replaceAll(persisted);
  else if(store.getSnapshot().length>0) api.save(key,store.getSnapshot());
  ready=true;
  const push=debounce(()=>{ if(ready) api.save(key,store.getSnapshot()); },10);
  detach.push(store.subscribe(push));
  return push;
}

(async()=>{
console.log("HYDRATE BEFORE SUBSCRIBE");
server={alerts:[],incidents:[]}; pushes=0;
let st=makeStore([{ref:"A1",status:"open"},{ref:"A2",status:"open"}]);
let push=await start(st,"alerts");
ck("empty server -> local seed uploaded", server.alerts.length===2, String(server.alerts.length));
ck("exactly one push during hydration", pushes===1, String(pushes));
ck("one subscriber attached", st.subCount()===1);

console.log("\nHYDRATION DOES NOT ECHO BACK");
server={alerts:[{ref:"A1",status:"resolved"}],incidents:[]}; pushes=0;
st=makeStore([{ref:"A1",status:"open"},{ref:"A2",status:"open"}]);
push=await start(st,"alerts");
ck("server records win", st.getSnapshot().length===1 && st.getSnapshot()[0].status==="resolved",
   JSON.stringify(st.getSnapshot()));
ck("replaceAll did NOT trigger a push", pushes===0, String(pushes));
ck("local seed NOT merged in", !st.getSnapshot().some(r=>r.ref==="A2"));

console.log("\nMUTATION REACHES THE API");
st.mutate(rows=>rows.map(r=>({...r,status:"investigating"})));
push.flush();
ck("mutation pushed", server.alerts[0].status==="investigating", JSON.stringify(server.alerts[0]));

console.log("\nDEBOUNCE");
pushes=0;
for(let i=0;i<8;i++) st.mutate(rows=>rows.map(r=>({...r,status:"s"+i})));
ck("8 rapid mutations queued, not sent yet", pushes===0, String(pushes));
push.flush();
ck("collapsed into ONE push", pushes===1, String(pushes));
ck("final state persisted", server.alerts[0].status==="s7", server.alerts[0].status);

console.log("\nREPEATED START IS IDEMPOTENT");
for(let i=0;i<4;i++) await start(st,"alerts");
ck("still exactly 1 subscriber", st.subCount()===1, String(st.subCount()));
ck("no duplicate records", server.alerts.length===1, String(server.alerts.length));

console.log("\nSTOP DETACHES");
detach.forEach(o=>o()); detach=[]; ready=false;
pushes=0; st.mutate(rows=>[...rows]);
await new Promise(r=>setTimeout(r,30));
ck("no push after stop", pushes===0, String(pushes));
ck("no subscribers left", st.subCount()===0);

console.log("\nGUARD: no push before hydration completes");
ready=false; pushes=0;
const d2=debounce(()=>{ if(ready) pushes++; },5); d2(); d2.flush();
ck("pre-hydration push suppressed", pushes===0);

console.log("\n================ "+p+" passed, "+f+" failed ================");
process.exit(f?1:0);
})();
