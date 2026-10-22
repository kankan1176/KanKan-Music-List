'use strict';
const GOOGLE="auth != null && auth.token.firebase.sign_in_provider === 'google.com'";
const EXISTING_OR_GOOGLE='data.exists() || ('+GOOGLE+')';
function and(old,guard){if(old===false||old==='false')return old;if(old===true||old==='true'||old===undefined)return guard;if(typeof old!=='string')throw Error('Unsupported access rule');return old===guard||old.endsWith(' && ('+guard+')')?old:'('+old+') && ('+guard+')';}
function privatePermissions(node){if(!node||typeof node!=='object')return;for(const key of Object.keys(node)){if(key==='.read'||key==='.write')node[key]=and(node[key],GOOGLE);else if(!key.startsWith('.'))privatePermissions(node[key]);}}
function addAccountFeatureRules(document){
 const out=structuredClone(document),r=out.rules,rooms=r.rooms ||= {},wildcards=Object.keys(rooms).filter(k=>k.startsWith('$'));
 if(wildcards.length>1)throw Error('Unexpected room wildcard rules');
 const room=rooms[wildcards[0]||'$roomId'] ||= {};
 // Validation also runs for descendant writes, without widening existing permissions.
 room['.validate']=and(room['.validate'],EXISTING_OR_GOOGLE);
 const settings=room.settings ||= {};settings['.validate']=and(settings['.validate'],EXISTING_OR_GOOGLE);
 for(const name of ['userFavorites','userFavoriteMigrations','friendCodes','friendRequests','friendships','follows','songAddRequests'])privatePermissions(r[name]);
 return out;
}
module.exports={addAccountFeatureRules};
