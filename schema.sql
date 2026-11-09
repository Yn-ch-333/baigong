-- 百工论坛 D1 数据库结构
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT,
  bio TEXT,
  role TEXT DEFAULT 'user',
  banned INTEGER DEFAULT 0,
  join_date TEXT,
  country TEXT DEFAULT '',
  phone TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  moderator_id TEXT
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  category TEXT,
  author_id TEXT,
  author TEXT,
  date TEXT,
  views INTEGER DEFAULT 0,
  pinned INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  author_id TEXT,
  author TEXT,
  content TEXT,
  date TEXT,
  parent_id TEXT
);

CREATE TABLE IF NOT EXISTS warehouse (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER,
  unit TEXT,
  location TEXT,
  updated_at TEXT,
  owner_id TEXT,
  owner_name TEXT,
  status TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT,
  sender_name TEXT,
  receiver_id TEXT,
  receiver_name TEXT,
  content TEXT,
  date TEXT,
  read INTEGER DEFAULT 0,
  recalled INTEGER DEFAULT 0,
  file_id TEXT,
  file_name TEXT,
  file_size INTEGER,
  file_type TEXT
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  post_id TEXT,
  date TEXT,
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  name TEXT,
  size INTEGER,
  type TEXT,
  uploader_id TEXT,
  created_at INTEGER,
  post_id TEXT
);

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

CREATE TABLE IF NOT EXISTS sms_codes (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL,
  user_id TEXT,
  attempts INTEGER DEFAULT 0,
  used INTEGER DEFAULT 0,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
