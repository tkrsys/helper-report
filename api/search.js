// 活動報告書の検索 API（Neon PostgreSQL から取得）
import { getSql, setCors, isAuthorized, toRecord } from './_db.js';

const MAX_ROWS = 1000;

// "YYYY-MM" を年×100+月 の整数に変換（不正なら null）
function ymNum(s) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  return Number(m[1]) * 100 + Number(m[2]);
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // パスワード照合（環境変数から取得）
  const { password, helper, user, from, to } = req.query;
  if (!isAuthorized(password)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // ログイン時の照合のみ（check=1）の場合はここで返す
  if (req.query.check) {
    return res.status(200).json({ ok: true, role: 'user' });
  }

  // 検索条件を組み立てる（論理削除済みは常に除外）
  const where = ['deleted_at IS NULL'];
  const params = [];
  if (helper) { params.push(`%${String(helper).trim()}%`); where.push(`helper_name ILIKE $${params.length}`); }
  if (user)   { params.push(`%${String(user).trim()}%`);   where.push(`user_name ILIKE $${params.length}`); }
  const fromNum = ymNum(from);
  const toNum   = ymNum(to);
  if (fromNum) { params.push(fromNum); where.push(`(report_year * 100 + report_month) >= $${params.length}`); }
  if (toNum)   { params.push(toNum);   where.push(`(report_year * 100 + report_month) <= $${params.length}`); }

  const text =
    `SELECT * FROM helper_reports WHERE ${where.join(' AND ')}` +
    ` ORDER BY report_year DESC, report_month DESC, report_day DESC, created_at DESC` +
    ` LIMIT ${MAX_ROWS}`;

  try {
    const sql = getSql();
    const rows = await sql.query(text, params);
    return res.status(200).json(rows.map(toRecord));
  } catch (e) {
    console.error('helper_reports select failed:', e.code || e.name || 'unknown');
    return res.status(500).json({ error: '検索に失敗しました' });
  }
}
