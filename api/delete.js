// 活動報告書の削除 API（論理削除：deleted_at に日時を記録するだけで行は残す）
import { getSql, setCors, isAuthorized } from './_db.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const body = req.body || {};
  if (!isAuthorized(body.password)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'id が不正です' });
  }

  try {
    const sql = getSql();
    const rows = await sql.query(
      `UPDATE helper_reports SET deleted_at = now()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '対象の報告書が見つかりません（既に削除済みの可能性があります）' });
    }
    return res.status(200).json({ ok: true, id: rows[0].id, role: 'user' });
  } catch (e) {
    console.error('helper_reports delete failed:', e.code || e.name || 'unknown');
    return res.status(500).json({ error: '削除に失敗しました' });
  }
}
