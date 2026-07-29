import { useEffect, useRef, useState, useCallback } from 'react'
import type { User, Category, Post, PageRoute, ThemeColors } from '../types'
import {
  IconHome, IconWarehouse, IconSettings, IconShield,
  IconMail, IconUser, IconPlus, IconClose,
} from '../icons'
import './Layout.css'

interface LayoutProps {
  page: PageRoute
  user: User | null
  setUser: (u: User | null) => void
  categories: Category[]
  onPost: (p: Post) => void
  children: React.ReactNode
  onNavigate: (page: PageRoute) => void
  onProfile: () => void
  onMessages: () => void
  onOpenTheme: () => void
  isAdmin?: boolean
  theme?: ThemeColors
}

export default function Layout({
  page,
  user,
  setUser,
  categories,
  onPost,
  children,
  onNavigate,
  onProfile,
  onMessages,
  onOpenTheme,
  isAdmin,
  theme,
}: LayoutProps) {
  const [loginOpen, setLoginOpen] = useState(false)
  const [postOpen, setPostOpen] = useState(false)

  const idleTimerRef = useRef<number | null>(null)
  const pausedRef = useRef(false)

  // Memory & idle management
  useEffect(() => {
    const resetIdle = () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
      if (pausedRef.current) pausedRef.current = false
      idleTimerRef.current = window.setTimeout(() => {
        pausedRef.current = true
      }, 3 * 60 * 1000)
    }

    resetIdle()
    window.addEventListener('mousemove', resetIdle, { passive: true })
    window.addEventListener('keydown', resetIdle, { passive: true })
    window.addEventListener('scroll', resetIdle, { passive: true })
    window.addEventListener('touchstart', resetIdle, { passive: true })

    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current)
      window.removeEventListener('mousemove', resetIdle)
      window.removeEventListener('keydown', resetIdle)
      window.removeEventListener('scroll', resetIdle)
      window.removeEventListener('touchstart', resetIdle)
    }
  }, [])

  const handleLogin = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    const name = String(fd.get('username') || '工程师')
    setUser({ id: 'u1', name, avatar: name[0], role: 'admin' })
    setLoginOpen(false)
  }, [setUser])

  const handlePost = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    const title = String(fd.get('title') || '')
    const summary = String(fd.get('summary') || '')
    const category = String(fd.get('category') || '技术问答')
    if (!title.trim()) return
    onPost({
      id: `p${Date.now()}`,
      title,
      summary,
      category,
      author: user?.name || '匿名',
      authorId: user?.id,
      date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
      views: 0,
      comments: 0,
    })
    setPostOpen(false)
  }, [onPost, user])

  return (
    <div className="app-shell">
      {theme?.bgVideo ? (
        <video
          className="app-bg-layer"
          src={theme.bgVideo}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : theme?.bgImage ? (
        <div
          className="app-bg-layer"
          style={{ backgroundImage: `url(${theme.bgImage})` }}
        />
      ) : null}
      <header className="app-header">
        <div className="brand-mark">
          <span className="brand-cn">百工</span>
          <span className="brand-de">Technikerkreis</span>
        </div>
        <div className="header-actions">
          <button className="icon-btn" aria-label="私信入口" onClick={onMessages}>
            <IconMail />
          </button>
          <button
            className="icon-btn"
            aria-label="个人信息入口"
            onClick={() => user ? onProfile() : setLoginOpen(true)}
          >
            <IconUser />
          </button>
          {user && (
            <span className="header-user" style={{ cursor: 'pointer' }} onClick={onProfile}>{user.name}</span>
          )}
        </div>
      </header>

      <div className="app-body">
        <nav className="app-sidebar" aria-label="主导航">
          <button
            className={`nav-btn ${page === 'home' ? 'active' : ''}`}
            aria-label="主页"
            aria-current={page === 'home' ? 'page' : undefined}
            onClick={() => onNavigate('home')}
          >
            <IconHome />
          </button>
          <button
            className={`nav-btn ${page === 'warehouse' ? 'active' : ''}`}
            aria-label="仓库"
            aria-current={page === 'warehouse' ? 'page' : undefined}
            onClick={() => onNavigate('warehouse')}
          >
            <IconWarehouse />
          </button>
          {isAdmin && (
            <button
              className={`nav-btn ${page === 'admin' ? 'active' : ''}`}
              aria-label="管理后台"
              aria-current={page === 'admin' ? 'page' : undefined}
              onClick={() => onNavigate('admin')}
            >
              <IconShield />
            </button>
          )}
          <div className="nav-divider" />
          <button
            className="nav-btn"
            aria-label="主题设置"
            title={isAdmin ? '主题配色' : '仅管理员可更改主题'}
            onClick={() => isAdmin && onOpenTheme()}
            disabled={!isAdmin}
            style={{ opacity: isAdmin ? 1 : 0.4, cursor: isAdmin ? 'pointer' : 'not-allowed' }}
          >
            <IconSettings />
          </button>
        </nav>

        <main className="app-main">
          {children}
        </main>
      </div>

      <button className="fab" aria-label="发帖" onClick={() => setPostOpen(true)}>
        <IconPlus />
      </button>

      {loginOpen && (
        <div className="modal-overlay" onClick={() => setLoginOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>登录 / 注册</h3>
              <button className="modal-close" onClick={() => setLoginOpen(false)} aria-label="关闭"><IconClose /></button>
            </div>
            <form onSubmit={handleLogin}>
              <label className="field-label">
                用户名
                <input name="username" className="field-input" placeholder="输入用户名" required />
              </label>
              <label className="field-label">
                密码
                <input name="password" type="password" className="field-input" placeholder="输入密码" required />
              </label>
              <button type="submit" className="btn-primary">登录</button>
            </form>
          </div>
        </div>
      )}

      {postOpen && (
        <div className="modal-overlay" onClick={() => setPostOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>发布帖子</h3>
              <button className="modal-close" onClick={() => setPostOpen(false)} aria-label="关闭"><IconClose /></button>
            </div>
            <form onSubmit={handlePost}>
              <label className="field-label">
                标题
                <input name="title" className="field-input" placeholder="请输入标题" required />
              </label>
              <label className="field-label">
                板块
                <select name="category" className="field-input">
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </label>
              <label className="field-label">
                内容摘要
                <textarea name="summary" className="field-input field-area" rows={4} placeholder="请输入内容摘要" required />
              </label>
              <button type="submit" className="btn-primary">发布</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
