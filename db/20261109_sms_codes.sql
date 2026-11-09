-- 短信验证码：注册 / 忘记密码 / 绑定与更换手机号
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
