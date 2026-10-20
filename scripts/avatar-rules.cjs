'use strict';
function addAvatarRules(original){const out=structuredClone(original);out.rules.userAvatars={
 '$uid':{
  '.read':true,
  '.write':"auth != null && auth.uid === $uid && auth.token.firebase.sign_in_provider === 'google.com'",
  '.validate':"newData.hasChildren(['image','width','height','updatedAt'])",
  image:{'.validate':"newData.isString() && newData.val().length <= 100000 && newData.val().matches(/^data:image\\/jpeg;base64,[A-Za-z0-9+\\/=]+$/)"},
  width:{'.validate':'newData.val() === 400'},height:{'.validate':'newData.val() === 400'},updatedAt:{'.validate':'newData.isNumber() && newData.val() === now'},'$other':{'.validate':false}
 }
};return out;}
module.exports={addAvatarRules};
