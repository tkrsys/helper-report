// 活動報告書の登録 API（Neon PostgreSQL に INSERT）
import { getSql, setCors, isAuthorized } from './_db.js';

const CHECK_KEYS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 's1', 's2', 's3', 's4', 's5', 's6'];

// 文字列を整形（前後空白除去・最大長制限）
function str(v, max = 2000) {
  if (v === null || v === undefined) return '';
  return String(v).trim().slice(0, max);
}
// 整数化（数値でなければ null）
function int(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}
// "HH:MM" 形式のみ受け付ける
function time(v) {
  const s = str(v, 5);
  return /^\d{2}:\d{2}$/.test(s) ? s : null;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const body = req.body || {};
  if (!isAuthorized(body.password)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const d = body.data || {};

  // 必須項目チェック（画面側のバリデーションと同じ項目）
  const year  = int(d.year);
  const month = int(d.month);
  const day   = int(d.day);
  const helperName = str(d.helperName, 100);
  const userName   = str(d.userName, 100);
  if (!year || !month || month < 1 || month > 12) return res.status(400).json({ error: '年月が不正です' });
  if (!day || day < 1 || day > 31)                return res.status(400).json({ error: '活動日が不正です' });
  if (!helperName) return res.status(400).json({ error: 'ヘルパー氏名は必須です' });
  if (!userName)   return res.status(400).json({ error: '利用者氏名は必須です' });

  // 預り金明細（摘要・金額のどちらかが入っている行のみ保存）
  const expenses = (Array.isArray(d.money) ? d.money : [])
    .map(e => ({ desc: str(e && e.desc, 200), amount: int(e && e.amount) }))
    .filter(e => e.desc || (e.amount !== null && e.amount !== 0))
    .map(e => ({ desc: e.desc, amount: e.amount ?? 0 }));

  const deposit      = int(d.deposit) ?? 0;
  const totalUsed    = expenses.reduce((s, e) => s + e.amount, 0);
  const totalRefund  = deposit - totalUsed;
  const actualRefund = int(d.actualRefund);
  const diff         = actualRefund === null ? 0 : actualRefund - totalRefund;

  const checks = d.checks || {};
  const checkVals = CHECK_KEYS.map(k => !!checks[k]);

  try {
    const sql = getSql();
    const rows = await sql.query(
      `INSERT INTO helper_reports (
         report_year, report_month, report_day, helper_name, user_name,
         start_time, end_time, category, support_type, notes,
         c1, c2, c3, c4, c5, c6, s1, s2, s3, s4, s5, s6,
         deposit, expenses, total_used, total_refund, actual_refund, diff, diff_reason
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10,
         $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
         $23, $24::jsonb, $25, $26, $27, $28, $29
       ) RETURNING id`,
      [
        year, month, day, helperName, userName,
        time(d.startTime), time(d.endTime), str(d.category, 50), str(d.supportType, 50), str(d.notes, 5000),
        ...checkVals,
        deposit, JSON.stringify(expenses), totalUsed, totalRefund, actualRefund, diff, str(d.diffReason, 1000),
      ]
    );
    return res.status(200).json({ ok: true, id: rows[0].id, role: 'user' });
  } catch (e) {
    // 個人情報を含まないよう、エラー種別のみ記録する
    console.error('helper_reports insert failed:', e.code || e.name || 'unknown');
    return res.status(500).json({ error: '保存に失敗しました' });
  }
}
