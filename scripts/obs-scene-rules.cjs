'use strict';
function addObsSceneRules(original){const out=structuredClone(original);out.rules.obsScenes={'$room':{'$uid':{
 '.read':"root.child('rooms').child($room).exists()",
 '.write':"auth != null && auth.uid === $uid && (auth.token.firebase.sign_in_provider === 'google.com' || auth.token.firebase.sign_in_provider === 'anonymous') && root.child('rooms').child($room).exists() && $room.matches(/^[A-Za-z0-9]{4,32}$/)",
 '.validate':"newData.hasChildren(['theme','roomName','host','speed','font','updatedAt'])",
 transparentBackground:{'.validate':'newData.isBoolean()'},
 theme:{'.validate':"newData.val() === 'light' || newData.val() === 'dark'"},
 roomName:{'.validate':'newData.isString() && newData.val().length <= 80'},description:{'.validate':'newData.isString() && newData.val().length <= 500'},
 host:{'.validate':"newData.isString() && newData.val().matches(/^[A-Za-z0-9_-]{1,128}$/)"},speed:{'.validate':'newData.isNumber() && newData.val() >= 10 && newData.val() <= 80'},font:{'.validate':"newData.val() === 'system' || newData.val() === 'rounded' || newData.val() === 'mincho'"},updatedAt:{'.validate':'newData.isNumber() && newData.val() === now'},
 members:{'$person':{'.validate':"$person.matches(/^[A-Za-z0-9_-]{1,128}$/) && newData.hasChildren(['name','part','color'])",name:{'.validate':'newData.isString() && newData.val().length <= 80'},part:{'.validate':'newData.isString() && newData.val().length <= 80'},color:{'.validate':'newData.isNumber() && newData.val() >= 0 && newData.val() <= 4 && newData.val() % 1 === 0'},'$other':{'.validate':false}}},'$other':{'.validate':false}
 }}};return out;}
module.exports={addObsSceneRules};
