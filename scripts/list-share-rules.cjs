'use strict';
const GOOGLE="auth != null && auth.token.firebase.sign_in_provider === 'google.com'";
function addListShareRules(document){
 const r=document.rules;
 const version="newData.isString() && newData.val().matches(/^[a-f0-9]{32}$/)";
 const image="newData.isString() && newData.val().length <= 360000 && newData.val().matches(/^data:image\\/jpeg;base64,[A-Za-z0-9+\\/=]+$/)";
 const colors=Object.fromEntries(['background','panel','text','muted','border','accent','searchText'].map(key=>[key,{'.validate':"newData.isString() && newData.val().matches(/^#[0-9a-fA-F]{6}$/)"}]));
 const appearance={'.validate':"newData.hasChildren(['title','preset','overlay','background','panel','text','muted','border','accent'])",title:{'.validate':"newData.isString() && newData.val().length <= 100"},preset:{'.validate':"newData.val() === 'dark' || newData.val() === 'light'"},overlay:{'.validate':"newData.isNumber() && newData.val() >= 0 && newData.val() <= 85"},...colors,'$other':{'.validate':false}};
 r.userListShares={
  '$uid':{'.read':`(${GOOGLE}) && auth.uid === $uid`,'.write':`(${GOOGLE}) && auth.uid === $uid`,
   '.validate':"newData.hasChildren(['token','showKey','showParts'])",
   token:{'.validate':"newData.isString() && newData.val().matches(/^[a-f0-9]{48}$/) && (!root.child('publicListShares').child(newData.val()).exists() || root.child('publicListShares').child(newData.val()).child('uid').val() === $uid)"},
   enabled:{'.validate':'newData.isBoolean()'},appearance,backgroundVersion:{'.validate':version},showKey:{'.validate':'newData.isBoolean()'},showParts:{'.validate':'newData.isBoolean()'},'$other':{'.validate':false}}
 };
 r.publicListShares={'$token':{
  '.read':"!data.exists() || root.child('userListShares').child(data.child('uid').val()).child('token').val() === $token && root.child('userListShares').child(data.child('uid').val()).child('enabled').val() !== false && data.child('reserved').val() !== true",
  '.write':`(${GOOGLE}) && $token.matches(/^[a-f0-9]{48}$/) && ((!data.exists() && !newData.exists()) || (!data.exists() && newData.child('uid').val() === auth.uid) || data.child('uid').val() === auth.uid) && newData.exists() && root.child('userListShares').child(auth.uid).child('token').val() === $token && (root.child('userListShares').child(auth.uid).child('enabled').val() !== false || (!newData.hasChild('songs') && !newData.hasChild('appearance') && !newData.hasChild('backgroundVersion') && newData.child('reserved').val() === true && newData.child('name').val() === '[paused]'))`,
  '.validate':"newData.hasChildren(['uid','name','updatedAt']) && newData.child('uid').val() === auth.uid",
  reserved:{'.validate':'newData.val() === true'},uid:{'.validate':'newData.isString() && newData.val() === auth.uid'},
  name:{'.validate':'newData.isString() && newData.val().length > 0 && newData.val().length <= 40'},
  appearance,backgroundVersion:{'.validate':version},
  updatedAt:{'.validate':'newData.isNumber() && newData.val() <= now'},
  songs:{'$song':{
   '.validate':"$song.matches(/^[A-Za-z0-9_-]{1,80}$/) && newData.hasChildren(['title','artist'])",
   title:{'.validate':'newData.isString() && newData.val().length > 0 && newData.val().length <= 500'},
   genresKnown:{'.validate':'newData.val() === true'},genres:{'$genre':{'.validate':"$genre.matches(/^(0|1|2|3|4|5|6|7|8|9|10|11)$/) && newData.isString() && newData.val().length <= 80"}},
   artist:{'.validate':'newData.isString() && newData.val().length <= 300'},
   url:{'.validate':"newData.isString() && newData.val().length <= 2048 && newData.val().matches(/^https:\\/\\/(ja\\.)?chordwiki\\.org\\/.*/)"},
   key:{'.validate':"root.child('userListShares').child(auth.uid).child('showKey').val() === true && newData.isNumber() && newData.val() >= -5 && newData.val() <= 6 && newData.val() % 1 === 0"},
   parts:{'.validate':"root.child('userListShares').child(auth.uid).child('showParts').val() === true",'$part':{'.validate':"$part.matches(/^[0-6]$/) && newData.isString() && newData.val().length <= 40"}},
   '$other':{'.validate':false}}},'$other':{'.validate':false}
 }};
 r.userListBackgrounds={'$uid':{'.read':`(${GOOGLE}) && auth.uid === $uid`,'.write':`(${GOOGLE}) && auth.uid === $uid`,'.validate':"newData.hasChildren(['version','image'])",version:{'.validate':version},image:{'.validate':image},'$other':{'.validate':false}}};
 r.publicListBackgrounds={'$token':{
  '.read':"data.exists() && root.child('userListShares').child(data.child('uid').val()).child('token').val() === $token && root.child('userListShares').child(data.child('uid').val()).child('enabled').val() !== false && root.child('userListShares').child(data.child('uid').val()).child('backgroundVersion').val() === data.child('version').val()",
  '.write':`(${GOOGLE}) && $token.matches(/^[a-f0-9]{48}$/) && ((!data.exists() && !newData.exists()) || (!data.exists() && newData.child('uid').val() === auth.uid) || data.child('uid').val() === auth.uid) && (!newData.exists() || (root.child('userListShares').child(auth.uid).child('token').val() === $token && root.child('userListShares').child(auth.uid).child('enabled').val() !== false && root.child('userListShares').child(auth.uid).child('backgroundVersion').val() === newData.child('version').val()))`,
  '.validate':"newData.hasChildren(['uid','version','image'])",uid:{'.validate':"newData.val() === auth.uid"},version:{'.validate':version},image:{'.validate':image},'$other':{'.validate':false}
 }};
 return document;
}
module.exports={addListShareRules};


