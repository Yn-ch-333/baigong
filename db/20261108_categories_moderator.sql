-- 板块扩展：简介、排序、板块管理员
ALTER TABLE categories ADD COLUMN description TEXT DEFAULT '';
ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE categories ADD COLUMN moderator_id TEXT;
