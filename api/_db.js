// API 共通ユーティリティ（先頭が _ のファイルは Vercel Functions として公開されない）
import { neon } from '@neondatabase/serverless';

let _sql = null;

// Neon への接続（DATABASE_URL は Vercel 環境変数で管理）
export function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL が設定されていません');
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

// CORS ヘッダー
export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// パスワード照合（環境変数 SEARCH_PASSWORD と一致するか）
export function isAuthorized(password) {
  const expected = process.env.SEARCH_PASSWORD;
  return !!expected && typeof password === 'string' && password === expected;
}

// 和暦ラベル（例: 令和8年（2026年））
export function eraLabel(year) {
  if (!year) return '';
  if (year >= 2019) return `令和${year - 2018}年（${year}年）`;
  if (year >= 1989) return `平成${year - 1988}年（${year}年）`;
  return `${year}年`;
}

// 曜日ラベル
export function dowLabel(year, month, day) {
  if (!year || !month || !day) return '';
  return ['日', '月', '火', '水', '木', '金', '土'][new Date(year, month - 1, day).getDay()];
}

// TIME 型の値（"09:30:00"）を "09:30" に整形
function hhmm(v) {
  if (!v) return '';
  return String(v).slice(0, 5);
}

// DB の行を、検索画面が期待する日本語キーのレコードに変換する
export function toRecord(row) {
  const y = row.report_year, m = row.report_month, d = row.report_day;
  const rec = {
    id: row.id,
    '送信日時': row.created_at ? new Date(row.created_at).toISOString() : '',
    '年月': y && m ? `${eraLabel(y)}${m}月` : '',
    '活動日': d ? `${d}日（${dowLabel(y, m, d)}）` : '',
    'ヘルパー氏名': row.helper_name || '',
    '利用者氏名': row.user_name || '',
    '開始': hhmm(row.start_time),
    '終了': hhmm(row.end_time),
    '種別': row.category || '',
    '支援費区分': row.support_type || '',
    '特記事項': row.notes || '',
    '預り金': row.deposit ?? 0,
    '使用総額': row.total_used ?? 0,
    '返金予定額': row.total_refund ?? 0,
    '返金額': row.actual_refund ?? '',
    '差額': row.diff ?? 0,
    '差額理由': row.diff_reason || '',
  };
  ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 's1', 's2', 's3', 's4', 's5', 's6'].forEach(k => {
    rec[k] = row[k] ? '✓' : '';
  });
  const expenses = Array.isArray(row.expenses) ? row.expenses : [];
  for (let i = 0; i < 15; i++) {
    const e = expenses[i] || {};
    rec[`摘要${i + 1}`] = e.desc || '';
    rec[`金額${i + 1}`] = (e.amount ?? '') === '' ? '' : e.amount;
  }
  return rec;
}
