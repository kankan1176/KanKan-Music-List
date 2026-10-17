/* Keep a queue node subscribed until its conditional write finishes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLQueueActions = api;
})(typeof window === 'object' ? window : globalThis, () => {
  'use strict';
  async function transact(ref, update, {timeoutMs = 15000, isCurrent = () => true} = {}) {
    let listener, timer;
    try {
      await new Promise((resolve, reject) => {
        listener = () => resolve();
        timer = setTimeout(() => {
          const error = Error('セットリストの最新データを取得できませんでした。通信状態を確認してください。');
          error.code = 'QUEUE_READ_TIMEOUT'; reject(error);
        }, timeoutMs);
        ref.on('value', listener, reject);
      });
      clearTimeout(timer);
      if (!isCurrent()) return {committed:false};
      return await ref.transaction(current => isCurrent() ? update(current) : undefined, undefined, false);
    } finally {
      clearTimeout(timer);
      if (listener) ref.off('value', listener);
    }
  }
  return {transact};
});
