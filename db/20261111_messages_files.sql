-- 私信支持多个附件：files 存 JSON 数组（旧单附件列保留，用于历史消息读取）
ALTER TABLE messages ADD COLUMN files TEXT DEFAULT '';
