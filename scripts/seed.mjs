// 百工论坛种子数据生成脚本
// 用法：node scripts/seed.mjs > seed.sql
import { pbkdf2Sync, randomBytes } from 'node:crypto'

const ITERATIONS = 100000

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256').toString('hex')
  return `${salt}:${hash}`
}

// SQL 字符串转义（单引号翻倍）
const esc = s => String(s).replace(/'/g, "''")

const lines = []
lines.push('-- 百工论坛种子数据（由 scripts/seed.mjs 生成，请勿手改）')

// 管理员：yn / bg2026
const adminPassword = hashPassword('bg2026')
lines.push(
  `INSERT INTO users (id, username, password, name, avatar, bio, role, banned, join_date) VALUES ('u1', 'yn', '${adminPassword}', '杨工', '杨', '频道主', 'admin', 0, '2025.03.12');`
)

// 板块
const categories = [
  ['1', '技术问答'],
  ['2', '项目展示'],
  ['3', '行业动态'],
  ['4', '招聘求职'],
]
for (const [id, name] of categories) {
  lines.push(`INSERT INTO categories (id, name) VALUES ('${esc(id)}', '${esc(name)}');`)
}

console.log(lines.join('\n'))
