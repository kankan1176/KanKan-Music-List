/**
 * スプレッドシート側の「拡張機能 > Apps Script」に貼り付けてください。
 * 編集可能な元スプレッドシートの ID と、対象タブ名を必ず設定します。
 * 「ウェブアプリとしてデプロイ」: 実行ユーザー = 自分 / アクセス = 全員。
 * 公開POSTを許す仕組みのため、シートのバックアップと定期的な確認を推奨します。
 */
const SPREADSHEET_ID = '1YMACN6m-5tE3TSY4jNxVRdQieDCTwh7Zhted-z8zTl4';
const SHEET_NAME = '全曲'; // タブ名が分かれば入力。空欄なら「曲名」と「楽曲ID」があるシートを自動検出。
const FIREBASE_WEB_API_KEY = 'AIzaSyAidXlfliIIHzTFmr06EKDV6Fit-bSThLI';

/** Firebase Auth REST APIへ照会して、投稿者の有効なIDトークンを確認する。 */
function verifyGoogleUser_(idToken) {
  const token = String(idToken || '');
  if (!token || token.length > 8192) return null;
  const url = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(FIREBASE_WEB_API_KEY);
  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ idToken: token }),
      muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) return null;
    const body = JSON.parse(response.getContentText());
    const user = Array.isArray(body.users) ? body.users[0] : null;
    if (!user || !user.localId || user.disabled) return null;
    // 現段階はGoogleログインの登録者に限定。
    const googleLinked = (user.providerUserInfo || []).some(p => p.providerId === 'google.com');
    if (!googleLinked) return null;
    return { uid: user.localId, name: user.displayName || user.email || '' };
  } catch (error) {
    console.error('Firebase投稿認証の照会に失敗:', error.message);
    return null;
  }
}


/** 新規投稿では原曲のChordWiki楽曲ページだけを受け付ける（Apps Script V8互換）。 */
function isOriginalChordWikiUrl_(value) {
  const input = String(value || '').trim();
  if (!input || input.length > 500 || /[\s\x00-\x1f\x7f]/.test(input)) return false;
  // クエリのない /wiki/個別ページ。タグ・検索・外部ドメインを許可しない。
  const direct = input.match(/^https:\/\/ja\.chordwiki\.org\/wiki\/([^/?#]+)$/i);
  if (direct) {
    try {
      const title = decodeURIComponent(direct[1].replace(/\+/g, ' '));
      return !!title.trim() && !/[\x00-\x1f\x7f/]/.test(title);
    } catch (error) { return false; }
  }
  // 原曲キーが省略か0の c=view URLは許可。それ以外の wiki.cgi は拒否。
  const cgi = input.match(/^https:\/\/ja\.chordwiki\.org\/wiki\.cgi\?([^#]+)$/i);
  if (!cgi) return false;
  const params = {};
  try {
    cgi[1].split('&').forEach(pair => {
      const i = pair.indexOf('=');
      const key = decodeURIComponent((i < 0 ? pair : pair.slice(0, i)).replace(/\+/g, ' '));
      const val = decodeURIComponent((i < 0 ? '' : pair.slice(i + 1)).replace(/\+/g, ' '));
      if (Object.prototype.hasOwnProperty.call(params, key)) throw Error('duplicate query');
      params[key] = val;
    });
  } catch (error) { return false; }
  return params.c === 'view' && !!String(params.t || '').trim() &&
    !/[\x00-\x1f\x7f]/.test(params.t) && (params.key === undefined || params.key === '0');
}

/** タブ名が未指定なら見出しから特定。曖昧な場合は書き込まない。 */
function getSongSheet_() {
  const book = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (SHEET_NAME) {
    const sheet = book.getSheetByName(SHEET_NAME);
    if (!sheet) throw Error('tab not found');
    return sheet;
  }
  const matches = book.getSheets().filter(sheet => {
    const rows = sheet.getDataRange().getDisplayValues();
    return rows.some(row => row.includes('曲名') && row.includes('楽曲ID'));
  });
  if (matches.length !== 1) throw Error('song sheet not uniquely identified: ' + matches.length);
  return matches[0];
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const data = JSON.parse((e.postData && e.postData.contents) || '{}');
    // 公開されたURLへの直接POSTも、Firebaseログインを確認できなければ拒否する。
    const verifiedUser = verifyGoogleUser_(data.idToken);
    if (!verifiedUser) return reply_('unauthorized');
    // 自動入力 bot 向けのハニーポット
    if (data.website) return reply_('rejected');
    const artist = clean_(data.artist, 150);
    const title = clean_(data.title, 150);
    const codeUrl = String(data.codeUrl || '').trim();
    const genre1 = clean_(data.genre1, 80);
    const genre2 = clean_(data.genre2, 80);
    const bpmValue = String(data.bpm || '').trim();
    if (!artist || !title || !genre1 || !isOriginalChordWikiUrl_(codeUrl)) throw Error('invalid input or unsupported ChordWiki URL');
    if (genre2 && genre1 === genre2) throw Error('duplicate genres');
    if (bpmValue && (!/^\d+$/.test(bpmValue) || +bpmValue < 1 || +bpmValue > 400)) throw Error('invalid bpm');

    lock.waitLock(10000);
    const sheet = getSongSheet_();
    if (!sheet) throw Error('tab not found');
    // index.html と同様に「曲名」を含む行をヘッダーとみなします。
    const values = sheet.getDataRange().getDisplayValues();
    const headerIndex = values.findIndex(row => row.includes('曲名'));
    if (headerIndex < 0) throw Error('header not found');
    const headers = values[headerIndex].map(s => String(s).trim());
    const names = {
      artist: ['アーティスト'], title: ['曲名'], codeUrl: ['コードwiki', 'コードWiki'],
      bpm: ['BPM'], genre1: ['ジャンル①', 'ジャンル'], genre2: ['ジャンル②']
    };
    const col = key => headers.findIndex(h => names[key].includes(h));
    if (Object.keys(names).some(key => col(key) < 0)) throw Error('required header missing');

    // 既存のジャンルと一致するものだけ受け付け、任意のジャンル注入を防ぎます。
    const allowed = new Set();
    values.slice(headerIndex + 1).forEach(row => {
      [col('genre1'), col('genre2')].forEach(i => {
        if (String(row[i] || '').trim()) allowed.add(String(row[i]).trim());
      });
    });
    if (!allowed.has(genre1) || (genre2 && !allowed.has(genre2))) throw Error('unknown genre');

    // 重複送信（同一アーティスト・曲名）を抑止。
    const normalized = x => String(x || '').trim().toLocaleLowerCase();
    if (values.slice(headerIndex + 1).some(row => normalized(row[col('artist')]) === normalized(artist) && normalized(row[col('title')]) === normalized(title))) {
      return reply_('duplicate');
    }
    const songIdColumn = headers.findIndex(h => h === '楽曲ID');
    if (songIdColumn < 0) throw Error('楽曲ID column missing');
    const row = new Array(sheet.getLastColumn()).fill('');
    row[songIdColumn] = Utilities.getUuid();
    row[col('artist')] = artist;
    row[col('title')] = title;
    row[col('codeUrl')] = codeUrl;
    row[col('bpm')] = bpmValue ? Number(bpmValue) : '';
    row[col('genre1')] = genre1;
    row[col('genre2')] = genre2;
    const nextRow = sheet.getLastRow() + 1;
    // 値として登録し、セル内の = から始まる入力が数式に変換されないよう保護します。
    const range = sheet.getRange(nextRow, 1, 1, row.length);
    range.setNumberFormat('@');
    range.setValues([row]);
    SpreadsheetApp.flush();
    return reply_('ok');
  } catch (err) {
    console.error(err);
    return reply_('error');
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function clean_(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}
function reply_(status) {
  return ContentService.createTextOutput(JSON.stringify({ status }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 一度だけ手動実行。空欄の楽曲IDにだけUUIDを発行。既存の値は変えません。 */
function assignMissingSongIds() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getSongSheet_();
    if (!sheet) throw Error('tab not found');
    const values = sheet.getDataRange().getDisplayValues();
    const headerIndex = values.findIndex(row => row.includes('曲名'));
    if (headerIndex < 0) throw Error('header not found');
    const headers = values[headerIndex].map(h => String(h).trim());
    const idColumn = headers.indexOf('楽曲ID');
    const titleColumn = headers.indexOf('曲名');
    if (idColumn < 0) throw Error('楽曲ID column missing');
    const used = new Set();
    // 重複IDは自動変更しません。既存の個人データと紐づく可能性があるためエラーにします。
    values.slice(headerIndex + 1).forEach(row => {
      const id = String(row[idColumn] || '').trim();
      if (id && used.has(id)) throw Error('duplicate 楽曲ID: ' + id);
      if (id) used.add(id);
    });
    let added = 0;
    for (let i = headerIndex + 1; i < values.length; i++) {
      if (!String(values[i][titleColumn] || '').trim()) continue;
      if (!String(values[i][idColumn] || '').trim()) {
        let id;
        do { id = Utilities.getUuid(); } while (used.has(id));
        sheet.getRange(i + 1, idColumn + 1).setValue(id);
        used.add(id);
        added++;
      }
    }
    console.log('新規発行した楽曲ID: ' + added + '件');
  } finally {
    lock.releaseLock();
  }
}
