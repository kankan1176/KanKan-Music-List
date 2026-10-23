'use strict';
const OWNER="auth != null && auth.uid === $uid && auth.token.firebase.sign_in_provider === 'google.com'";
function addChordWikiPreferenceRules(document){
 const preferences=(((document.rules.users ||= {}).$uid ||= {}).preferences ||= {});
 preferences.chordwikiVersion={'.read':OWNER,'.write':OWNER,'.validate':`(${OWNER}) && newData.isString() && (newData.val() === 'normal' || newData.val() === 'beta')`};
 return document;
}
module.exports={addChordWikiPreferenceRules};
