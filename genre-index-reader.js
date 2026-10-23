/* Read field-specific genre intersections using only permitted, bounded queries. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SLGenreIndex=api;})(typeof globalThis==='object'?globalThis:this,()=>{
 'use strict';
 const LIMIT=100;
 const encode=value=>Array.from(new TextEncoder().encode(value)).map(n=>n.toString(16).padStart(2,'0')).join('');
 async function page(database,indexKey,selected,{after='',pageSize=100,current=()=>true}={}){
  if(!indexKey||!Number.isInteger(pageSize)||pageSize<1||pageSize>LIMIT)throw Error('Invalid genre page');
  const choices=Object.entries(selected).filter(([field,value])=>/^genre[1-5]$/.test(field)&&typeof value==='string'&&value);
  if(!choices.length)throw Error('No genre selection');
  function check(){if(!current()){const error=Error('Genre selection changed');error.code='genre/cancelled';throw error;}}
  const streams=choices.map(([field,value])=>({ref:database.ref('songGenreRows/'+indexKey+'/'+encode(field+'::'+value)),rows:[],position:0,last:after,exhausted:false}));
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
  const rows=[];let target='';
  for(;;){
   const heads=await Promise.all(streams.map(stream=>ensure(stream,target)));check();
   if(heads.some(head=>!head))return{rows,hasNext:false,cursor:rows.at(-1)?.key||after};
   target=heads.reduce((key,head)=>head.key>key?head.key:key,'');
   if(!heads.every(head=>head.key===target))continue;
   const id=heads[0].id;
   if(/^[A-Za-z0-9_-]{1,80}$/.test(id)&&heads.every(head=>head.id===id)){
    if(rows.length===pageSize)return{rows,hasNext:true,cursor:rows.at(-1).key};
    rows.push({key:target,id});
   }
   for(const stream of streams)stream.position++;
   target='';
  }
 }
 return{page,LIMIT,encode};
});
