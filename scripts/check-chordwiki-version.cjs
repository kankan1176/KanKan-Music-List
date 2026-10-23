'use strict';
const assert=require('node:assert/strict'),wiki=require('../chordwiki-version.js'),share=require('../list-share-core.js');
const title='C%2B%2B+Song',normal='https://ja.chordwiki.org/wiki/'+title,beta='https://beta.chordwiki.org/wiki/'+title;
assert.equal(wiki.url(normal,'beta'),beta);assert.equal(wiki.url(beta,'normal'),normal);
assert.equal(wiki.url(normal+'?a=%2B#part','beta'),beta+'?a=%2B#part');
assert.equal(wiki.link(normal,0,'beta'),beta);
assert.equal(wiki.url('https://ja.chordwiki.org/wiki/Some Song','beta'),'https://beta.chordwiki.org/wiki/Some Song');
for(const key of [-5,-1,1,6]){
 const url=new URL(wiki.link(normal,key,'beta'));assert.equal(url.hostname,'beta.chordwiki.org');assert.equal(url.searchParams.get('t'),'C++ Song');assert.equal(url.searchParams.get('key'),String(key));
 assert.equal(wiki.url(url.href,'normal'),url.href.replace('beta.','ja.'));
}
assert.equal(new URL(wiki.link('https://ja.chordwiki.org/wiki.cgi?c=view&t=Song%2BName&key=2',-3,'beta')).searchParams.get('t'),'Song+Name');
for(const unsafe of ['javascript:alert(1)','http://ja.chordwiki.org/wiki/Test','https://ja.chordwiki.org.evil.test/wiki/Test','https://ja.chordwiki.org@evil.test/wiki/Test','https://user@ja.chordwiki.org/wiki/Test','https://ja.chordwiki.org:444/wiki/Test','https:ja.chordwiki.org/wiki/Test','https://ja.chordwiki.org\\@evil.test/wiki/Test'])assert.equal(wiki.url(unsafe,'beta'),'');
assert.equal(wiki.link(normal,7,'beta'),'');assert.equal(wiki.link(normal,0,'unknown'),normal);
assert.equal(share.link(normal,2,'beta'),wiki.link(normal,2,'beta'));assert.equal(share.link(beta,0,'normal'),normal);
const master={title:'Song',chordwiki:normal};assert.equal(share.song(master,{},{showKey:true}).url,normal);assert.equal(master.chordwiki,normal);
const {mergeFreeRules}=require('./free-control-rules.cjs'),original={rules:{'.read':false,'.write':false,users:{$uid:{preferences:{theme:{'.validate':'newData.isString()'},'$other':{'.validate':false}}}}}};
const rules=mergeFreeRules(original);assert.equal(rules.rules.users.$uid.preferences.theme['.validate'],'newData.isString()');assert.equal(rules.rules.users.$uid.preferences.$other['.validate'],false);assert.match(rules.rules.users.$uid.preferences.chordwikiVersion['.validate'],/google.com/);assert.deepEqual(mergeFreeRules(rules),rules);
console.log('PASS: normal/beta URL selection, encoded titles, transposition bounds, hostile URL denial, canonical public metadata and isolated preference rules.');
