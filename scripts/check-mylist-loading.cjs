const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../mylist-loading.js'),'utf8');
function fixture(){
 const nodes=Object.fromEntries(['listLoading','listLoadingTitle','listLoadingHint','listLoadingRetry','main'].map(id=>[id,{hidden:false,inert:true,classList:{toggle(){}},setAttribute(){},removeAttribute(){}}]));
 const events={},frames=new Map(),timers=new Map();let serial=0,reloads=0;
 const document={documentElement:{lang:'ja',classList:{remove(){},add(){}}},getElementById:id=>nodes[id],querySelector:selector=>selector==='main'?nodes.main:null,fonts:{ready:Promise.resolve()},addEventListener:(type,fn)=>events[type]=fn};
 const window={addEventListener:(type,fn)=>events[type]=fn};
 vm.runInNewContext(source,{window,document,navigator:{language:'ja'},location:{hash:'#mine',reload:()=>reloads++},Set,setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id)});
 return{nodes,events,window,timers,get reloads(){return reloads;},flush(){for(const[id,fn]of frames){frames.delete(id);fn();}}};
}
(async()=>{
 const f=fixture(),loader=f.window.SLListLoading;
 await f.events.DOMContentLoaded();loader.actions();const background=loader.hold(),genres=loader.hold();loader.state('ready');f.flush();assert.equal(f.nodes.listLoading.hidden,false);
 background();background();f.flush();assert.equal(f.nodes.listLoading.hidden,false,'double release must not finish another resource');genres();f.flush();assert.equal(f.nodes.listLoading.hidden,true);assert.equal(f.nodes.main.inert,false);assert.equal(f.timers.size,0);
 loader.state('loading');f.flush();assert.equal(f.nodes.listLoading.hidden,true,'live updates and pagination do not flash a loader');
 loader.reset();assert.equal(f.nodes.listLoading.hidden,false);assert.equal(f.nodes.main.inert,true);loader.state('login');f.flush();assert.equal(f.nodes.listLoading.hidden,true,'signed-out state is reachable');
 for(const failure of ['loadError','refreshError','timeout','script']){
  const g=fixture();await g.events.DOMContentLoaded();g.window.SLListLoading.actions();if(failure==='timeout')[...g.timers.values()][0]();else if(failure==='script')g.events.error({target:{tagName:'SCRIPT'}});else g.window.SLListLoading.state(failure);
  g.window.SLListLoading.state('ready');g.flush();assert.equal(g.nodes.listLoading.hidden,false);assert.equal(g.nodes.listLoadingRetry.hidden,false);assert.equal(g.nodes.main.inert,true);g.nodes.listLoadingRetry.onclick();assert.equal(g.reloads,1);
 }
 console.log('PASS loading: all resources required, duplicate completion safe, auth reset, terminal login, timeout/script/data failures and reload');
})().catch(error=>{console.error(error);process.exitCode=1;});
