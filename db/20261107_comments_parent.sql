-- 评论支持楼中楼回复
ALTER TABLE comments ADD COLUMN parent_id TEXT;
