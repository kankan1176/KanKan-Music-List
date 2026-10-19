'use strict';
const uidOK=value=>/^[A-Za-z0-9_-]{1,128}$/.test(value);
const tokenOK=value=>typeof value==='string'&&/^[a-f0-9]{48}$/.test(value);
function selectPublicLinks(configs,publications){
 const changes={};
 for(const[uid,settings]of Object.entries(configs||{})){
  if(!uidOK(uid)||!tokenOK(settings?.token)||settings.enabled===false)continue;
  const record=publications?.[settings.token];if(record?.uid!==uid||record.reserved===true)continue;
  changes['publicListLinks/'+uid]={token:settings.token};
 }
 return changes;
}
async function backfillPublicLinks(database){
 const configs=(await database.ref('userListShares').once('value')).val()||{},publications={};
 // Only inspect owner/reservation flags; do not download song lists or images.
 await Promise.all(Object.entries(configs).filter(([uid,c])=>uidOK(uid)&&tokenOK(c?.token)&&c.enabled!==false).map(async([,c])=>{
  const[uid,reserved]=await Promise.all(['uid','reserved'].map(field=>database.ref('publicListShares/'+c.token+'/'+field).once('value')));publications[c.token]={uid:uid.val(),reserved:reserved.val()};
 }));
 const changes=selectPublicLinks(configs,publications);if(Object.keys(changes).length)await database.ref().update(changes);return Object.keys(changes).length;
}
module.exports={selectPublicLinks,backfillPublicLinks};
