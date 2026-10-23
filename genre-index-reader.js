/* Read field-specific genre intersections using only permitted, bounded queries. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./sort-master.js'):root.SLSortMaster);if(typeof module==='object'&&module.exports)module.exports=api;else root.SLGenreIndex=api;})(typeof globalThis==='object'?globalThis:this,master=>{
 'use strict';
 const LIMIT=100;
 const encode=value=>Array.from(new TextEncoder().encode(value)).map(n=>n.toString(16).padStart(2,'0')).join('');
 async function page(database,indexKey,selected,{after='',pageSize=100,current=()=>true}={}){
  if(!indexKey||!Number.isInteger(pageSize)||pageSize<1||pageSize>LIMIT)throw Error('Invalid genre page');
  const choices=Object.entries(selected).filter(([field,value])=>['genre1','genre2','genre3','genre4','genre5','genre6','vocal_synths','release_year','anime_year'].includes(field)&&typeof value==='string'&&value);
  if(!choices.length)throw Error('No genre selection');
  function check(){if(!current()){const error=Error('Genre selection changed');error.code='genre/cancelled';throw error;}}
  // Union aliases within a field, then intersect the selected fields.
  const groups=choices.map(([field,value])=>(master?.fields.includes(field)?master.aliases(field,value):[value]).map(alias=>({ref:database.ref('songGenreRows/'+indexKey+'/'+encode(field+'::'+alias)),rows:[],position:0,last:after,exhausted:false})));
  async function ensure(stream,target){
   check();
   while(stream.position<stream.rows.length&&stream.rows[stream.position].key<target)stream.position++;
   if(stream.position<stream.rows.length)return stream.rows[stream.position];
   if(stream.exhausted)return null;
   let query=stream.ref.orderByKey();
   if(target&&target>stream.last)query=query.startAt(target);
   else if(stream.last)query=query.startAfter(stream.last);
   const snapshot=await query.limitToFirst(LIMIT).once('value');check();
   const rows=[];snapshot.forEach(child=>{rows.push({key:child.key,id:child.val()});});
   stream.rows=rows;stream.position=0;stream.exhausted=rows.length<LIMIT;
   if(rows.length)stream.last=rows.at(-1).key;
   return rows[0]||null;
  }
  async function groupHead(group,target){
   const heads=(await Promise.all(group.map(stream=>ensure(stream,target)))).filter(Boolean);
   return heads.reduce((first,head)=>!first||head.key<first.key?head:first,null);
  }
  function advance(group,key){for(const stream of group)if(stream.rows[stream.position]?.key===key)stream.position++;}
  const rows=[];let target='';
  for(;;){
   const heads=await Promise.all(groups.map(group=>groupHead(group,target)));check();
   if(heads.some(head=>!head))return{rows,hasNext:false,cursor:rows.at(-1)?.key||after};
   target=heads.reduce((key,head)=>head.key>key?head.key:key,'');
   if(!heads.every(head=>head.key===target))continue;
   const id=heads[0].id;
   if(/^[A-Za-z0-9_-]{1,80}$/.test(id)&&heads.every(head=>head.id===id)){
    if(rows.length===pageSize)return{rows,hasNext:true,cursor:rows.at(-1).key};
    rows.push({key:target,id});
   }
   for(const group of groups)advance(group,target);
   target='';
  }
 }
 return{page,LIMIT,encode};
});
