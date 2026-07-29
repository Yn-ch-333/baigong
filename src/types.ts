export interface User {
  id: string
  name: string
  avatar: string
  bio?: string
  role?: 'user' | 'admin'
  banned?: boolean
  joinDate?: string
  username?: string
  password?: string
}

export interface Post {
  id: string
  title: string
  summary: string
  content?: string
  category: string
  author: string
  authorId?: string
  date: string
  views: number
  comments?: number
  pinned?: boolean
}

export interface Category {
  id: string
  name: string
  count: number
}

export interface Comment {
  id: string
  postId: string
  author: string
  authorId?: string
  content: string
  date: string
}

export interface Message {
  id: string
  senderId: string
  senderName: string
  receiverId: string
  receiverName: string
  content: string
  date: string
  read?: boolean
}

export interface WarehouseItem {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  location: string
  updatedAt: string
  ownerId?: string
  ownerName?: string
  status: 'normal' | 'low' | 'out'
}

export interface Collection {
  id: string
  userId: string
  postId: string
  date: string
}

export interface ThemeColors {
  bg: string
  bgPanel: string
  fg: string
  brass: string
  green: string
  red: string
  bgImage?: string
  bgVideo?: string
  overlayImage?: string
}

export type PageRoute = 'home' | 'posts' | 'post' | 'profile' | 'admin' | 'messages' | 'warehouse'
