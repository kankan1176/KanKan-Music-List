(()=>{'use strict';const prefix='shareliscore_page_size_v2_',identity=prefix+'identity';function read(k){try{return localStorage.getItem(k)}catch{return null}}function write(k,v){try{localStorage.setItem(k,v)}catch{}}let uid=read(identity)||'guest';const valid=v=>Number(v)===15?15:10;let count=valid(read(prefix+uid));const button=()=>document.getElementById('songPageSizeToggle');function apply(){document.documentElement.dataset.songPageSize=String(count);const b=button();if(b){b.textContent=count===10?'15曲表示':'10曲表示';b.setAttribute('aria-pressed',String(count===10));}}function refresh(){apply();if(typeof renderTable==='function')renderTable();window.dispatchEvent(new Event('sl-page-size-change'));}window.SLSongPageSize={get:()=>count};apply();function init(){apply();button()?.addEventListener('click',()=>{count=count===10?15:10;write(prefix+uid,String(count));refresh();});try{if(window.firebase?.apps?.length)firebase.auth().onAuthStateChanged(user=>{uid=user?.uid||'guest';write(identity,uid);const restored=valid(read(prefix+uid));if(restored!==count){count=restored;refresh();}});}catch{}window.addEventListener('storage',e=>{if(e.key===prefix+uid){count=valid(e.newValue);refresh();}});}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();})();
(()=>{let pending=false;function fit(){pending=false;const area=document.querySelector('.table-body-wrapper'),body=document.getElementById('tableBody');if(!area||!body||!area.clientHeight)return;const n=window.SLSongPageSize?.get()||10;const height=Math.floor((area.clientHeight-2)/n);area.style.setProperty('--fit-row',height+'px');area.style.setProperty('--fit-font',(n===10?Math.min(15,height*.3):Math.min(12,height*.36))+'px');for(const cell of body.querySelectorAll('td')){if(cell.firstElementChild?.classList.contains('fit-cell'))continue;const box=document.createElement('div');box.className='fit-cell';box.title=cell.textContent.trim();while(cell.firstChild)box.append(cell.firstChild);cell.append(box)}}function schedule(){if(!pending){pending=true;requestAnimationFrame(fit)}}function init(){const area=document.querySelector('.table-body-wrapper'),body=document.getElementById('tableBody');if(area)new ResizeObserver(schedule).observe(area);if(body)new MutationObserver(schedule).observe(body,{childList:true});document.getElementById('songPageSizeToggle')?.addEventListener('click',schedule);window.addEventListener('resize',schedule);window.addEventListener('sl-page-size-change',schedule);schedule()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init()})();
document.addEventListener('DOMContentLoaded', () => {
    const viewport = document.querySelector('.table-body-wrapper') || document.getElementById('shareListViewport');
    if (!viewport) return;
    const main = viewport.classList.contains('table-body-wrapper');
    const previous = document.getElementById(main ? 'songPrevPageBtn' : 'sharePrev');
    const next = document.getElementById(main ? 'songNextPageBtn' : 'shareNext');
    const setting = document.getElementById('wheelPaging');
    let enabled = true;
    function storageKey() {
        return 'shareliscore_wheel_paging_' + (window.firebase?.apps?.length && firebase.auth().currentUser?.uid || 'guest');
    }
    function restore() {
        try { enabled = localStorage.getItem(storageKey()) !== 'off'; } catch {}
        if (setting) setting.checked = enabled;
    }
    restore();
    if (window.firebase?.apps?.length) firebase.auth().onAuthStateChanged(restore);
    window.addEventListener('storage', restore);
    setting?.addEventListener('change', () => {
        enabled = setting.checked;
        try { localStorage.setItem(storageKey(), enabled ? 'on' : 'off'); } catch {}
    });
    let busy = false, lastWheel = 0, suppressMomentum = false;
    function pageNumber() {
        if (!main) return document.getElementById('sharePageSelect').value;
        if (serverPagedMasterMode && !masterLoaded && !currentRoomId && !myListMode)
            return serverSearchMode ? serverSearchPage : serverPageNumber;
        return songPageIndex;
    }
    viewport.addEventListener('wheel', async event => {
        if (!enabled || event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
        const now = performance.now();
        if (now - lastWheel > 150) suppressMomentum = false;
        lastWheel = now;
        if (busy || suppressMomentum) { event.preventDefault(); return; }
        const down = event.deltaY > 0;
        const button = down ? next : previous;
        if (!button || button.disabled) return;
        if (down ? viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - 1 : viewport.scrollTop > 1) return;
        event.preventDefault();
        busy = suppressMomentum = true;
        try {
            const before = pageNumber();
            if (main) await changeSongPage(down ? 1 : -1);
            else button.click();
            await new Promise(requestAnimationFrame);
            if (pageNumber() !== before) viewport.scrollTop = down ? 0 : viewport.scrollHeight;
        } finally { busy = false; }
    }, {passive:false});
});
