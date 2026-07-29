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
import type { User, Post, Category, Message, WarehouseItem, Comment, Collection, PageRoute, ThemeColors } from './types'
import {
  INITIAL_CATEGORIES,
  INITIAL_POSTS,
  INITIAL_USERS,
  INITIAL_MESSAGES,
  INITIAL_WAREHOUSE,
  INITIAL_COMMENTS,
  INITIAL_COLLECTIONS,
} from './data'
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
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('baigong-registered-users')
      const registered: User[] = saved ? JSON.parse(saved) : []
      const merged = [...INITIAL_USERS]
      registered.forEach(u => {
        if (!merged.find(existing => existing.id === u.id || existing.username === u.username)) {
          merged.push(u)
        }
      })
      return merged
    } catch {
      return INITIAL_USERS
    }
  })
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES)
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS)
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [warehouse, setWarehouse] = useState<WarehouseItem[]>(INITIAL_WAREHOUSE)
  const [comments, setComments] = useState<Comment[]>(INITIAL_COMMENTS)
  const [collections, setCollections] = useState<Collection[]>(INITIAL_COLLECTIONS)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedPostId, setSelectedPostId] = useState<string>('')
  const [messageTargetId, setMessageTargetId] = useState<string>('')
  const [theme, setTheme] = useState<ThemeColors>(DEFAULT_THEME)
  const [themeOpen, setThemeOpen] = useState(false)

  const handleRegisterUser = useCallback((newUser: User) => {
    setUsers(prev => {
      if (prev.find(u => u.username === newUser.username || u.id === newUser.id)) {
        return prev
      }
      const next = [...prev, newUser]
      const registered = next.filter(u => !INITIAL_USERS.find(init => init.id === u.id))
      localStorage.setItem('baigong-registered-users', JSON.stringify(registered))
      return next
    })
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
    setPosts(prev => [{ ...p, comments: 0 }, ...prev])
  }, [])

  const handleDeletePost = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId))
    setComments(prev => prev.filter(c => c.postId !== postId))
    setCollections(prev => prev.filter(c => c.postId !== postId))
  }, [])

  const handleTogglePin = useCallback((postId: string) => {
    setPosts(prev => prev.map(p => (p.id === postId ? { ...p, pinned: !p.pinned } : p)))
  }, [])

  const handleBanUser = useCallback((userId: string, banned: boolean) => {
    setUsers(prev => prev.map(u => (u.id === userId ? { ...u, banned } : u)))
  }, [])

  const handleAddCategory = useCallback((name: string) => {
    setCategories(prev => [...prev, { id: `c${Date.now()}`, name, count: 0 }])
  }, [])

  const handleDeleteCategory = useCallback((categoryId: string) => {
    setCategories(prev => prev.filter(c => c.id !== categoryId))
  }, [])

  const handleSendMessage = useCallback((receiverId: string, content: string) => {
    const receiver = users.find(u => u.id === receiverId)
    const sender = user || { id: 'guest', name: '访客', avatar: '客' }
    if (!receiver || !content.trim()) return
    setMessages(prev => [
      {
        id: `m${Date.now()}`,
        senderId: sender.id,
        senderName: sender.name,
        receiverId: receiver.id,
        receiverName: receiver.name,
        content: content.trim(),
        date: new Date().toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).replace(/\//g, '.'),
        read: true,
      },
      ...prev,
    ])
  }, [users, user])

  const handleMarkRead = useCallback((messageId: string) => {
    setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, read: true } : m)))
  }, [])

  const handleAddWarehouse = useCallback((item: WarehouseItem) => {
    setWarehouse(prev => [item, ...prev])
  }, [])

  const handleDeleteWarehouse = useCallback((itemId: string) => {
    setWarehouse(prev => prev.filter(w => w.id !== itemId))
  }, [])

  const handleAddComment = useCallback((postId: string, content: string) => {
    const author = user || { id: 'guest', name: '匿名', avatar: '匿' }
    const trimmed = content.trim()
    if (!trimmed) return
    const date = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(/\//g, '.')
    setComments(prev => [...prev, {
      id: `cm${Date.now()}`,
      postId,
      author: author.name,
      authorId: author.id,
      content: trimmed,
      date,
    }])
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: (p.comments || 0) + 1 } : p))
  }, [user])

  const handleToggleCollection = useCallback((postId: string) => {
    if (!user) return
    setCollections(prev => {
      const idx = prev.findIndex(c => c.userId === user.id && c.postId === postId)
      if (idx >= 0) {
        const next = [...prev]
        next.splice(idx, 1)
        return next
      }
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
      return [...prev, { id: `col${Date.now()}`, userId: user.id, postId, date }]
    })
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
            onAdd={handleAddWarehouse}
            onDelete={handleDeleteWarehouse}
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
