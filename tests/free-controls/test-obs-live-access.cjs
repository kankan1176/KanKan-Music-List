'use strict';const fs=require('node:fs'),{initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing'),{ref,set,get,update,serverTimestamp}=require('firebase/database');
(async()=>{const rules=fs.readFileSync(process.env.OBS_RULE_TEST,'utf8');const env=await initializeTestEnvironment({projectId:'demo-free-controls',database:{host:'127.0.0.1',port:9000,rules}});try{await env.withSecurityRulesDisabled(async c=>{const db=c.database();await set(ref(db,'rooms/OBSDEMO'),{settings:{createdAt:Date.now(),expiresAt:Date.now()+3600000},members:{session:{uid:'member',name:'Test',guest:false,lastSeen:Date.now()}},queue:{one:{songId:'test-song',status:'completed',order:1}}});await set(ref(db,'songs/test-song'),{title:'Test',artist:'Artist'});});const member=env.authenticatedContext('member',{firebase:{sign_in_provider:'google.com'}}).database();await assertSucceeds(update(ref(member,'rooms/OBSDEMO/members/session'),{defaultPart:'🎸'}));await assertSucceeds(set(ref(member,'rooms/OBSDEMO/members/new-session'),{uid:'member',name:'Test',guest:false,defaultPart:'🎸',lastSeen:serverTimestamp()}));const guest=env.authenticatedContext('obs-viewer',{firebase:{sign_in_provider:'anonymous'}}).database();for(const path of ['rooms/OBSDEMO/members','rooms/OBSDEMO/queue','rooms/OBSDEMO/settings','songs/test-song'])await assertSucceeds(get(ref(guest,path)));await assertFails(get(ref(guest,'users/member')));
 const scene={theme:'dark',roomName:'Google broadcast',description:'',host:'member',speed:25,font:'system',updatedAt:serverTimestamp()};
 await assertSucceeds(set(ref(member,'obsScenes/OBSDEMO/member'),scene));
 await assertSucceeds(get(ref(env.unauthenticatedContext().database(),'obsScenes/OBSDEMO/member')));
 await assertSucceeds(update(ref(member,'obsScenes/OBSDEMO/member'),{members:{u1:{name:'One',part:'',color:1,order:1},u2:{name:'Two',part:'Drums',color:2,order:0}},updatedAt:serverTimestamp()}));
 await assertSucceeds(get(ref(guest,'obsScenes/OBSDEMO/member')));
 for(const order of [-1,100,1.5,'first'])await assertFails(update(ref(member,'obsScenes/OBSDEMO/member'),{'members/u1/order':order,updatedAt:serverTimestamp()}));
 console.log('PASS: Google broadcaster member order persists and is public to OBS viewers; invalid order values rejected. Synthetic data only.');

 await assertFails(set(ref(guest,'obsScenes/OBSDEMO/obs-viewer'),{...scene,host:'obs-viewer'}));
 const anonymousOwner=env.authenticatedContext('member',{firebase:{sign_in_provider:'anonymous'}}).database();
 await assertFails(update(ref(anonymousOwner,'obsScenes/OBSDEMO/member'),{description:'Blocked',updatedAt:serverTimestamp()}));
 await assertFails(set(ref(anonymousOwner,'obsScenes/OBSDEMO/member'),null));
 console.log('PASS: production-derived OBS settings allow Google owner writes and unauthenticated display, while anonymous create/update/delete are denied. Synthetic data only.');
 console.log('PASS: current production-derived rules permit read-only OBS member/queue/settings/song viewing without room participation; private account data stays inaccessible. Synthetic data only.');}finally{await env.cleanup();}})().catch(()=>{console.error('FAIL: OBS live-access permission assertion. No production data was read.');process.exitCode=1;});

