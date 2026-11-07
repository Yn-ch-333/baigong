import type {
  User, Post, Category, Comment, Message, WarehouseItem, Collection, Attachment,
} from './types'

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
}

export function login(username: string, password: string) {
  return request<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function register(username: string, password: string, name: string, country: string) {
  return request<{ token: string; user: User }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, name, country }),
  })
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

export function addCategory(name: string) {
  return request<{ category: Category }>('/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
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

export function sendMessage(receiverId: string, content: string, fileId?: string) {
  return request<{ message: Message }>('/messages', {
    method: 'POST',
    body: JSON.stringify(fileId ? { receiverId, content, fileId } : { receiverId, content }),
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

export function uploadFile(file: File): Promise<Attachment> {
  const fd = new FormData()
  fd.append('file', file, file.name)
  return request<Attachment>('/files', { method: 'POST', body: fd })
}

export function deleteFile(id: string) {
  return request<{ ok: true }>(`/files/${id}`, { method: 'DELETE' })
}
