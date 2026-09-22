// 旧 Google スプレッドシート（GAS）の全件を Neon の helper_reports に取り込む一回限りの移行スクリプト
// 実行: npm run db:migrate-gas          ※ .env.local の DATABASE_URL / GAS_URL を使用
//       npm run db:migrate-gas -- --force  （テーブルに既にデータがある場合でも追加する）
//       npm run db:migrate-gas -- --dry-run（DB に書き込まず件数と変換結果の確認のみ）
import { neon } from '@neondatabase/serverless';

const { DATABASE_URL, GAS_URL } = process.env;
const force  = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');

if (!DATABASE_URL) { console.error('DATABASE_URL が設定されていません'); process.exit(1); }
if (!GAS_URL)      { console.error('GAS_URL が設定されていません'); process.exit(1); }

const CHECK_KEYS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 's1', 's2', 's3', 's4', 's5', 's6'];

// 整数化
function int(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// 時刻 → "HH:MM"（スプレッドシートの時刻セルは ISO 文字列で返るため JST に変換）
function toHHMM(v) {
  if (!v) return null;
  const s = String(v).trim();
  const plain = /^(\d{1,2}):(\d{2})/.exec(s);
  if (plain && !s.includes('T')) return `${plain[1].padStart(2, '0')}:${plain[2]}`;
  if (s.includes('T')) {
    const d = new Date(s);
    if (isNaN(d)) return null;
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`;
  }
  return null;
}

// 送信日時 → Date（不正なら null → DB 側で now()）
function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

// GAS の1レコード（日本語キー）→ DB 行
function convert(r, idx) {
  const ym = String(r['年月'] || '');
  const y = /(\d{4})年/.exec(ym);
  const m = /(\d{1,2})月/.exec(ym);
  if (!y || !m) return { skip: `${idx + 1}行目: 年月が読み取れません` };

  const dayMatch = /(\d{1,2})日/.exec(String(r['活動日'] || ''));
  const helperName = String(r['ヘルパー氏名'] || '').trim();
  const userName   = String(r['利用者氏名'] || '').trim();
  if (!helperName || !userName) return { skip: `${idx + 1}行目: 氏名が空です` };

  const expenses = [];
  for (let i = 1; i <= 15; i++) {
    const desc = String(r[`摘要${i}`] || '').trim();
    const amount = int(r[`金額${i}`]);
    if (desc || (amount !== null && amount !== 0)) expenses.push({ desc, amount: amount ?? 0 });
  }

  const deposit      = int(r['預り金']) ?? 0;
  const totalUsed    = int(r['使用総額']) ?? expenses.reduce((s, e) => s + e.amount, 0);
  const totalRefund  = int(r['返金予定額']) ?? (deposit - totalUsed);
  const actualRefund = int(r['返金額']);
  const diff         = int(r['差額']) ?? (actualRefund === null ? 0 : actualRefund - totalRefund);

  return {
    row: [
      Number(y[1]), Number(m[1]), dayMatch ? Number(dayMatch[1]) : null, helperName, userName,
      toHHMM(r['開始']), toHHMM(r['終了']), String(r['種別'] || ''), String(r['支援費区分'] || ''), String(r['特記事項'] || ''),
      ...CHECK_KEYS.map(k => String(r[k] || '') === '✓' || r[k] === true),
      deposit, JSON.stringify(expenses), totalUsed, totalRefund, actualRefund, diff, String(r['差額理由'] || ''),
      toDate(r['送信日時']),
    ],
  };
}

// ── 取得 ──
console.log('GAS から全件取得中…');
const resp = await fetch(GAS_URL);
const text = await resp.text();
let records;
try { records = JSON.parse(text); } catch {
  console.error('GAS のレスポンスが JSON ではありません:', text.slice(0, 120));
  process.exit(1);
}
if (!Array.isArray(records)) { console.error('配列ではないレスポンスです'); process.exit(1); }
console.log(`取得: ${records.length} 件`);

// ── 変換 ──
const rows = [], skips = [];
records.forEach((r, i) => {
  const c = convert(r, i);
  if (c.skip) skips.push(c.skip); else rows.push(c.row);
});
console.log(`変換OK: ${rows.length} 件 / スキップ: ${skips.length} 件`);
skips.forEach(s => console.log('  -', s));

if (dryRun) { console.log('（dry-run のため DB には書き込みません）'); process.exit(0); }

// ── 書き込み ──
const sql = neon(DATABASE_URL);
const [{ count }] = await sql.query('SELECT count(*)::int AS count FROM helper_reports');
if (count > 0 && !force) {
  console.error(`helper_reports に既に ${count} 件あります。重複を避けるため中止しました。追加する場合は --force を付けてください。`);
  process.exit(1);
}

const INSERT = `INSERT INTO helper_reports (
  report_year, report_month, report_day, helper_name, user_name,
  start_time, end_time, category, support_type, notes,
  c1, c2, c3, c4, c5, c6, s1, s2, s3, s4, s5, s6,
  deposit, expenses, total_used, total_refund, actual_refund, diff, diff_reason, created_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
  $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
  $23, $24::jsonb, $25, $26, $27, $28, $29, COALESCE($30::timestamptz, now())
)`;

let done = 0;
for (const row of rows) {
  await sql.query(INSERT, row);
  done++;
  if (done % 50 === 0) console.log(`  ${done} / ${rows.length}`);
}
console.log(`完了: ${done} 件を取り込みました`);
