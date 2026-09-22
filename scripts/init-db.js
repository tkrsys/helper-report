// テーブル作成スクリプト（db/schema.sql を実行する）
// 実行: npm run db:init   ※ .env.local の DATABASE_URL を使用
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { neon } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL が設定されていません');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const schema = readFileSync(join(__dirname, '..', 'db', 'schema.sql'), 'utf8');

// コメント行を除去し、セミコロン区切りで1文ずつ実行する
const statements = schema
  .split('\n')
  .map(line => line.replace(/--.*$/, ''))
  .join('\n')
  .split(';')
  .map(s => s.trim())
  .filter(Boolean);

for (const stmt of statements) {
  await sql.query(stmt);
  console.log('OK:', stmt.split('\n')[0].slice(0, 70));
}

const [{ count }] = await sql.query('SELECT count(*)::int AS count FROM helper_reports');
console.log(`helper_reports テーブル準備完了（現在 ${count} 件）`);
