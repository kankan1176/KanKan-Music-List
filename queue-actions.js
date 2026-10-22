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
  // Child-path updates are atomic and do not require a write grant on the queue root.
  async function swapOrders(ref, idA, idB, {status, orderA, orderB, timeoutMs=15000, isCurrent=()=>true}={}) {
    if(!/^[A-Za-z0-9_-]{1,40}$/.test(idA)||!/^[A-Za-z0-9_-]{1,40}$/.test(idB)||idA===idB||!Number.isFinite(orderA)||!Number.isFinite(orderB)||orderA===orderB)return {committed:false};
    let listener,timer;
    try {
      const snapshot=await new Promise((resolve,reject)=>{
        timer=setTimeout(()=>{const error=Error('セットリストの最新データを取得できませんでした。');error.code='QUEUE_READ_TIMEOUT';reject(error);},timeoutMs);
        listener=resolve;ref.on('value',listener,reject);
      });
      clearTimeout(timer);
      if(!isCurrent())return {committed:false};
      const current=snapshot.val(),a=current?.[idA],b=current?.[idB];
      if(!a||!b||a.status!==status||b.status!==status||Number(a.order)!==orderA||Number(b.order)!==orderB)return {committed:false};
      await ref.update({[idA+'/order']:orderB,[idB+'/order']:orderA});
      return {committed:true};
    } finally {
      clearTimeout(timer);if(listener)ref.off('value',listener);
    }
  }
  return {transact,swapOrders};
});
