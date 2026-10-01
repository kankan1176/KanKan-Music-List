/**
 * スプレッドシート側の「拡張機能 > Apps Script」に貼り付けてください。
 * 編集可能な元スプレッドシートの ID と、対象タブ名を必ず設定します。
 * 「ウェブアプリとしてデプロイ」: 実行ユーザー = 自分 / アクセス = 全員。
 * 公開POSTを許す仕組みのため、シートのバックアップと定期的な確認を推奨します。
 */
const SPREADSHEET_ID = 'PASTE_EDITABLE_SPREADSHEET_ID_HERE';
const SHEET_NAME = 'PASTE_SONG_SHEET_TAB_NAME_HERE';

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const data = JSON.parse((e.postData && e.postData.contents) || '{}');
    // 自動入力 bot 向けのハニーポット
    if (data.website) return reply_('rejected');
    const artist = clean_(data.artist, 150);
    const title = clean_(data.title, 150);
    const codeUrl = String(data.codeUrl || '').trim();
    const genre1 = clean_(data.genre1, 80);
    const genre2 = clean_(data.genre2, 80);
    const bpmValue = String(data.bpm || '').trim();
    if (!artist || !title || !genre1 || !/^https?:\/\/[^\s]+$/i.test(codeUrl) || codeUrl.length > 500) throw Error('invalid input');
    if (genre2 && genre1 === genre2) throw Error('duplicate genres');
    if (bpmValue && (!/^\d+$/.test(bpmValue) || +bpmValue < 1 || +bpmValue > 400)) throw Error('invalid bpm');

    lock.waitLock(10000);
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
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
    const row = new Array(sheet.getLastColumn()).fill('');
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
