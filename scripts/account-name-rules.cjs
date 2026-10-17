'use strict';
const ADMIN="auth != null && auth.token.firebase.sign_in_provider === 'google.com' && root.child('admins').child(auth.uid).val() === true";
const ACCOUNT="(root.child('publicProfiles').child($uid).exists() || root.child('adminClientControl/clients').child($uid).child('kind').val() === 'account')";
const NAME="newData.isString() && newData.val().length >= 1 && newData.val().length <= 40 && newData.val().matches(/^[^\\x00-\\x1f\\x7f]+$/) && newData.val().matches(/.*[^ \\xa0　].*/)";
function grant(old, added){if(old===true||old==='true')return old;if(old===undefined||old===false||old==='false')return added;if(typeof old!=='string')throw Error('未対応のルール形式です。');return old.includes(added)?old:`(${old}) || (${added})`;}
function addAccountNameRules(document){
 const rules=document.rules;
 for(const base of ['users','publicProfiles','friendProfiles']){
  const owner=(rules[base] ||= {}).$uid ||= {};
  const parent=base==='users'?(owner.profile ||= {}):owner;
  const field=parent.displayName ||= {};
  field['.read']=grant(field['.read'],`(${ADMIN}) && (${ACCOUNT})`);
  field['.write']=grant(field['.write'],`(${ADMIN}) && (${ACCOUNT}) && (${NAME})${base==='users'?'':' && data.exists()'}`);
 }
 return document;
}
module.exports={addAccountNameRules};
