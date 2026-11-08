import { useState, useCallback, useEffect, useRef } from 'react'
import Layout from './components/Layout'
import Entry from './pages/Entry'
import Home from './pages/Home'
import PostList from './pages/PostList'
import PostDetail from './pages/PostDetail'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import Messages from './pages/Messages'
import Warehouse from './pages/Warehouse'
import ThemeModal from './components/ThemeModal'
import MusicPlayer from './components/MusicPlayer'
import * as api from './api'
import type { User, Post, Category, Message, WarehouseItem, Comment, Collection, PageRoute, ThemeColors } from './types'
import defaultBgImage from './assets/theme-bg.jpg'
import defaultOverlayImage from './assets/theme-overlay.png'

const DEFAULT_THEME: ThemeColors = {
  bg: '#000000',
  bgPanel: '#0a0a0b',
  fg: '#ece9e0',
  brass: '#c9a961',
  green: '#1f4d38',
  red: '#e53935',
  bgImage: defaultBgImage,
  overlayImage: defaultOverlayImage,
}

function App() {
  const [entered, setEntered] = useState(false)
  const [page, setPage] = useState<PageRoute>('home')
  const [user, setUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [warehouse, setWarehouse] = useState<WarehouseItem[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedPostId, setSelectedPostId] = useState<string>('')
  const [messageTargetId, setMessageTargetId] = useState<string>('')
  const [theme, setTheme] = useState<ThemeColors>(DEFAULT_THEME)
  const [themeOpen, setThemeOpen] = useState(false)
  const [msgToast, setMsgToast] = useState('')
  const messagesRef = useRef<Message[]>([])
  const toastTimerRef = useRef<number | null>(null)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const incomingText = (m: Message) => {
    if (m.recalled) return '撤回了一条消息'
    if (m.file) {
      const kind = m.file.type.startsWith('image/')
        ? '[图片]'
        : m.file.type.startsWith('video/') ? '[视频]' : '[文件]'
      return m.content ? `${kind} ${m.content}` : kind
    }
    return m.content
  }

  const notifyIncoming = useCallback((incoming: Message[]) => {
    const last = incoming[incoming.length - 1]
    const text = incoming.length > 1
      ? `收到 ${incoming.length} 条新私信`
      : `${last.senderName}：${incomingText(last)}`
    setMsgToast(text)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setMsgToast(''), 5000)
    // 浏览器系统弹窗：电脑与手机浏览器都走同一套 Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification(`新私信 · ${last.senderName}`, {
          body: incomingText(last),
          tag: 'baigong-dm',
        })
        n.onclick = () => {
          window.focus()
          setPage('messages')
          n.close()
        }
      } catch {
        // 部分浏览器禁止页面直接构造通知，保留页面内提醒
      }
    }
  }, [])

  // 登录后轮询新私信并提醒（移动端/桌面端通用）
  useEffect(() => {
    if (!user) return
    let cancelled = false
    let busy = false
    const poll = async () => {
      if (busy) return
      busy = true
      try {
        const { messages: list } = await api.fetchMessages()
        if (cancelled) return
        const known = new Set(messagesRef.current.map(m => m.id))
        const incoming = list.filter(m =>
          !known.has(m.id) && m.receiverId === user.id && !m.recalled
        )
        setMessages(list)
        if (incoming.length > 0) notifyIncoming(incoming)
      } catch {
        // 轮询失败静默，等待下一次
      } finally {
        busy = false
      }
    }
    poll()
    const timer = window.setInterval(poll, 15000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [user, notifyIncoming])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    api.bootstrap().then(data => {
      setUsers(data.users)
      setCategories(data.categories)
      setPosts(data.posts)
      setComments(data.comments)
      setWarehouse(data.warehouse)
      setMessages(data.messages)
      setCollections(data.collections)
      if (data.me) setUser(data.me)
    }).catch(err => {
      console.error('加载启动数据失败', err)
    })
  }, [])

  const handleRegisterUser = useCallback((newUser: User) => {
    setUsers(prev => (
      prev.find(u => u.username === newUser.username || u.id === newUser.id)
        ? prev
        : [...prev, newUser]
    ))
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--bg', theme.bg)
    root.style.setProperty('--bg-panel', theme.bgPanel)
    root.style.setProperty('--fg', theme.fg)
    root.style.setProperty('--brass', theme.brass)
    root.style.setProperty('--green', theme.green)
    root.style.setProperty('--red', theme.red)
    root.style.setProperty('--theme-bg-image', theme.bgImage ? `url(${theme.bgImage})` : 'none')
    root.style.setProperty('--theme-bg-video', theme.bgVideo ? `url(${theme.bgVideo})` : 'none')
    root.style.setProperty('--theme-overlay-image', theme.overlayImage ? `url(${theme.overlayImage})` : 'none')
  }, [theme])

  const navigate = useCallback((p: PageRoute) => {
    setPage(p)
  }, [])

  const navigateToProfile = useCallback((userId: string) => {
    setSelectedUserId(userId)
    setPage('profile')
  }, [])

  const navigateToPost = useCallback((postId: string) => {
    setSelectedPostId(postId)
    setPage('post')
  }, [])

  const goToPosts = useCallback((category?: string) => {
    if (category) setSelectedCategory(category)
    setPage('posts')
  }, [])

  const handlePost = useCallback((p: Post) => {
    api.createPost({
      title: p.title,
      summary: p.summary,
      category: p.category,
      attachments: p.attachments,
    }).then(({ post }) => {
      setPosts(prev => [post, ...prev])
    }).catch(err => console.error('发帖失败', err))
  }, [])

  const handleDeletePost = useCallback((postId: string) => {
    api.deletePost(postId).then(() => {
      setPosts(prev => prev.filter(p => p.id !== postId))
      setComments(prev => prev.filter(c => c.postId !== postId))
      setCollections(prev => prev.filter(c => c.postId !== postId))
    }).catch(err => console.error('删除帖子失败', err))
  }, [])

  const handleDeleteAttachment = useCallback((postId: string, fileId: string) => {
    api.deleteFile(fileId).then(() => {
      setPosts(prev => prev.map(p => (
        p.id === postId
          ? { ...p, attachments: (p.attachments || []).filter(a => a.id !== fileId) }
          : p
      )))
    }).catch(err => console.error('删除附件失败', err))
  }, [])

  const handleTogglePin = useCallback((postId: string) => {
    api.togglePin(postId).then(({ post }) => {
      setPosts(prev => prev.map(p => (p.id === postId ? post : p)))
    }).catch(err => console.error('置顶操作失败', err))
  }, [])

  const handleBanUser = useCallback((userId: string, banned: boolean) => {
    api.banUser(userId, banned).then(() => {
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, banned } : u)))
    }).catch(err => console.error('封禁操作失败', err))
  }, [])

  const handleAddCategory = useCallback(async (name: string, description?: string) => {
    const { category } = await api.addCategory(name, description)
    setCategories(prev => [...prev, category])
  }, [])

  const handleUpdateCategory = useCallback(async (
    categoryId: string,
    data: { name?: string; description?: string },
  ) => {
    const oldName = categories.find(c => c.id === categoryId)?.name
    const { category } = await api.updateCategory(categoryId, data)
    setCategories(prev => prev.map(c => (c.id === categoryId ? category : c)))
    if (oldName && category.name !== oldName) {
      setPosts(prev => prev.map(p => (p.category === oldName ? { ...p, category: category.name } : p)))
      setSelectedCategory(prev => (prev === oldName ? category.name : prev))
    }
  }, [categories])

  const handleSetCategoryModerator = useCallback(async (categoryId: string, userId: string | null) => {
    const { category } = await api.setCategoryModerator(categoryId, userId)
    setCategories(prev => prev.map(c => (c.id === categoryId ? category : c)))
  }, [])

  const handleMoveCategory = useCallback(async (categoryId: string, direction: 'up' | 'down') => {
    const { categories: list } = await api.moveCategory(categoryId, direction)
    setCategories(list)
  }, [])

  const handleDeleteCategory = useCallback(async (categoryId: string) => {
    await api.deleteCategory(categoryId)
    setCategories(prev => prev.filter(c => c.id !== categoryId))
  }, [])

  const handleSendMessage = useCallback((receiverId: string, content: string, fileId?: string) => {
    const trimmed = content.trim()
    if (!trimmed && !fileId) return
    api.sendMessage(receiverId, trimmed, fileId).then(({ message }) => {
      setMessages(prev => [...prev, message])
    }).catch(err => console.error('发送私信失败', err))
  }, [])

  const handleRecallMessage = useCallback(async (messageId: string) => {
    await api.recallMessage(messageId)
    setMessages(prev => prev.map(m => (
      m.id === messageId ? { ...m, recalled: true, content: '', file: undefined } : m
    )))
  }, [])

  const handleMarkRead = useCallback((messageId: string) => {
    api.markMessageRead(messageId).then(() => {
      setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, read: true } : m)))
    }).catch(err => console.error('标记已读失败', err))
  }, [])

  const handleAddWarehouse = useCallback((item: WarehouseItem) => {
    api.addWarehouseItem({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      location: item.location,
    }).then(({ item: created }) => {
      setWarehouse(prev => [created, ...prev])
    }).catch(err => console.error('新增物料失败', err))
  }, [])

  const handleDeleteWarehouse = useCallback((itemId: string) => {
    api.deleteWarehouseItem(itemId).then(() => {
      setWarehouse(prev => prev.filter(w => w.id !== itemId))
    }).catch(err => console.error('删除物料失败', err))
  }, [])

  const handleAddComment = useCallback((postId: string, content: string, parentId?: string) => {
    const trimmed = content.trim()
    if (!trimmed) return
    api.addComment(postId, trimmed, parentId).then(({ comment }) => {
      setComments(prev => [...prev, comment])
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: (p.comments || 0) + 1 } : p))
    }).catch(err => console.error('发表评论失败', err))
  }, [])

  const handleDeleteComment = useCallback(async (commentId: string) => {
    const { postId, deletedIds } = await api.deleteComment(commentId)
    const removed = new Set(deletedIds)
    setComments(prev => prev.filter(c => !removed.has(c.id)))
    setPosts(prev => prev.map(p => (
      p.id === postId
        ? { ...p, comments: Math.max(0, (p.comments || 0) - removed.size) }
        : p
    )))
  }, [])

  const handleUpdateProfile = useCallback(async (data: { name?: string; bio?: string; avatar?: string }) => {
    const { user: updated } = await api.updateProfile(data)
    setUser(updated)
    setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)))
    setPosts(prev => prev.map(p => (p.authorId === updated.id ? { ...p, author: updated.name } : p)))
    setComments(prev => prev.map(c => (c.authorId === updated.id ? { ...c, author: updated.name } : c)))
  }, [])

  const handleToggleCollection = useCallback((postId: string) => {
    if (!user) return
    api.toggleCollect(postId).then(({ collected }) => {
      setCollections(prev => {
        const idx = prev.findIndex(c => c.userId === user.id && c.postId === postId)
        if (!collected) {
          if (idx < 0) return prev
          const next = [...prev]
          next.splice(idx, 1)
          return next
        }
        if (idx >= 0) return prev
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
        return [...prev, { id: `col${Date.now()}`, userId: user.id, postId, date }]
      })
    }).catch(err => console.error('收藏操作失败', err))
  }, [user])

  const openMessages = useCallback((targetUserId?: string) => {
    if (targetUserId) setMessageTargetId(targetUserId)
    setPage('messages')
  }, [])

  const selectedPost = posts.find(p => p.id === selectedPostId)
  const isModerator = !!user && categories.some(c => c.moderatorId === user.id)

  if (!entered) {
    return <Entry onEnter={() => { setEntered(true); setPage('home') }} />
  }

  return (
    <>
      <Layout
        page={page}
        user={user}
        setUser={setUser}
        users={users}
        categories={categories}
        onPost={handlePost}
        onNavigate={navigate}
        onProfile={() => navigateToProfile(user?.id || 'u1')}
        onMessages={() => openMessages()}
        onOpenTheme={() => setThemeOpen(true)}
        isAdmin={user?.role === 'admin'}
        isModerator={isModerator}
        theme={theme}
        onRegisterUser={handleRegisterUser}
      >
        {page === 'home' && (
          <Home
            posts={posts}
            categories={categories}
            users={users}
            onNavigate={navigate}
            onSelectCategory={setSelectedCategory}
            onViewProfile={navigateToProfile}
            onViewPost={navigateToPost}
          />
        )}
        {page === 'posts' && (
          <PostList
            posts={posts}
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onViewProfile={navigateToProfile}
            onViewPost={navigateToPost}
          />
        )}
        {page === 'post' && selectedPost && (
          <PostDetail
            post={selectedPost}
            posts={posts}
            categories={categories}
            comments={comments.filter(c => c.postId === selectedPost.id)}
            currentUser={user}
            isCollected={collections.some(c => c.userId === user?.id && c.postId === selectedPost.id)}
            onBack={() => setPage('posts')}
            onViewProfile={navigateToProfile}
            onGoToPosts={goToPosts}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            onToggleCollect={handleToggleCollection}
          />
        )}
        {page === 'profile' && (
          <Profile
            users={users}
            posts={posts}
            currentUser={user}
            selectedUserId={selectedUserId}
            collections={collections}
            onNavigate={navigate}
            onSendMessage={openMessages}
            onViewPost={navigateToPost}
            onToggleCollection={handleToggleCollection}
            onUpdateProfile={handleUpdateProfile}
            isAdmin={user?.role === 'admin'}
          />
        )}
        {page === 'admin' && (
          <Admin
            user={user}
            users={users}
            posts={posts}
            categories={categories}
            theme={theme}
            onDeletePost={handleDeletePost}
            onTogglePin={handleTogglePin}
            onBanUser={handleBanUser}
            onAddCategory={handleAddCategory}
            onUpdateCategory={handleUpdateCategory}
            onSetCategoryModerator={handleSetCategoryModerator}
            onMoveCategory={handleMoveCategory}
            onDeleteCategory={handleDeleteCategory}
            onThemeChange={setTheme}
            onThemeReset={() => setTheme(DEFAULT_THEME)}
          />
        )}
        {page === 'messages' && (
          <Messages
            currentUser={user}
            users={users}
            messages={messages}
            initialTargetId={messageTargetId}
            onSend={handleSendMessage}
            onMarkRead={handleMarkRead}
            onRecall={handleRecallMessage}
          />
        )}
        {page === 'warehouse' && (
          <Warehouse
            currentUser={user}
            items={warehouse}
            users={users}
            posts={posts}
            onAdd={handleAddWarehouse}
            onDelete={handleDeleteWarehouse}
            onViewPost={navigateToPost}
            onDeleteAttachment={handleDeleteAttachment}
          />
        )}
      </Layout>
      {msgToast && (
        <button
          className="msg-toast"
          onClick={() => { setMsgToast(''); setPage('messages') }}
          title="查看私信"
        >
          <span className="msg-toast-dot" />
          <span className="msg-toast-text">{msgToast}</span>
        </button>
      )}
      {themeOpen && (
        <ThemeModal
          theme={theme}
          onChange={setTheme}
          onReset={() => setTheme(DEFAULT_THEME)}
          onClose={() => setThemeOpen(false)}
        />
      )}
      <MusicPlayer isAdmin={user?.role === 'admin'} />
    </>
  )
}

export default App
