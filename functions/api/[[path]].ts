// 百工论坛 API —— Cloudflare Pages Functions 单文件路由器
// 绑定：D1 = env.DB，KV = env.FILES（见 wrangler.toml）

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------- 最小类型声明（不依赖 @cloudflare/workers-types；本目录不被前端 tsconfig 编译） ----------
interface D1Result<T = any> {
  results?: T[]
  success: boolean
  meta?: Record<string, any>
}
interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement
  first<T = any>(columnName?: string): Promise<T | null>
  run(): Promise<D1Result>
  all<T = any>(): Promise<D1Result<T>>
}
interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>
}
interface KVObjectMeta { contentType?: string }
interface KVNamespace {
  put(key: string, value: ArrayBuffer | ReadableStream | string, options?: { metadata?: KVObjectMeta }): Promise<void>
  getWithMetadata(key: string, options?: { type: 'arrayBuffer' }): Promise<{ value: ArrayBuffer | null; metadata: KVObjectMeta | null }>
  delete(key: string): Promise<void>
}
interface Env {
  DB: D1Database
  FILES: KVNamespace
}
interface EventContext {
  request: Request
  env: Env
}

// ---------- 通用工具 ----------
function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function err(message: string, status: number): Response {
  return json({ error: message }, status)
}

function toHex(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const b of arr) s += b.toString(16).padStart(2, '0')
  return s
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

// PBKDF2-SHA256，100000 迭代，16 字节随机 salt，存储为 salt:hash（hex）
async function hashPassword(password: string, storedSaltHex?: string): Promise<string> {
  const saltHex = storedSaltHex || toHex(crypto.getRandomValues(new Uint8Array(16)))
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(saltHex), iterations: 100000 }, key, 256)
  return `${saltHex}:${toHex(bits)}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = String(stored || '').split(':')
  if (!salt || !hash) return false
  const computed = await hashPassword(password, salt)
  return computed === `${salt}:${hash}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// 服务器按 UTC+8 换算
function today(): string {
  const d = new Date(Date.now() + 8 * 3600e3)
  return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`
}

function nowDateTime(): string {
  const d = new Date(Date.now() + 8 * 3600e3)
  return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

// 把 "YYYY.MM.DD HH:mm"（北京时间）解析为毫秒时间戳
function parseDateTimeMs(value: string): number {
  const m = /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2})$/.exec(value || '')
  if (!m) return 0
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - 8 * 3600e3
}

async function parseBody(req: Request): Promise<any> {
  try {
    return await req.json()
  } catch {
    return {}
  }
}

function getToken(req: Request): string {
  const auth = req.headers.get('Authorization') || ''
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
}

// 线上库结构自愈：确保 users.country 与板块扩展列存在（每个实例只尝试一次）
let schemaReady = false
async function ensureSchema(env: Env): Promise<void> {
  if (schemaReady) return
  schemaReady = true
  const statements = [
    'CREATE TABLE IF NOT EXISTS tracks (id TEXT PRIMARY KEY, title TEXT NOT NULL, artist TEXT DEFAULT \'\', uploader_id TEXT, uploader_name TEXT DEFAULT \'\', mime TEXT DEFAULT \'audio/mpeg\', size INTEGER DEFAULT 0, created_at TEXT)',
    "ALTER TABLE users ADD COLUMN country TEXT DEFAULT ''",
    "ALTER TABLE categories ADD COLUMN description TEXT DEFAULT ''",
    'ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0',
    'ALTER TABLE categories ADD COLUMN moderator_id TEXT',
  ]
  for (const sql of statements) {
    try {
      await env.DB.prepare(sql).run()
    } catch {
      // 列已存在时 SQLite 会报 duplicate column name，忽略即可
    }
  }
}

interface UserRow {
  id: string
  username: string
  password: string
  name: string
  avatar: string | null
  bio: string | null
  role: string | null
  banned: number | null
  join_date: string | null
  country: string | null
}

async function getUser(req: Request, env: Env): Promise<UserRow | null> {
  const token = getToken(req)
  if (!token) return null
  const row = await env.DB.prepare(
    'SELECT u.id, u.username, u.password, u.name, u.avatar, u.bio, u.role, u.banned, u.join_date, u.country ' +
      'FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
  )
    .bind(token)
    .first<UserRow>()
  return row || null
}

// 写操作守卫：要求登录，banned 拒绝；admin=true 时要求管理员
async function requireUser(req: Request, env: Env, admin = false): Promise<UserRow | Response> {
  const user = await getUser(req, env)
  if (!user) return err('请先登录', 401)
  if (admin && user.role !== 'admin') return err('需要管理员权限', 403)
  if (user.banned) return err('账号已被封禁', 403)
  return user
}

async function createSession(env: Env, userId: string): Promise<string> {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)))
  await env.DB.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)')
    .bind(token, userId, Date.now())
    .run()
  return token
}

// ---------- 行记录 → 前端模型 ----------
function toUser(r: UserRow) {
  return {
    id: r.id,
    username: r.username,
    name: r.name,
    avatar: r.avatar || '',
    bio: r.bio || undefined,
    role: (r.role as 'admin' | 'user') || 'user',
    banned: !!r.banned,
    joinDate: r.join_date || '',
    country: r.country || '',
  }
}

function toAttachment(f: any) {
  return { id: f.id, name: f.name, size: f.size, type: f.type }
}

function toPost(row: any, commentCount: number, attachments: any[]) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary || '',
    category: row.category || '',
    author: row.author || '',
    authorId: row.author_id || undefined,
    date: row.date || '',
    views: row.views || 0,
    comments: commentCount,
    pinned: !!row.pinned,
    attachments: attachments.length > 0 ? attachments.map(toAttachment) : undefined,
  }
}

function toComment(r: any) {
  return {
    id: r.id,
    postId: r.post_id,
    author: r.author || '',
    authorId: r.author_id || undefined,
    content: r.content || '',
    date: r.date || '',
    parentId: r.parent_id || undefined,
  }
}

function toMessage(r: any) {
  return {
    id: r.id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    receiverId: r.receiver_id,
    receiverName: r.receiver_name,
    content: r.content || '',
    date: r.date || '',
    read: !!r.read,
    recalled: !!r.recalled,
    file: r.file_id
      ? { id: r.file_id, name: r.file_name || '文件', size: r.file_size || 0, type: r.file_type || '' }
      : undefined,
  }
}

function toWarehouseItem(r: any) {
  return {
    id: r.id,
    name: r.name,
    category: r.category || '',
    quantity: r.quantity || 0,
    unit: r.unit || '',
    location: r.location || '',
    updatedAt: r.updated_at || '',
    ownerId: r.owner_id || undefined,
    ownerName: r.owner_name || undefined,
    status: (r.status as 'normal' | 'low' | 'out') || 'normal',
  }
}

function toCollection(r: any) {
  return { id: r.id, userId: r.user_id, postId: r.post_id, date: r.date || '' }
}

/** 板块列表（含帖子数、简介与板块管理员） */
async function loadCategories(env: Env) {
  const cats = await env.DB.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all<any>()
  const counts = await env.DB.prepare('SELECT category, COUNT(*) AS c FROM posts GROUP BY category').all<any>()
  const us = await env.DB.prepare('SELECT id, name FROM users').all<any>()
  const countByName = new Map<string, number>()
  for (const r of counts.results || []) countByName.set(r.category, r.c)
  const nameById = new Map<string, string>()
  for (const r of us.results || []) nameById.set(r.id, r.name)
  return (cats.results || []).map(c => ({
    id: c.id,
    name: c.name,
    count: countByName.get(c.name) || 0,
    description: c.description || '',
    moderatorId: c.moderator_id || '',
    moderatorName: c.moderator_id ? (nameById.get(c.moderator_id) || '') : '',
  }))
}

/** 单个板块完整信息（用于增改接口返回） */
async function categoryPayload(env: Env, c: any) {
  const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM posts WHERE category = ?')
    .bind(c.name)
    .first<{ c: number }>()
  let moderatorName = ''
  if (c.moderator_id) {
    const row = await env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(c.moderator_id).first<{ name: string }>()
    moderatorName = row?.name || ''
  }
  return {
    id: c.id,
    name: c.name,
    count: count?.c || 0,
    description: c.description || '',
    moderatorId: c.moderator_id || '',
    moderatorName,
  }
}

/** 是否为本板块的管理员 */
async function canModerateCategory(env: Env, userId: string, categoryName: string): Promise<boolean> {
  if (!categoryName) return false
  const row = await env.DB.prepare('SELECT id FROM categories WHERE name = ? AND moderator_id = ?')
    .bind(categoryName, userId)
    .first()
  return !!row
}

/** 管理帖子/评论的权限：全局管理员或该板块管理员 */
async function canModeratePost(env: Env, user: UserRow, category: string | null | undefined): Promise<boolean> {
  if (user.role === 'admin') return true
  return canModerateCategory(env, user.id, category || '')
}

async function loadPost(env: Env, id: string) {
  const row = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<any>()
  if (!row) return null
  const cc = await env.DB.prepare('SELECT COUNT(*) AS c FROM comments WHERE post_id = ?').bind(id).first<{ c: number }>()
  const files = await env.DB.prepare('SELECT id, name, size, type FROM files WHERE post_id = ?').bind(id).all<any>()
  return toPost(row, cc?.c || 0, files.results || [])
}

// ---------- 认证 ----------
async function register(req: Request, env: Env): Promise<Response> {
  const body = await parseBody(req)
  const username = String(body.username || '').trim()
  const password = String(body.password || '')
  const name = String(body.name || '').trim()
  const country = String(body.country || '').trim().slice(0, 32)
  if (!username || !password || !name) return err('用户名、密码和昵称不能为空', 400)
  if (!country) return err('请选择所在国家或地区', 400)
  const exists = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
  if (exists) return err('用户名已存在', 409)
  const id = crypto.randomUUID()
  const pwd = await hashPassword(password)
  await env.DB.prepare(
    'INSERT INTO users (id, username, password, name, avatar, bio, role, banned, join_date, country) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)'
  )
    .bind(id, username, pwd, name, name.slice(0, 1), '', 'user', today(), country)
    .run()
  const token = await createSession(env, id)
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>()
  return json({ token, user: toUser(row as UserRow) })
}

async function login(req: Request, env: Env): Promise<Response> {
  const body = await parseBody(req)
  const username = String(body.username || '').trim()
  const password = String(body.password || '')
  if (!username || !password) return err('用户名和密码不能为空', 400)
  const row = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first<UserRow>()
  if (!row || !(await verifyPassword(password, row.password))) return err('用户名或密码错误', 401)
  const token = await createSession(env, row.id)
  return json({ token, user: toUser(row) })
}

async function logout(req: Request, env: Env): Promise<Response> {
  const token = getToken(req)
  if (!token) return err('请先登录', 401)
  await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
  return json({ ok: true })
}

// ---------- 启动数据 ----------
async function bootstrap(req: Request, env: Env): Promise<Response> {
  const user = await getUser(req, env)

  const users = await env.DB.prepare('SELECT * FROM users').all<UserRow>()
  const cats = await env.DB.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all<any>()
  const posts = await env.DB.prepare('SELECT * FROM posts ORDER BY pinned DESC, date DESC').all<any>()
  const comments = await env.DB.prepare('SELECT * FROM comments ORDER BY date ASC').all<any>()
  const warehouse = await env.DB.prepare('SELECT * FROM warehouse').all<any>()
  const files = await env.DB.prepare('SELECT id, name, size, type, post_id FROM files WHERE post_id IS NOT NULL').all<any>()
  const counts = await env.DB.prepare('SELECT post_id, COUNT(*) AS c FROM comments GROUP BY post_id').all<any>()

  const filesByPost = new Map<string, any[]>()
  for (const f of files.results || []) {
    if (!f.post_id) continue
    const list = filesByPost.get(f.post_id) || []
    list.push(f)
    filesByPost.set(f.post_id, list)
  }
  const countByPost = new Map<string, number>()
  for (const r of counts.results || []) countByPost.set(r.post_id, r.c)
  const countByCat = new Map<string, number>()
  for (const p of posts.results || []) countByCat.set(p.category, (countByCat.get(p.category) || 0) + 1)
  const userNameById = new Map<string, string>()
  for (const r of users.results || []) userNameById.set(r.id, r.name)

  let messages: any[] = []
  let collections: any[] = []
  if (user) {
    const msgs = await env.DB.prepare(
      'SELECT * FROM messages WHERE sender_id = ? OR receiver_id = ? ORDER BY date ASC'
    )
      .bind(user.id, user.id)
      .all<any>()
    const cols = await env.DB.prepare('SELECT * FROM collections WHERE user_id = ?').bind(user.id).all<any>()
    messages = (msgs.results || []).map(toMessage)
    collections = (cols.results || []).map(toCollection)
  }

  return json({
    me: user ? toUser(user) : null,
    users: (users.results || []).map(toUser),
    categories: (cats.results || []).map(c => ({
      id: c.id,
      name: c.name,
      count: countByCat.get(c.name) || 0,
      description: c.description || '',
      moderatorId: c.moderator_id || '',
      moderatorName: c.moderator_id ? (userNameById.get(c.moderator_id) || '') : '',
    })),
    posts: (posts.results || []).map(p => toPost(p, countByPost.get(p.id) || 0, filesByPost.get(p.id) || [])),
    comments: (comments.results || []).map(toComment),
    warehouse: (warehouse.results || []).map(toWarehouseItem),
    messages,
    collections,
  })
}

// ---------- 帖子 ----------
async function createPost(req: Request, env: Env): Promise<Response> {
  const u = await requireUser(req, env)
  if (u instanceof Response) return u
  const body = await parseBody(req)
  const title = String(body.title || '').trim()
  if (!title) return err('标题不能为空', 400)
  const summary = String(body.summary || '').trim()
  const category = String(body.category || '').trim()
  const id = crypto.randomUUID()
  await env.DB.prepare(
    'INSERT INTO posts (id, title, summary, category, author_id, author, date, views, pinned) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)'
  )
    .bind(id, title, summary, category, u.id, u.name, today())
    .run()
  // 附件元数据由客户端先上传后透传，这里把属于当前用户的文件挂到帖子下
  const atts = Array.isArray(body.attachments) ? body.attachments : []
  for (const a of atts) {
    if (a && a.id) {
      await env.DB.prepare('UPDATE files SET post_id = ? WHERE id = ? AND uploader_id = ?')
        .bind(id, String(a.id), u.id)
        .run()
    }
  }
  return json({ post: await loadPost(env, id) })
}

async function deletePost(req: Request, env: Env, params: string[]): Promise<Response> {
  const u = await requireUser(req, env)
  if (u instanceof Response) return u
  const id = params[0]
  const row = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<any>()
  if (!row) return err('帖子不存在', 404)
  if (row.author_id !== u.id && !(await canModeratePost(env, u, row.category))) return err('无权删除该帖子', 403)
  const files = await env.DB.prepare('SELECT id FROM files WHERE post_id = ?').bind(id).all<{ id: string }>()
  for (const f of files.results || []) {
    try {
      await env.FILES.delete(f.id)
    } catch {
      // R2 对象可能已不存在，忽略
    }
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM comments WHERE post_id = ?').bind(id),
    env.DB.prepare('DELETE FROM collections WHERE post_id = ?').bind(id),
    env.DB.prepare('DELETE FROM files WHERE post_id = ?').bind(id),
    env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id),
  ])
  return json({ ok: true })
}

async function pinPost(req: Request, env: Env, params: string[]): Promise<Response> {
  const u = await requireUser(req, env)
  if (u instanceof Response) return u
  const id = params[0]
  const row = await env.DB.prepare('SELECT pinned, category FROM posts WHERE id = ?')
    .bind(id)
    .first<{ pinned: number; category: string | null }>()
  if (!row) return err('帖子不存在', 404)
  if (!(await canModeratePost(env, u, row.category))) return err('无权置顶该板块的帖子', 403)
  await env.DB.prepare('UPDATE posts SET pinned = ? WHERE id = ?').bind(row.pinned ? 0 : 1, id).run()
  return json({ post: await loadPost(env, id) })
}

async function viewPost(_req: Request, env: Env, params: string[]): Promise<Response> {
  const id = params[0]
  const row = await env.DB.prepare('SELECT views FROM posts WHERE id = ?').bind(id).first<{ views: number }>()
  if (!row) return err('帖子不存在', 404)
  await env.DB.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').bind(id).run()
  return json({ views: (row.views || 0) + 1 })
}

async function addComment(req: Request, env: Env, params: string[]): Promise<Response> {
  const u = await requireUser(req, env)
  if (u instanceof Response) return u
  const postId = params[0]
  const post = await env.DB.prepare('SELECT id FROM posts WHERE id = ?').bind(postId).first()
  if (!post) return err('帖子不存在', 404)
  const body = await parseBody(req)
  const content = String(body.content || '').trim()
  if (!content) return err('评论内容不能为空', 400)
  const parentId = String(body.parentId || '').trim() || null
  if (parentId) {
    const parent = await env.DB.prepare('SELECT id FROM comments WHERE id = ? AND post_id = ?')
      .bind(parentId, postId)
      .first()
    if (!parent) return err('回复的评论不存在', 404)
  }
  const comment = {
    id: crypto.randomUUID(),
    postId,
    author: u.name,
    authorId: u.id,
    content,
    date: nowDateTime(),
    parentId: parentId || undefined,
  }
  await env.DB.prepare(
    'INSERT INTO comments (id, post_id, author_id, author, content, date, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(comment.id, postId, u.id, u.name, content, comment.date, parentId || '')
    .run()
  return json({ comment })
}

// 删除评论：作者本人或管理员，连带删除其下所有回复
async function deleteComment(req: Request, env: Env, params: string[]): Promise<Response> {
  const u = await requireUser(req, env)
  if (u instanceof Response) return u
  const id = params[0]
  const row = await env.DB.prepare(
    'SELECT c.id, c.post_id, c.author_id, p.category FROM comments c LEFT JOIN posts p ON p.id = c.post_id WHERE c.id = ?'
  )
    .bind(id)
    .first<any>()
  if (!row) return err('评论不存在', 404)
  if (row.author_id !== u.id && !(await canModeratePost(env, u, row.category))) return err('无权删除该评论', 403)
  const tree = await env.DB.prepare(
    'WITH RECURSIVE sub(id) AS (' +
      'SELECT id FROM comments WHERE id = ? ' +
      'UNION ALL SELECT c.id FROM comments c JOIN sub s ON c.parent_id = s.id' +
    ') SELECT id FROM sub'
  )
    .bind(id)
    .all<{ id: string }>()
  const ids = (tree.results || []).map(r => r.id)
  if (ids.length === 0) return err('评论不存在', 404)
  await env.DB.prepare(`DELETE FROM comments WHERE id IN (${ids.map(() => '?').join(',')})`)
    .bind(...ids)
    .run()
  return json({ ok: true, postId: row.post_id, deletedIds: ids })
}

async function collectPost(req: Request, env: Env, params: string[]): Promise<Response> {
  const u = await requireUser(req, env)
  if (u instanceof Response) return u
  const postId = params[0]
  const post = await env.DB.prepare('SELECT id FROM posts WHERE id = ?').bind(postId).first()
  if (!post) return err('帖子不存在', 404)
  const existing = await env.DB.prepare('SELECT id FROM collections WHERE user_id = ? AND post_id = ?')
    .bind(u.id, postId)
    .first<{ id: string }>()
  if (existing) {
    await env.DB.prepare('DELETE FROM collections WHERE id = ?').bind(existing.id).run()
    return json({ collected: false })
  }
  await env.DB.prepare('INSERT INTO collections (id, user_id, post_id, date) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), u.id, postId, today())
    .run()
  return json({ collected: true })
}

// ---------- 板块 / 用户管理 ----------
async function createCategory(req: Request, env: Env): Promise<Response> {
  const u = await requireUser(req, env, true)
  if (u instanceof Response) return u
  const body = await parseBody(req)
  const name = String(body.name || '').trim()
  if (!name) return err('板块名称不能为空', 400)
  if (name.length > 20) return err('板块名称最多 20 个字符', 400)
  const description = String(body.description || '').trim().slice(0, 120)
  const exists = await env.DB.prepare('SELECT id FROM categories WHERE name = ?').bind(name).first()
  if (exists) return err('板块已存在', 409)
  const max = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories').first<{ m: number }>()
  const id = crypto.randomUUID()
  await env.DB.prepare('INSERT INTO categories (id, name, description, sort_order) VALUES (?, ?, ?, ?)')
    .bind(id, name, description, (max?.m ?? -1) + 1)
    .run()
  return json({ category: await categoryPayload(env, { id, name, description, moderator_id: '' }) })
}

// 修改板块：全局管理员，或该板块管理员（板块管理员只能改自己板块的名称与简介）
async function updateCategory(req: Request, env: Env, params: string[]): Promise<Response> {
  const u = await requireUser(req, env)
  if (u instanceof Response) return u
  const cat = await env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(params[0]).first<any>()
  if (!cat) return err('板块不存在', 404)
  if (u.role !== 'admin' && cat.moderator_id !== u.id) return err('无权修改该板块', 403)
  const body = await parseBody(req)
  const name = body.name !== undefined ? String(body.name).trim() : cat.name
  if (!name) return err('板块名称不能为空', 400)
  if (name.length > 20) return err('板块名称最多 20 个字符', 400)
  if (name !== cat.name) {
    const dup = await env.DB.prepare('SELECT id FROM categories WHERE name = ?').bind(name).first()
    if (dup) return err('板块已存在', 409)
  }
  const description = body.description !== undefined
    ? String(body.description).trim().slice(0, 120)
    : (cat.description || '')
  const batch = [env.DB.prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?').bind(name, description, cat.id)]
  if (name !== cat.name) {
    batch.push(env.DB.prepare('UPDATE posts SET category = ? WHERE category = ?').bind(name, cat.name))
  }
  await env.DB.batch(batch)
  return json({ category: await categoryPayload(env, { ...cat, name, description }) })
}

async function deleteCategory(req: Request, env: Env, params: string[]): Promise<Response> {
  const u = await requireUser(req, env, true)
  if (u instanceof Response) return u
  const cat = await env.DB.prepare('SELECT id, name FROM categories WHERE id = ?').bind(params[0]).first<any>()
  if (!cat) return err('板块不存在', 404)
  const cnt = await env.DB.prepare('SELECT COUNT(*) AS c FROM posts WHERE category = ?')
    .bind(cat.name)
    .first<{ c: number }>()
  const n = cnt?.c || 0
  if (n > 0) return err(`该板块下还有 ${n} 篇帖子，请先删除或转移帖子后再删除板块`, 400)
  await env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(cat.id).run()
  return json({ ok: true })
}

// 指定 / 取消板块管理员（仅全局管理员）
async function setCategoryModerator(req: Request, env: Env, params: string[]): Promise<Response> {
  const u = await requireUser(req, env, true)
  if (u instanceof Response) return u
  const cat = await env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(params[0]).first<any>()
  if (!cat) return err('板块不存在', 404)
  const body = await parseBody(req)
  const userId = String(body.userId || '').trim()
  if (userId) {
    const target = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first()
    if (!target) return err('用户不存在', 404)
  }
  await env.DB.prepare('UPDATE categories SET moderator_id = ? WHERE id = ?').bind(userId, cat.id).run()
  return json({ category: await categoryPayload(env, { ...cat, moderator_id: userId }) })
}

// 调整板块顺序：全局管理员，direction = up | down
async function moveCategory(req: Request, env: Env, params: string[]): Promise<Response> {
  const u = await requireUser(req, env, true)
  if (u instanceof Response) return u
  const rows = (await env.DB.prepare('SELECT id FROM categories ORDER BY sort_order ASC, name ASC').all<{ id: string }>())
    .results || []
  const idx = rows.findIndex(r => r.id === params[0])
  if (idx < 0) return err('板块不存在', 404)
  const body = await parseBody(req)
  const j = String(body.direction) === 'up' ? idx - 1 : idx + 1
  if (j < 0 || j >= rows.length) return json({ categories: await loadCategories(env) })
  // 先按当前展示顺序规范化 sort_order，再交换相邻两项
  const batch = rows.map((r, i) => (
    env.DB.prepare('UPDATE categories SET sort_order = ? WHERE id = ?')
      .bind(i === idx ? j : i === j ? idx : i, r.id)
  ))
  await env.DB.batch(batch)
  return json({ categories: await loadCategories(env) })
}

// ---------- 工业电台：任何登录用户可上传，所有人可收听 ----------
const TRACK_MAX_BYTES = 20 * 1024 * 1024

function toTrack(r: any) {
  return {
    id: r.id,
    title: r.title,
    artist: r.artist || '',
    uploaderId: r.uploader_id || '',
    uploaderName: r.uploader_name || '',
    size: r.size || 0,
    createdAt: r.created_at || '',
  }
}

async function loadTracks(env: Env) {
  const rows = await env.DB.prepare(
    'SELECT id, title, artist, uploader_id, uploader_name, size, created_at FROM tracks ORDER BY created_at DESC'
  ).all<any>()
  return (rows.results || []).map(toTrack)
}

async function listTracks(req: Request, env: Env): Promise<Response> {
  return json({ tracks: await loadTracks(env) })
}

async function uploadTrack(req: Request, env: Env): Promise<Response> {
  const u = await requireUser(req, env)
  if (u instanceof Response) return u
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return err('上传格式不正确', 400)
  }
  const entry = form.get('file')
  if (!entry || typeof entry === 'string') return err('请选择音频文件', 400)
  const file = entry as any
  const mime = String(file.type || '')
  if (!mime.startsWith('audio/')) return err('仅支持音频文件', 400)
  if (Number(file.size) > TRACK_MAX_BYTES) return err('音频不能超过 20MB', 400)
  const rawTitle = String(form.get('title') || '').trim() || String(file.name || '').replace(/\.\w+$/, '')
  const title = rawTitle.slice(0, 60) || '未命名曲目'
  const id = crypto.randomUUID()
  const buffer: ArrayBuffer = await file.arrayBuffer()
  await env.FILES.put(`music/${id}`, buffer, { metadata: { contentType: mime } })
  await env.DB.prepare(
    'INSERT INTO tracks (id, title, artist, uploader_id, uploader_name, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, title, u.name, u.id, u.name, mime, buffer.byteLength, new Date().toISOString())
    .run()
  const row = await env.DB.prepare('SELECT * FROM tracks WHERE id = ?').bind(id).first<any>()
  return json({ track: toTrack(row) })
}

// 音频流：支持 Range，便于浏览器拖动进度条
async function trackAudio(req: Request, env: Env, params: string[]): Promise<Response> {
  const obj = await env.FILES.getWithMetadata(`music/${params[0]}`, { type: 'arrayBuffer' })
  if (!obj.value) return new Response('Not found', { status: 404 })
  const buffer = obj.value
  const total = buffer.byteLength
  const mime = obj.metadata?.contentType || 'audio/mpeg'
  const headers: Record<string, string> = {
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
  }
  const range = req.headers.get('Range')
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range)
    if (match) {
      let start = match[1] ? parseInt(match[1], 10) : 0
      let end = match[2] ? parseInt(match[2], 10) : total - 1
      if (start >= total) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } })
      }
      end = Math.min(end, total - 1)
      const chunk = buffer.slice(start, end + 1)
      return new Response(chunk, {
        status: 206,
        headers: {
          ...headers,
          'Content-Length': String(end - start + 1),
          'Content-Range': `bytes ${start}-${end}/${total}`,
        },
      })
    }
  }
  return new Response(buffer, { headers: { ...headers, 'Content-Length': String(total) } })
}

// 删除曲目：上传者本人或全局管理员
async function deleteTrack(req: Request, env: Env, params: string[]): Promise<Response> {
  const u = await requireUser(req, env)
  if (u instanceof Response) return u
  const row = await env.DB.prepare('SELECT uploader_id FROM tracks WHERE id = ?')
    .bind(params[0])
    .first<{ uploader_id: string | null }>()
  if (!row) return err('曲目不存在', 404)
  if (row.uploader_id !== u.id && u.role !== 'admin') return err('无权删除该曲目', 403)
  await env.FILES.delete(`music/${params[0]}`)
  await env.DB.prepare('DELETE FROM tracks WHERE id = ?').bind(params[0]).run()
  return json({ ok: true })
}

async function banUser(req: Request, env: Env, params: string[]): Promise<Response> {
  const u = await requireUser(req, env, true)
  if (u instanceof Response) return u
  const id = params[0]
  const target = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first()
  if (!target) return err('用户不存在', 404)
  const body = await parseBody(req)
  await env.DB.prepare('UPDATE users SET banned = ? WHERE id = ?').bind(body.banned ? 1 : 0, id).run()
  return json({ ok: true })
}

// 修改自己的资料：昵称、简介、头像（头像存文件 id，格式 file:<id>）
async function updateMe(req: Request, env: Env): Promise<Response> {
  const u = await requireUser(req, env)
  if (u instanceof Response) return u
  const body = await parseBody(req)
  const name = body.name !== undefined ? String(body.name).trim() : u.name
  if (!name) return err('昵称不能为空', 400)
  if (name.length > 24) return err('昵称最多 24 个字符', 400)
  const bio = body.bio !== undefined ? String(body.bio).trim() : (u.bio || '')
  if (bio.length > 120) return err('个人简介最多 120 个字符', 400)
  const avatar = body.avatar !== undefined ? String(body.avatar).trim() : (u.avatar || '')
  const country = body.country !== undefined ? String(body.country).trim().slice(0, 32) : (u.country || '')
  if (avatar.startsWith('file:')) {
    const fileId = avatar.slice(5)
    const meta = await env.DB.prepare('SELECT id FROM files WHERE id = ?').bind(fileId).first()
    if (!meta) return err('头像文件不存在，请重新上传', 400)
  }
  await env.DB.prepare('UPDATE users SET name = ?, bio = ?, avatar = ?, country = ? WHERE id = ?')
    .bind(name, bio, avatar, country, u.id)
    .run()
  // 昵称变更后同步所有冗余展示字段
  if (name !== u.name) {
    await env.DB.batch([
      env.DB.prepare('UPDATE posts SET author = ? WHERE author_id = ?').bind(name, u.id),
      env.DB.prepare('UPDATE comments SET author = ? WHERE author_id = ?').bind(name, u.id),
      env.DB.prepare('UPDATE warehouse SET owner_name = ? WHERE owner_id = ?').bind(name, u.id),
      env.DB.prepare('UPDATE messages SET sender_name = ? WHERE sender_id = ?').bind(name, u.id),
      env.DB.prepare('UPDATE messages SET receiver_name = ? WHERE receiver_id = ?').bind(name, u.id),
    ])
  }
  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(u.id).first<UserRow>()
  return json({ user: toUser(row as UserRow) })
}

// ---------- 仓库物料 ----------
async function createWarehouseItem(req: Request, env: Env): Promise<Response> {
  const u = await requireUser(req, env)
  if (u instanceof Response) return u
  const body = await parseBody(req)
  const name = String(body.name || '').trim()
  if (!name) return err('物料名称不能为空', 400)
  const quantity = Number(body.quantity) || 0
  const status = quantity <= 0 ? 'out' : quantity <= 5 ? 'low' : 'normal'
  const id = crypto.randomUUID()
  const updatedAt = today()
  await env.DB.prepare(
    'INSERT INTO warehouse (id, name, category, quantity, unit, location, updated_at, owner_id, owner_name, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(
      id,
      name,
      String(body.category || '').trim(),
      quantity,
      String(body.unit || '').trim(),
      String(body.location || '').trim(),
      updatedAt,
      u.id,
      u.name,
      status
    )
    .run()
  return json({
    item: {
      id,
      name,
      category: String(body.category || '').trim(),
      quantity,
      unit: String(body.unit || '').trim(),
      location: String(body.location || '').trim(),
      updatedAt,
      ownerId: u.id,
      ownerName: u.name,
      status,
    },
  })
}

async function deleteWarehouseItem(req: Request, env: Env, params: string[]): Promise<Response> {
  const u = await requireUser(req, env)
  if (u instanceof Response) return u
  await env.DB.prepare('DELETE FROM warehouse WHERE id = ?').bind(params[0]).run()
  return json({ ok: true })
}

// ---------- 私信 ----------
async function listMessages(req: Request, env: Env): Promise<Response> {
  const u = await requireUser(req, env)
  if (u instanceof Response) return u
  const msgs = await env.DB.prepare(
    'SELECT * FROM messages WHERE sender_id = ? OR receiver_id = ? ORDER BY date ASC'
  )
    .bind(u.id, u.id)
    .all<any>()
  return json({ messages: (msgs.results || []).map(toMessage) })
}

async function sendMessage(req: Request, env: Env): Promise<Response> {
  const u = await requireUser(req, env)
  if (u instanceof Response) return u
  const body = await parseBody(req)
  const receiverId = String(body.receiverId || '').trim()
  const content = String(body.content || '').trim()
  const fileId = String(body.fileId || '').trim()
  if (!content && !fileId) return err('私信内容不能为空', 400)
  const receiver = await env.DB.prepare('SELECT id, name FROM users WHERE id = ?').bind(receiverId).first<{ id: string; name: string }>()
  if (!receiver) return err('接收人不存在', 404)
  let file: any = null
  if (fileId) {
    file = await env.DB.prepare('SELECT id, name, size, type, uploader_id FROM files WHERE id = ?')
      .bind(fileId)
      .first<any>()
    if (!file) return err('附件不存在，请重新上传', 400)
    if (file.uploader_id !== u.id) return err('无权使用该附件', 403)
  }
  const message = {
    id: crypto.randomUUID(),
    senderId: u.id,
    senderName: u.name,
    receiverId: receiver.id,
    receiverName: receiver.name,
    content,
    date: nowDateTime(),
    read: false,
    recalled: false,
    file: file
      ? { id: file.id, name: file.name || '文件', size: file.size || 0, type: file.type || '' }
      : undefined,
  }
  await env.DB.prepare(
    'INSERT INTO messages (id, sender_id, sender_name, receiver_id, receiver_name, content, date, read, recalled, file_id, file_name, file_size, file_type) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)'
  )
    .bind(
      message.id, u.id, u.name, receiver.id, receiver.name, content, message.date,
      file ? file.id : null, file ? file.name : null, file ? file.size : null, file ? file.type : null
    )
    .run()
  return json({ message })
}

// 撤回自己的私信：仅发送后 3 分钟内可撤回，保留占位，正文与附件不再展示
async function recallMessage(req: Request, env: Env, params: string[]): Promise<Response> {
  const u = await requireUser(req, env)
  if (u instanceof Response) return u
  const row = await env.DB.prepare('SELECT id, sender_id, date FROM messages WHERE id = ?').bind(params[0]).first<any>()
  if (!row) return err('消息不存在', 404)
  if (row.sender_id !== u.id) return err('只能撤回自己发送的消息', 403)
  const sentAt = parseDateTimeMs(row.date)
  if (!sentAt || Date.now() - sentAt > 3 * 60 * 1000) return err('发送超过 3 分钟的消息不能撤回', 400)
  await env.DB.prepare(
    'UPDATE messages SET recalled = 1, content = \'\', file_id = NULL, file_name = NULL, file_size = NULL, file_type = NULL WHERE id = ?'
  )
    .bind(row.id)
    .run()
  return json({ ok: true })
}

async function markMessageRead(req: Request, env: Env, params: string[]): Promise<Response> {
  const u = await requireUser(req, env)
  if (u instanceof Response) return u
  await env.DB.prepare('UPDATE messages SET read = 1 WHERE id = ? AND receiver_id = ?').bind(params[0], u.id).run()
  return json({ ok: true })
}

// ---------- 文件 ----------
async function uploadFile(req: Request, env: Env): Promise<Response> {
  const u = await requireUser(req, env)
  if (u instanceof Response) return u
  const form = await req.formData()
  const file = form.get('file')
  if (!file || typeof file === 'string') return err('未选择文件', 400)
  const f = file as File
  const id = crypto.randomUUID()
  const type = f.type || 'application/octet-stream'
  if (f.size > 25 * 1024 * 1024) return err('文件超过 25MB（免费版单文件上限），请压缩后上传', 413)
  const buf = await f.arrayBuffer()
  await env.FILES.put(id, buf, { metadata: { contentType: type } })
  await env.DB.prepare(
    'INSERT INTO files (id, name, size, type, uploader_id, created_at, post_id) VALUES (?, ?, ?, ?, ?, ?, NULL)'
  )
    .bind(id, f.name, f.size, type, u.id, Date.now())
    .run()
  return json({ id, name: f.name, size: f.size, type })
}

async function getFile(_req: Request, env: Env, params: string[], url: URL): Promise<Response> {
  const id = params[0]
  const meta = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(id).first<any>()
  if (!meta) return err('文件不存在', 404)
  const obj = await env.FILES.getWithMetadata(id, { type: 'arrayBuffer' })
  if (!obj.value) return err('文件不存在', 404)
  const download = url.searchParams.get('download') === '1'
  const headers = new Headers()
  headers.set('Content-Type', meta.type || obj.metadata?.contentType || 'application/octet-stream')
  headers.set(
    'Content-Disposition',
    `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(meta.name || 'file')}`
  )
  if (meta.size != null) headers.set('Content-Length', String(meta.size))
  return new Response(obj.value, { headers })
}

async function deleteFile(req: Request, env: Env, params: string[]): Promise<Response> {
  const u = await requireUser(req, env)
  if (u instanceof Response) return u
  const id = params[0]
  const meta = await env.DB.prepare('SELECT uploader_id FROM files WHERE id = ?').bind(id).first<{ uploader_id: string }>()
  if (!meta) return err('文件不存在', 404)
  if (meta.uploader_id !== u.id && u.role !== 'admin') return err('无权删除该文件', 403)
  try {
    await env.FILES.delete(id)
  } catch {
    // R2 对象可能已不存在，忽略
  }
  await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(id).run()
  return json({ ok: true })
}

// ---------- 路由表 ----------
type Handler = (req: Request, env: Env, params: string[], url: URL) => Promise<Response>

const routes: Array<[string, string, Handler]> = [
  ['POST', 'auth/register', register],
  ['POST', 'auth/login', login],
  ['POST', 'auth/logout', (req, env) => logout(req, env)],
  ['GET', 'bootstrap', (req, env) => bootstrap(req, env)],
  ['POST', 'posts', (req, env) => createPost(req, env)],
  ['DELETE', 'posts/*', (req, env, p) => deletePost(req, env, p)],
  ['POST', 'posts/*/pin', (req, env, p) => pinPost(req, env, p)],
  ['POST', 'posts/*/view', (req, env, p) => viewPost(req, env, p)],
  ['POST', 'posts/*/comments', (req, env, p) => addComment(req, env, p)],
  ['DELETE', 'comments/*', (req, env, p) => deleteComment(req, env, p)],
  ['POST', 'posts/*/collect', (req, env, p) => collectPost(req, env, p)],
  ['POST', 'categories', (req, env) => createCategory(req, env)],
  ['POST', 'categories/*', (req, env, p) => updateCategory(req, env, p)],
  ['POST', 'categories/*/moderator', (req, env, p) => setCategoryModerator(req, env, p)],
  ['POST', 'categories/*/move', (req, env, p) => moveCategory(req, env, p)],
  ['DELETE', 'categories/*', (req, env, p) => deleteCategory(req, env, p)],
  ['POST', 'users/me', (req, env) => updateMe(req, env)],
  ['POST', 'users/*/ban', (req, env, p) => banUser(req, env, p)],
  ['POST', 'warehouse', (req, env) => createWarehouseItem(req, env)],
  ['DELETE', 'warehouse/*', (req, env, p) => deleteWarehouseItem(req, env, p)],
  ['GET', 'messages', (req, env) => listMessages(req, env)],
  ['POST', 'messages', (req, env) => sendMessage(req, env)],
  ['DELETE', 'messages/*', (req, env, p) => recallMessage(req, env, p)],
  ['POST', 'messages/*/read', (req, env, p) => markMessageRead(req, env, p)],
  ['POST', 'files', (req, env) => uploadFile(req, env)],
  ['GET', 'files/*', (req, env, p, url) => getFile(req, env, p, url)],
  ['DELETE', 'files/*', (req, env, p) => deleteFile(req, env, p)],
  ['GET', 'tracks', (req, env) => listTracks(req, env)],
  ['POST', 'tracks', (req, env) => uploadTrack(req, env)],
  ['GET', 'tracks/*/audio', (req, env, p) => trackAudio(req, env, p)],
  ['DELETE', 'tracks/*', (req, env, p) => deleteTrack(req, env, p)],
]

export async function onRequest(ctx: EventContext): Promise<Response> {
  const { request, env } = ctx
  try {
    const url = new URL(request.url)
    const seg = url.pathname.split('/').filter(Boolean)
    if (seg[0] !== 'api') return err('接口不存在', 404)
    await ensureSchema(env)
    const path = seg.slice(1)
    const method = request.method.toUpperCase()

    for (const [routeMethod, pattern, handler] of routes) {
      if (routeMethod !== method) continue
      const pp = pattern.split('/')
      if (pp.length !== path.length) continue
      const params: string[] = []
      let matched = true
      for (let i = 0; i < pp.length; i++) {
        if (pp[i] === '*') params.push(path[i])
        else if (pp[i] !== path[i]) {
          matched = false
          break
        }
      }
      if (matched) return await handler(request, env, params, url)
    }
    return err('接口不存在', 404)
  } catch {
    return err('服务器内部错误', 500)
  }
}
