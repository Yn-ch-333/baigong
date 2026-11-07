-- 私信：撤回 + 图片/视频/文件附件（不进仓库）
ALTER TABLE messages ADD COLUMN recalled INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN file_id TEXT;
ALTER TABLE messages ADD COLUMN file_name TEXT;
ALTER TABLE messages ADD COLUMN file_size INTEGER;
ALTER TABLE messages ADD COLUMN file_type TEXT;
