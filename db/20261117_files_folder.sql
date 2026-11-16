-- 附件支持整文件夹上传：记录文件所在的相对目录
ALTER TABLE files ADD COLUMN folder TEXT DEFAULT '';
