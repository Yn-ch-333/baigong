import { useState, useCallback, useEffect } from 'react'
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

  const handleAddCategory = useCallback((name: string) => {
    api.addCategory(name).then(({ category }) => {
      setCategories(prev => [...prev, category])
    }).catch(err => console.error('新增板块失败', err))
  }, [])

  const handleDeleteCategory = useCallback((categoryId: string) => {
    api.deleteCategory(categoryId).then(() => {
      setCategories(prev => prev.filter(c => c.id !== categoryId))
    }).catch(err => console.error('删除板块失败', err))
  }, [])

  const handleSendMessage = useCallback((receiverId: string, content: string) => {
    if (!content.trim()) return
    api.sendMessage(receiverId, content.trim()).then(({ message }) => {
      setMessages(prev => [message, ...prev])
    }).catch(err => console.error('发送私信失败', err))
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

  const handleAddComment = useCallback((postId: string, content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return
    api.addComment(postId, trimmed).then(({ comment }) => {
      setComments(prev => [...prev, comment])
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: (p.comments || 0) + 1 } : p))
    }).catch(err => console.error('发表评论失败', err))
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
        theme={theme}
        onRegisterUser={handleRegisterUser}
      >
        {page === 'home' && (
          <Home
            posts={posts}
            categories={categories}
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
