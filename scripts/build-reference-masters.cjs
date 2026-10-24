'use strict';
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
const vtubers=JSON.parse(fs.readFileSync(path.join(root,'data/reference-masters/vtubers.json'),'utf8'));
require('../artist-classification.js');
const output='/* Generated from data/reference-masters/vtubers.json. Do not edit by hand. */\n(function(root){root.SLVtuberMaster='+JSON.stringify(vtubers)+';})(typeof globalThis!==\'undefined\'?globalThis:this);\n';
const destination=path.join(root,'vtuber-master.js');
if(process.argv.includes('--check')){if(fs.readFileSync(destination,'utf8')!==output)throw Error('VTuber browser master is stale');}
else fs.writeFileSync(destination,output);
console.log('PASS: VTuber JSON and browser snapshot agree ('+vtubers.entries.length+' rows).');

const sort=JSON.parse(fs.readFileSync(path.join(root,'data/reference-masters/sort-master.json'),'utf8'));
const definitions=sort.rows.map(row=>({id:row[0],field:row[1],label:row[2],group:row[3],groupOrder:Number(row[4]),order:Number(row[5]),name:row[6],aliases:row[7].split('、').filter(Boolean),categories:row[8].split('、').filter(Boolean),enabled:row[9]==='TRUE'}));
for(const row of sort.overrides||[])if(!definitions.some(prior=>prior.id===row.id||prior.field===row.field&&prior.name===row.name))definitions.push(row);
const sortPath=path.join(root,'sort-master.js'),priorSort=fs.readFileSync(sortPath,'utf8');
const legacy=" // Additional registration category requested on 2026-10-24.\n definitions.push({id:'publisher_other_kirara',field:'genre5',label:'掲載媒体・関連作品',group:'その他',groupOrder:3,order:1,name:'まんがタイムきらら',aliases:['まんがタイムきらら'],categories:['アニソン'],enabled:true});\n";
const nextSort=priorSort.replace(/ const definitions=\[[\s\S]*?\n\];/, ' const definitions='+JSON.stringify(definitions,null,1)+';').replace(legacy,'');
if(process.argv.includes('--check')){if(priorSort!==nextSort)throw Error('Sort browser master is stale');}else fs.writeFileSync(sortPath,nextSort);
const producers=JSON.parse(fs.readFileSync(path.join(root,'data/reference-masters/vocaloid-producers.json'),'utf8'));if(!producers.entries.length||producers.entries.some(row=>!row.name))throw Error('Invalid producer master');
console.log('PASS: sort JSON and browser choices agree; '+definitions.length+' choices and '+producers.entries.length+' producer rows.');
