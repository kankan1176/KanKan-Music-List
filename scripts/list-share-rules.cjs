'use strict';
const GOOGLE="auth != null && auth.token.firebase.sign_in_provider === 'google.com'";
function addListShareRules(document){
 const r=document.rules;
 r.userListShares={
  '$uid':{'.read':`(${GOOGLE}) && auth.uid === $uid`,'.write':`(${GOOGLE}) && auth.uid === $uid`,
   '.validate':"newData.hasChildren(['token','showKey','showParts'])",
   token:{'.validate':"newData.isString() && newData.val().matches(/^[a-f0-9]{48}$/) && (!root.child('publicListShares').child(newData.val()).exists() || root.child('publicListShares').child(newData.val()).child('uid').val() === $uid)"},
   showKey:{'.validate':'newData.isBoolean()'},showParts:{'.validate':'newData.isBoolean()'},'$other':{'.validate':false}}
 };
 r.publicListShares={'$token':{
  '.read':"!data.exists() || root.child('userListShares').child(data.child('uid').val()).child('token').val() === $token",
  '.write':`(${GOOGLE}) && $token.matches(/^[a-f0-9]{48}$/) && ((!data.exists() && newData.child('uid').val() === auth.uid) || data.child('uid').val() === auth.uid) && (!newData.exists() || root.child('userListShares').child(auth.uid).child('token').val() === $token)`,
  '.validate':"newData.hasChildren(['uid','name','updatedAt']) && newData.child('uid').val() === auth.uid",
  uid:{'.validate':'newData.isString() && newData.val() === auth.uid'},
  name:{'.validate':'newData.isString() && newData.val().length > 0 && newData.val().length <= 40'},
  updatedAt:{'.validate':'newData.isNumber() && newData.val() <= now'},
  songs:{'$song':{
   '.validate':"$song.matches(/^[A-Za-z0-9_-]{1,80}$/) && newData.hasChildren(['title','artist'])",
   title:{'.validate':'newData.isString() && newData.val().length > 0 && newData.val().length <= 500'},
   artist:{'.validate':'newData.isString() && newData.val().length <= 300'},
   url:{'.validate':"newData.isString() && newData.val().length <= 2048 && newData.val().matches(/^https:\\/\\/(ja\\.)?chordwiki\\.org\\/.*/)"},
   key:{'.validate':"root.child('userListShares').child(auth.uid).child('showKey').val() === true && newData.isNumber() && newData.val() >= -5 && newData.val() <= 6 && newData.val() % 1 === 0"},
   parts:{'.validate':"root.child('userListShares').child(auth.uid).child('showParts').val() === true",'$part':{'.validate':"$part.matches(/^[0-6]$/) && newData.isString() && newData.val().length <= 40"}},
   '$other':{'.validate':false}}},'$other':{'.validate':false}
 }};
 return document;
}
module.exports={addListShareRules};
