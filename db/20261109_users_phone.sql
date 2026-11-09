-- 登录必须绑定手机号（用于违规精准溯源）
ALTER TABLE users ADD COLUMN phone TEXT DEFAULT '';
