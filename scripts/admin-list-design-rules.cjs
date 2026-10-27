'use strict';
const ADMIN="auth != null && auth.token.firebase.sign_in_provider === 'google.com' && root.child('admins').child(auth.uid).val() === true";
const account=uid=>`(root.child('publicProfiles').child(${uid}).exists() || root.child('adminClientControl/clients').child(${uid}).child('kind').val() === 'account')`;
const grant=(old,extra)=>`(${old || 'false'}) || (${extra})`;
function addAdminListDesignRules(document){
 const r=document.rules,config=r.userListShares.$uid;
 const target=`(${ADMIN}) && ${account('$uid')}`;
 config['.read']=grant(config['.read'],target);
 // Admins edit appearance only: preserve the URL, publication state and disclosure choices.
 config['.write']=grant(config['.write'],`${target} && newData.exists() && ((data.exists() && newData.child('token').val() === data.child('token').val() && newData.child('enabled').val() === data.child('enabled').val() && newData.child('showKey').val() === data.child('showKey').val() && newData.child('showParts').val() === data.child('showParts').val()) || (!data.exists() && newData.child('enabled').val() === false && newData.child('showKey').val() === false && newData.child('showParts').val() === false))`);
 const privateImage=r.userListBackgrounds.$uid;
 privateImage['.read']=grant(privateImage['.read'],target);
 const finalConfig="newData.parent().parent().child('userListShares').child($uid)";
 privateImage['.write']=grant(privateImage['.write'],`${target} && ((!newData.exists() && !${finalConfig}.hasChild('backgroundVersion')) || (newData.exists() && newData.child('version').val() === ${finalConfig}.child('backgroundVersion').val()))`);
 const share=r.publicListShares.$token;
 // The owner rules reuse this schema object for private and public appearance.
 // Detach it before adding a token-scoped public write grant.
 share.appearance=structuredClone(share.appearance);
 const shareAdmin=`(${ADMIN}) && data.exists() && newData.exists() && newData.child('uid').val() === data.child('uid').val()`;
 share['.validate']=`newData.hasChildren(['uid','name','updatedAt']) && (newData.child('uid').val() === auth.uid || (${shareAdmin}))`;
 share.uid['.validate']=`newData.isString() && (newData.val() === auth.uid || ((${ADMIN}) && newData.val() === data.val()))`;
 const owner="data.parent().child('uid').val()";
 const configForOwner=`root.child('userListShares').child(${owner})`;
 const edit=`(${ADMIN}) && ${account(owner)} && data.parent().exists() && data.parent().child('reserved').val() !== true && ${configForOwner}.child('token').val() === $token && ${configForOwner}.child('enabled').val() !== false`;
 for(const field of ['appearance','backgroundVersion','updatedAt'])share[field]['.write']=grant(share[field]['.write'],edit);
 const background=r.publicListBackgrounds.$token;
 const uid="newData.child('uid').val()";
 const finalRoot="newData.parent().parent()",finalShareConfig=`${finalRoot}.child('userListShares').child(${uid})`;
 const imageAdmin=`(${ADMIN}) && ((!newData.exists() && data.exists() && root.child('userListShares').child(data.child('uid').val()).child('token').val() === $token) || (newData.exists() && ${account(uid)} && (!data.exists() || data.child('uid').val() === ${uid}) && ${finalShareConfig}.child('token').val() === $token && ${finalShareConfig}.child('enabled').val() !== false && ${finalShareConfig}.child('backgroundVersion').val() === newData.child('version').val() && ${finalRoot}.child('userListBackgrounds').child(${uid}).child('version').val() === newData.child('version').val() && ${finalRoot}.child('userListBackgrounds').child(${uid}).child('image').val() === newData.child('image').val()))`;
 background['.write']=grant(background['.write'],imageAdmin);
 background.uid['.validate']=`newData.isString() && (newData.val() === auth.uid || ((${ADMIN}) && ${account('newData.val()')} && newData.parent().parent().parent().child('userListShares').child(newData.val()).child('token').val() === $token))`;
 return document;
}
module.exports={addAdminListDesignRules};
