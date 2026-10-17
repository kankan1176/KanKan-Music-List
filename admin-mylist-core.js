/* CSV parsing and deterministic master matching shared by admin UI and tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SLAdminMyList = api;
})(typeof window === 'object' ? window : globalThis, () => {
  'use strict';
  const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('en-US').replace(/[\p{P}\p{Z}\s\u200b-\u200d\ufeff]+/gu, '');
  const active = item => !!item && typeof item === 'object' && item.excluded !== true && item.registered !== false && !!(item.registered || item.part || item.parts?.length || item.liked);
  function parseCsv(source) {
    const text = String(source).replace(/^\ufeff/, '');
    if (text.includes('\u0000')) throw Error('CSVとして読み込めない文字が含まれています。');
    const rows = []; let cells = [], value = '', quoted = false, afterQuote = false, line = 1, start = 1;
    const finish = () => { cells.push(value); if (cells.some(v => v.trim())) rows.push({line:start, cells}); cells = []; value = ''; afterQuote = false; };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"') { if (text[i + 1] === '"') { value += '"'; i++; } else { quoted = false; afterQuote = true; } }
        else { value += c; if (c === '\n') line++; }
      } else if (c === ',' ) { cells.push(value); value = ''; afterQuote = false; }
      else if (c === '\r' || c === '\n') { if (c === '\r' && text[i+1] === '\n') i++; finish(); line++; start = line; }
      else if (c === '"' && !value && !afterQuote) quoted = true;
      else if (afterQuote && !/\s/.test(c)) throw Error(start + '行目：閉じ引用符の後に不正な文字があります。');
      else if (!afterQuote) value += c;
    }
    if (quoted) throw Error(start + '行目：引用符が閉じていません。');
    finish();
    if (rows.length > 5001) throw Error('1回にアップロードできるのは5,000行までです。');
    const first = rows[0]?.cells.map(normalize);
    const hasHeader = first && ['曲名','タイトル','title'].includes(first[0]) && ['アーティスト','アーティスト名','artist'].includes(first[1]);
    if (hasHeader) {
      if (first.length > 3 || (first[2] && !['key','キー'].includes(first[2]))) throw Error('見出しは「曲名,アーティスト,Key」の順にしてください。');
      rows.shift();
    }
    if (!rows.length) throw Error('曲のデータ行がありません。見出しの下に曲名・アーティストを入力してください。');
    return rows;
  }
  function buildIndex(master) {
    const index = new Map(), byId = new Map();
    for (const [id, song] of Object.entries(master || {})) {
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || !song || typeof song !== 'object') continue;
      const item = {id, title:String(song.title || ''), artist:String(song.artist || '')}; byId.set(id, item);
      const title = normalize(item.title), artist = normalize(item.artist);
      if (!title || !artist) continue;
      const key = title + '\0' + artist;
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(item);
    }
    return {index, byId};
  }
  function analyze(rows, master, saved, choices = {}) {
    const {index} = buildIndex(master), seen = new Set();
    return rows.map(row => {
      const title = String(row.cells[0] || '').trim(), artist = String(row.cells[1] || '').trim();
      const rawKey = String(row.cells[2] || '').normalize('NFKC').trim();
      const result = {line:row.line, title, artist, rawKey, key:0, status:'excluded', reason:'', candidates:[], songId:null};
      if (row.cells.length > 3 || !title || !artist) return {...result, reason:'曲名・アーティストが必要です。列は3列以内にしてください。'};
      if (rawKey && (!/^[+-]?\d+$/.test(rawKey) || Number(rawKey) < -5 || Number(rawKey) > 6)) return {...result, reason:'Keyは-5〜+6の整数で入力してください。'};
      result.key = rawKey ? Number(rawKey) : 0;
      result.candidates = index.get(normalize(title) + '\0' + normalize(artist)) || [];
      if (!result.candidates.length) return {...result, reason:'マスターに一致する楽曲がありません。'};
      const selected = choices[row.line];
      if (selected === 'skip') return {...result, reason:'この行は登録しません。'};
      if (result.candidates.length > 1 && !result.candidates.some(c => c.id === selected)) return {...result, status:'candidate', reason:'候補が複数あります。登録先を選択しない場合は除外します。'};
      const song = result.candidates.find(c => c.id === selected) || result.candidates[0]; result.songId = song.id;
      if (Object.prototype.hasOwnProperty.call(saved || {}, song.id)) return {...result, status:'duplicate', reason:'既存マイリストにデータがあるため除外します。Keyなどは変更しません。'};
      if (seen.has(song.id)) return {...result, status:'duplicate', reason:'CSV内で同じ楽曲が重複しているため除外します。'};
      seen.add(song.id);
      return {...result, status:'ready', reason:'追記します。', masterTitle:song.title, masterArtist:song.artist};
    });
  }
  function decode(bytes) {
    try { return new TextDecoder('utf-8', {fatal:true}).decode(bytes); }
    catch { try { return new TextDecoder('shift_jis', {fatal:true}).decode(bytes); } catch { throw Error('文字コードを読み取れません。UTF-8のCSVで保存し直してください。'); } }
  }
  const payload = key => ({registered:true, part:'', parts:[], liked:false, key});
  return {normalize, active, parseCsv, buildIndex, analyze, decode, payload};
});
