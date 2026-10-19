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
  join_date TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
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
  date TEXT
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
  read INTEGER DEFAULT 0
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
