-- 大文件分片上传：chunks > 0 表示文件被切成多个 20MB 分片存放在 KV
ALTER TABLE files ADD COLUMN chunks INTEGER DEFAULT 0;
