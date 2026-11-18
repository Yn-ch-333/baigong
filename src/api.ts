import type {
  User, Post, Category, Comment, Message, WarehouseItem, Collection, Attachment, RadioTrack,
} from './types'
import { fileRelativeFolder } from './fileStore'

const TOKEN_KEY = 'baigong-token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`/api${path}`, { ...options, headers })
  if (!res.ok) {
    let message = `请求失败（${res.status}）`
    try {
      const data = await res.json() as { error?: string }
      if (data && data.error) message = data.error
    } catch { /* 响应非 JSON 时使用默认文案 */ }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

export interface BootstrapData {
  me: User | null
  users: User[]
  categories: Category[]
  posts: Post[]
  comments: Comment[]
  warehouse: WarehouseItem[]
  messages: Message[]
  collections: Collection[]
  /** 短信通道是否已配置，未配置时前端隐藏验证码与找回密码入口 */
  smsEnabled: boolean
}

export function login(username: string, password: string) {
  return request<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function register(username: string, password: string, name: string, country: string, phone: string, code: string) {
  return request<{ token: string; user: User }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, name, country, phone, code }),
  })
}

export type SmsPurpose = 'register' | 'reset' | 'bind' | 'rebind'

/** 发送短信验证码（注册 / 找回密码公开；绑定与换绑需登录） */
export function sendSmsCode(phone: string, purpose: SmsPurpose) {
  return request<{ ok: true; phone: string; expiresIn: number }>('/auth/sms/send', {
    method: 'POST',
    body: JSON.stringify({ phone, purpose }),
  })
}

/** 忘记密码：短信通道可用时用验证码，否则用用户名 + 手机号校验 */
export function resetPassword(phone: string, code: string, password: string, username?: string) {
  return request<{ token: string; user: User }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ phone, code, password, username }),
  })
}

/** 绑定 / 更换手机号（需短信验证码） */
export function bindPhone(phone: string, code: string) {
  return request<{ user: User }>('/auth/phone', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  })
}

/** 管理员 / 频道主查看全部用户完整信息（含手机号） */
export function fetchAdminUsers() {
  return request<{ users: User[] }>('/admin/users')
}

export function logout() {
  return request<{ ok: true }>('/auth/logout', { method: 'POST' })
}

export function bootstrap() {
  return request<BootstrapData>('/bootstrap')
}

export function createPost(data: { title: string; summary: string; category: string; attachments?: Attachment[] }) {
  return request<{ post: Post }>('/posts', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function deletePost(id: string) {
  return request<{ ok: true }>(`/posts/${id}`, { method: 'DELETE' })
}

export function togglePin(id: string) {
  return request<{ post: Post }>(`/posts/${id}/pin`, { method: 'POST' })
}

export function viewPost(id: string) {
  return request<{ views: number }>(`/posts/${id}/view`, { method: 'POST' })
}

export function addComment(postId: string, content: string, parentId?: string) {
  return request<{ comment: Comment }>(`/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify(parentId ? { content, parentId } : { content }),
  })
}

export function deleteComment(commentId: string) {
  return request<{ ok: true; postId: string; deletedIds: string[] }>(`/comments/${commentId}`, {
    method: 'DELETE',
  })
}

export function updateProfile(data: { name?: string; bio?: string; avatar?: string; country?: string }) {
  return request<{ user: User }>('/users/me', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function toggleCollect(postId: string) {
  return request<{ collected: boolean }>(`/posts/${postId}/collect`, { method: 'POST' })
}

export function addCategory(name: string, description?: string) {
  return request<{ category: Category }>('/categories', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  })
}

export function updateCategory(id: string, data: { name?: string; description?: string }) {
  return request<{ category: Category }>(`/categories/${id}`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function setCategoryModerator(id: string, userId: string | null) {
  return request<{ category: Category }>(`/categories/${id}/moderator`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
}

export function moveCategory(id: string, direction: 'up' | 'down') {
  return request<{ categories: Category[] }>(`/categories/${id}/move`, {
    method: 'POST',
    body: JSON.stringify({ direction }),
  })
}

export function deleteCategory(id: string) {
  return request<{ ok: true }>(`/categories/${id}`, { method: 'DELETE' })
}

export function banUser(id: string, banned: boolean) {
  return request<{ ok: true }>(`/users/${id}/ban`, {
    method: 'POST',
    body: JSON.stringify({ banned }),
  })
}

export function addWarehouseItem(data: { name: string; category: string; quantity: number; unit: string; location: string }) {
  return request<{ item: WarehouseItem }>('/warehouse', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function deleteWarehouseItem(id: string) {
  return request<{ ok: true }>(`/warehouse/${id}`, { method: 'DELETE' })
}

export function sendMessage(receiverId: string, content: string, fileIds?: string[]) {
  return request<{ message: Message }>('/messages', {
    method: 'POST',
    body: JSON.stringify(
      fileIds && fileIds.length > 0 ? { receiverId, content, fileIds } : { receiverId, content },
    ),
  })
}

export function fetchMessages() {
  return request<{ messages: Message[] }>('/messages')
}

export function recallMessage(id: string) {
  return request<{ ok: true }>(`/messages/${id}`, { method: 'DELETE' })
}

export function markMessageRead(id: string) {
  return request<{ ok: true }>(`/messages/${id}/read`, { method: 'POST' })
}

/** 单次请求上限：KV 单个值最大 25MB，这里留出余量 */
const UPLOAD_CHUNK_SIZE = 20 * 1024 * 1024

/** 用 XHR 上传（fetch 无法上报进度），返回服务端 JSON */
function xhrUpload(url: string, fd: FormData, onLoaded?: (loaded: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.timeout = 120000
    const token = getToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    if (onLoaded) {
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) onLoaded(e.loaded)
      }
    }
    xhr.onload = () => {
      let data: any = null
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        data = null
      }
      if (xhr.status >= 200 && xhr.status < 300 && data) {
        resolve(data)
      } else {
        reject(new Error(data?.error || `上传失败（${xhr.status}）`))
      }
    }
    xhr.onerror = () => reject(new Error('网络连接中断，上传失败'))
    xhr.ontimeout = () => reject(new Error('上传超时（120 秒），请检查网络后重试'))
    xhr.onabort = () => reject(new Error('上传已取消'))
    xhr.send(fd)
  })
}

/** 上传附件；大文件自动切成 20MB 分片，onProgress 返回 0-100 的整体进度 */
export async function uploadFile(file: File, onProgress?: (percent: number) => void): Promise<Attachment> {
  const folder = fileRelativeFolder(file)
  const type = file.type || 'application/octet-stream'

  if (file.size <= UPLOAD_CHUNK_SIZE) {
    const fd = new FormData()
    fd.append('file', file, file.name)
    if (folder) fd.append('folder', folder)
    return xhrUpload('/api/files', fd, loaded => {
      if (file.size > 0) onProgress?.(Math.round((loaded / file.size) * 100))
    })
  }

  // 大文件分片上传：每片单独请求，最后合并登记
  const uploadId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  const total = Math.ceil(file.size / UPLOAD_CHUNK_SIZE)
  for (let i = 0; i < total; i++) {
    const start = i * UPLOAD_CHUNK_SIZE
    const end = Math.min(start + UPLOAD_CHUNK_SIZE, file.size)
    const fd = new FormData()
    fd.append('chunk', file.slice(start, end), file.name)
    fd.append('uploadId', uploadId)
    fd.append('index', String(i))
    await xhrUpload('/api/files/chunk', fd, loaded => {
      onProgress?.(Math.round(((start + loaded) / file.size) * 100))
    })
    onProgress?.(Math.round((end / file.size) * 100))
  }
  return request<Attachment>('/files/finish', {
    method: 'POST',
    body: JSON.stringify({
      uploadId,
      name: file.name,
      size: file.size,
      type,
      folder: folder || undefined,
      chunks: total,
    }),
  })
}

export function deleteFile(id: string) {
  return request<{ ok: true }>(`/files/${id}`, { method: 'DELETE' })
}

export function fetchTracks() {
  return request<{ tracks: RadioTrack[] }>('/tracks')
}

export function uploadTrack(file: File, title?: string) {
  const fd = new FormData()
  fd.append('file', file, file.name)
  if (title) fd.append('title', title)
  return request<{ track: RadioTrack }>('/tracks', { method: 'POST', body: fd })
}

export function deleteTrack(id: string) {
  return request<{ ok: true }>(`/tracks/${id}`, { method: 'DELETE' })
}
