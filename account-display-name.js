/* Follow the site's saved display name, without editing Google identity. */
(() => {
  'use strict';
  let stop = () => {}, generation = 0;
  auth.onAuthStateChanged(user => {
    stop(); stop = () => {}; const version = ++generation;
    if (!user || user.isAnonymous) return;
    const ref = db.ref('users/' + user.uid + '/profile/displayName');
    const receive = snapshot => {
      if (version !== generation || auth.currentUser?.uid !== user.uid || signedInUser?.uid !== user.uid) return;
      const name = snapshot.val();
      if (typeof name !== 'string' || !name.trim() || name.length > 40 || /[\x00-\x1f\x7f]/.test(name)) return;
      if (myName === name) return;
      ++usernameLoadVersion;
      applyUsername(name);
    };
    ref.on('value', receive, error => console.warn('表示名を同期できませんでした', error));
    stop = () => ref.off('value', receive);
  });
})();
