/* Public site key; no secret or debug tokens belong in this file. */
(() => {
  'use strict';
  const siteKey = '6LdkxeEtAAAAAJDWSvXbmsKHezi4oMuW88CWSvcQ';
  const active = new WeakMap();

  function activate(app) {
    if (active.has(app)) return active.get(app);
    try {
      const check = firebase.appCheck(app);
      check.activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(siteKey), true);
      active.set(app, check);
      return check;
    } catch (error) {
      // During monitoring, keep the application usable if initialization fails.
      // Enforcement remains a separate console action after real-client checks.
      console.error('App Check initialization failed:', error?.code || 'unavailable');
      return null;
    }
  }

  window.SLAppCheck = Object.freeze({ activate });
})();
