/* Appearance defaults and JPEG preparation shared by editor and viewer. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SLListDesign=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const presets={dark:{background:'#091322',panel:'#112039',text:'#e9f2ff',muted:'#a8bdd5',border:'#385574',accent:'#73ded9'},light:{background:'#f3f6fb',panel:'#ffffff',text:'#172b43',muted:'#53677e',border:'#b9c8da',accent:'#006c75'}};
 const keys=Object.keys(presets.dark);
 function normalize(value={}){const preset=value?.preset==='light'?'light':'dark',out={preset,title:String(value?.title||'').trim().slice(0,100),overlay:Math.max(0,Math.min(85,Math.round(Number.isFinite(Number(value?.overlay))?Number(value.overlay):35)))};for(const key of keys)out[key]=/^#[0-9a-f]{6}$/i.test(value?.[key]||'')?value[key]:presets[preset][key];return out;}
 function apply(element,value){const design=normalize(value);for(const key of keys)element.style.setProperty('--share-'+key,design[key]);element.style.setProperty('--share-overlay',String(design.overlay/100));return design;}
 async function jpeg(file){
  if(!file||file.size>16*1024*1024)throw Error('imageSize');
  const head=new Uint8Array(await file.slice(0,3).arrayBuffer());
  if(!/\.jpe?g$/i.test(file.name)||head[0]!==255||head[1]!==216||head[2]!==255)throw Error('imageType');
  let bitmap;
  try{
   if(typeof createImageBitmap==='function')bitmap=await createImageBitmap(file);
   else bitmap=await new Promise((resolve,reject)=>{const image=new Image(),url=URL.createObjectURL(file);image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('imageType'))};image.src=url;});
   const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
   const context=canvas.getContext('2d',{alpha:false}),scale=Math.max(1920/bitmap.width,1080/bitmap.height);
   context.fillStyle='#fff';context.fillRect(0,0,1920,1080);context.drawImage(bitmap,(1920-bitmap.width*scale)/2,(1080-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale);
   for(const quality of [.86,.74,.62,.50,.38,.26,.14,.08]){const data=canvas.toDataURL('image/jpeg',quality);if(data.length<=360000)return data;}
   throw Error('imageCompress');
  }catch(error){if(['imageCompress','imageSize','imageType'].includes(error.message))throw error;throw Error('imageType');}
  finally{bitmap?.close?.();}
 }
 return {presets,keys,normalize,apply,jpeg};
});
