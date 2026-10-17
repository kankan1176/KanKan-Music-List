const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
let callback,listeners=[],applied=[];
const context={console,auth:{currentUser:null,onAuthStateChanged(fn){callback=fn}},db:{ref(path){return{on(event,fn){listeners.push({path,fn})},off(event,fn){listeners=listeners.filter(x=>x.fn!==fn)}}}},signedInUser:null,myName:'Old',usernameLoadVersion:0,applyUsername(name){context.myName=name;applied.push(name)}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../account-display-name.js'),'utf8'),context);
function login(uid,guest=false){context.auth.currentUser={uid,isAnonymous:guest};context.signedInUser=guest?null:context.auth.currentUser;callback(context.auth.currentUser)}
login('member');assert.equal(listeners.length,1);const stale=listeners[0].fn;
stale({val:()=> '変更名'});assert.equal(context.myName,'変更名');assert.equal(context.usernameLoadVersion,1);
stale({val:()=> '変更名'});assert.equal(applied.length,1);
for(const name of ['',null,'x'.repeat(41),'bad\nname'])stale({val:()=>name});assert.equal(applied.length,1);
login('other');assert.equal(listeners.length,1);stale({val:()=> '旧アカウント'});assert.equal(context.myName,'変更名');
listeners[0].fn({val:()=> '次回アクセス名'});assert.equal(context.myName,'次回アクセス名');
login('guest',true);assert.equal(listeners.length,0);callback(null);assert.equal(listeners.length,0);
console.log('PASS: Google display-name live updates, duplicate/invalid values ignored, old account callbacks detached, guest/login isolation.');
