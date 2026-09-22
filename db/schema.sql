-- ヘルパー活動報告書テーブル
-- 共有 Neon DB（careplan-delivery / kigen-kanri と同一）に追加する
CREATE TABLE IF NOT EXISTS helper_reports (
  id             BIGSERIAL PRIMARY KEY,
  report_year    INTEGER      NOT NULL,             -- 年（西暦）
  report_month   INTEGER      NOT NULL,             -- 月
  report_day     INTEGER,                           -- 活動日
  helper_name    TEXT         NOT NULL,             -- ヘルパー氏名
  user_name      TEXT         NOT NULL,             -- 利用者氏名
  start_time     TIME,                              -- 開始時刻
  end_time       TIME,                              -- 終了時刻
  category       TEXT,                              -- 種別（個別支援型 / グループ支援型）
  support_type   TEXT,                              -- 支援費区分
  notes          TEXT,                              -- 活動内容・特記事項
  -- ヘルパーの活動チェック
  c1             BOOLEAN      NOT NULL DEFAULT FALSE, -- ご本人の意向を確認した
  c2             BOOLEAN      NOT NULL DEFAULT FALSE, -- 活動時間はご家族に了解と確認を得た
  c3             BOOLEAN      NOT NULL DEFAULT FALSE, -- 活動報告をご家族にした
  c4             BOOLEAN      NOT NULL DEFAULT FALSE, -- ご本人から目を離したり見失いはなかった
  c5             BOOLEAN      NOT NULL DEFAULT FALSE, -- 預かり金はご家族に正確に返した
  c6             BOOLEAN      NOT NULL DEFAULT FALSE, -- 守秘義務は守られた
  -- ご利用者様の様子
  s1             BOOLEAN      NOT NULL DEFAULT FALSE, -- 叫び声を出された
  s2             BOOLEAN      NOT NULL DEFAULT FALSE, -- 道中でトラブルがあった
  s3             BOOLEAN      NOT NULL DEFAULT FALSE, -- ケガをされた
  s4             BOOLEAN      NOT NULL DEFAULT FALSE, -- パニックがあった
  s5             BOOLEAN      NOT NULL DEFAULT FALSE, -- 他傷・自傷行為があった
  s6             BOOLEAN      NOT NULL DEFAULT FALSE, -- トイレの失敗をされた
  -- 預り金・使用額
  deposit        INTEGER      NOT NULL DEFAULT 0,   -- 預り金
  expenses       JSONB        NOT NULL DEFAULT '[]', -- 摘要・使用額の明細 [{ "desc": "...", "amount": 0 }]
  total_used     INTEGER      NOT NULL DEFAULT 0,   -- 使用総額
  total_refund   INTEGER      NOT NULL DEFAULT 0,   -- 返金予定額
  actual_refund  INTEGER,                           -- 返金額（未入力は NULL）
  diff           INTEGER      NOT NULL DEFAULT 0,   -- 差額（返金額 − 返金予定額）
  diff_reason    TEXT,                              -- 差額の理由
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(), -- 送信日時
  deleted_at     TIMESTAMPTZ                         -- 論理削除日時（NULL = 有効）
);

-- 既存テーブルへの列追加（作成済み環境向け）
ALTER TABLE helper_reports ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS helper_reports_ym_idx     ON helper_reports (report_year, report_month, report_day);
CREATE INDEX IF NOT EXISTS helper_reports_helper_idx ON helper_reports (helper_name);
CREATE INDEX IF NOT EXISTS helper_reports_user_idx   ON helper_reports (user_name);
