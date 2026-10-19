# 百工论坛 API 契约（Cloudflare Pages Functions + D1 + R2）

所有接口同源，路径前缀 /api。除标注外均为 JSON。认证使用 Authorization: Bearer <token>，token 由登录/注册返回。

## 数据模型（对应 src/types.ts）

- User: { id, username, name, avatar, bio?, role: admin|user, banned?, joinDate }（绝不返回密码）
- Post: { id, title, summary, content?, category, author, authorId, date, views, comments, pinned?, attachments?: Attachment[] }
- Attachment: { id, name, size, type }（文件本体存 R2，key = id）
- Category: { id, name, count }
- Comment: { id, postId, author, authorId, content, date }
- Message: { id, senderId, senderName, receiverId, receiverName, content, date, read }
- WarehouseItem: { id, name, category, quantity, unit, location, updatedAt, ownerId?, ownerName?, status: normal|low|out }
- Collection: { id, userId, postId, date }

## 接口

### 认证
- POST /api/auth/register body {username, password, name} -> {token, user}；用户名重复 409 {error}
- POST /api/auth/login body {username, password} -> {token, user}；失败 401 {error}
- POST /api/auth/logout（需认证）-> {ok: true}

### 启动数据（一次拉取全部）
- GET /api/bootstrap -> { me: User|null, users: User[], categories: Category[], posts: Post[], comments: Comment[], warehouse: WarehouseItem[], messages: Message[]（仅认证用户自己的，未登录为[]）, collections: Collection[]（仅认证用户自己的，未登录为[]） }

### 帖子
- POST /api/posts（需登录）body {title, summary, category, attachments?: Attachment[]} -> {post}（附件元数据由客户端先 POST /api/files 上传后透传）
- DELETE /api/posts/:id（作者或管理员）-> {ok: true}（级联删评论、收藏、附件记录与 R2 文件）
- POST /api/posts/:id/pin（管理员）-> {post}（置顶切换）
- POST /api/posts/:id/view -> {views: number}（浏览数+1）
- POST /api/posts/:id/comments（需登录）body {content} -> {comment}
- POST /api/posts/:id/collect（需登录）-> {collected: boolean}

### 板块/用户管理（管理员）
- POST /api/categories body {name} -> {category}
- DELETE /api/categories/:id -> {ok: true}
- POST /api/users/:id/ban body {banned: boolean} -> {ok: true}

### 仓库物料（需登录）
- POST /api/warehouse body {name, category, quantity, unit, location} -> {item}（status 服务端计算：qty<=0 out，<=5 low，否则 normal）
- DELETE /api/warehouse/:id -> {ok: true}

### 私信（需登录）
- POST /api/messages body {receiverId, content} -> {message}
- POST /api/messages/:id/read -> {ok: true}

### 文件
- POST /api/files（需登录）multipart 表单字段 file -> {id, name, size, type}（Blob 存 R2，元数据存 D1，uploader_id 记录）
- GET /api/files/:id -> 流式返回，Content-Type 原始类型，Content-Disposition: inline；带 ?download=1 时 attachment
- DELETE /api/files/:id（上传者或管理员）-> {ok: true}

## 后端实现约定

- 单文件路由器 functions/api/[[path]].ts，导出 onRequest，内部按 method+path 分发
- D1 绑定名 DB，R2 绑定名 FILES（wrangler.toml 配置，pages_build_output_dir = dist）
- 密码：PBKDF2-SHA256，100000 次迭代，16 字节随机 salt，hex 存储 salt:hash
- token：32 字节随机 hex，存 D1 sessions 表（token, user_id, created_at）
- 认证：读 Authorization 头查 sessions 表得 user；banned 用户拒绝写操作（403）
- 日期格式与前端一致：YYYY.MM.DD（帖子/仓库）或本地日期时间串（评论/私信）

## D1 表结构（schema.sql）

users(id TEXT PK, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL, avatar TEXT, bio TEXT, role TEXT DEFAULT user, banned INTEGER DEFAULT 0, join_date TEXT)
sessions(token TEXT PK, user_id TEXT NOT NULL, created_at INTEGER)
categories(id TEXT PK, name TEXT UNIQUE NOT NULL)
posts(id TEXT PK, title TEXT NOT NULL, summary TEXT, category TEXT, author_id TEXT, author TEXT, date TEXT, views INTEGER DEFAULT 0, pinned INTEGER DEFAULT 0)
comments(id TEXT PK, post_id TEXT NOT NULL, author_id TEXT, author TEXT, content TEXT, date TEXT)
warehouse(id TEXT PK, name TEXT NOT NULL, category TEXT, quantity INTEGER, unit TEXT, location TEXT, updated_at TEXT, owner_id TEXT, owner_name TEXT, status TEXT)
messages(id TEXT PK, sender_id TEXT, sender_name TEXT, receiver_id TEXT, receiver_name TEXT, content TEXT, date TEXT, read INTEGER DEFAULT 0)
collections(id TEXT PK, user_id TEXT, post_id TEXT, date TEXT, UNIQUE(user_id, post_id))
files(id TEXT PK, name TEXT, size INTEGER, type TEXT, uploader_id TEXT, created_at INTEGER)

## 种子数据（seed）

- 管理员：username yn，password bg2026，name 杨工，avatar 杨，bio 频道主，role admin，joinDate 2025.03.12
- 板块：技术问答 / 项目展示 / 行业动态 / 招聘求职
- 其余表留空（全新投产）
