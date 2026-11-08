-- 工业电台曲目元数据（音频文件存 KV：music/<id>）
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT DEFAULT '',
  uploader_id TEXT,
  uploader_name TEXT DEFAULT '',
  mime TEXT DEFAULT 'audio/mpeg',
  size INTEGER DEFAULT 0,
  created_at TEXT
);
