import { useEffect, useRef, useState, useCallback } from 'react'
import type { User, Category, Post, PageRoute, ThemeColors, Attachment } from '../types'
import { saveFile, formatFileSize } from '../fileStore'
import {
  IconHome, IconWarehouse, IconSettings, IconShield,
  IconMail, IconUser, IconPlus, IconClose, IconPaperclip,
} from '../icons'
import './Layout.css'

const MAX_FILE_SIZE = 10 * 1024 * 1024

interface LayoutProps {
  page: PageRoute
  user: User | null
  setUser: (u: User | null) => void
  users: User[]
  categories: Category[]
  onPost: (p: Post) => void
  children: React.ReactNode
  onNavigate: (page: PageRoute) => void
  onProfile: () => void
  onMessages: () => void
  onOpenTheme: () => void
  isAdmin?: boolean
  theme?: ThemeColors
  onRegisterUser: (u: User) => void
}

export default function Layout({
  page,
  user,
  setUser,
  users,
  categories,
  onPost,
  children,
  onNavigate,
  onProfile,
  onMessages,
  onOpenTheme,
  isAdmin,
  theme,
  onRegisterUser,
}: LayoutProps) {
  const [loginOpen, setLoginOpen] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [postOpen, setPostOpen] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    const username = String(fd.get('username') || '').trim()
    const password = String(fd.get('password') || '').trim()
    const matched = users.find(
      u => u.username === username && u.password === password
    )
    if (matched) {
      setUser(matched)
      setLoginError('')
      setLoginOpen(false)
    } else {
      setLoginError('账号或密码错误')
    }
  }, [setUser, users])

  const handleRegister = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    const username = String(fd.get('username') || '').trim()
    const password = String(fd.get('password') || '').trim()
    const confirm = String(fd.get('confirmPassword') || '').trim()
    const name = String(fd.get('name') || '').trim()
    const bio = String(fd.get('bio') || '').trim()

    if (!username || !password || !name) {
      setLoginError('请填写用户名、密码和昵称')
      return
    }
    if (password !== confirm) {
      setLoginError('两次输入的密码不一致')
      return
    }
    if (users.some(u => u.username === username)) {
      setLoginError('该用户名已被注册')
      return
    }

    const newUser: User = {
      id: `ur${Date.now()}`,
      name,
      avatar: name[0] || '工',
      bio: bio || '新晋工程师',
      role: 'user',
      joinDate: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
      username,
      password,
    }
    onRegisterUser(newUser)
    setUser(newUser)
    setLoginError('')
    setLoginOpen(false)
  }, [onRegisterUser, setUser, users])

  const handlePickFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || [])
    if (picked.length === 0) return
    const oversize = picked.find(f => f.size > MAX_FILE_SIZE)
    if (oversize) {
      setFileError(`「${oversize.name}」超过 10MB，无法上传`)
      e.target.value = ''
      return
    }
    setFileError('')
    setPendingFiles(prev => [...prev, ...picked])
    e.target.value = ''
  }, [])

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handlePost = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const form = e.currentTarget as HTMLFormElement
    const fd = new FormData(form)
    const title = String(fd.get('title') || '')
    const summary = String(fd.get('summary') || '')
    const category = String(fd.get('category') || '技术问答')
    if (!title.trim()) return
    const attachments: Attachment[] = []
    for (let i = 0; i < pendingFiles.length; i++) {
      const f = pendingFiles[i]
      const id = `f${Date.now()}_${i}`
      try {
        await saveFile(id, f)
      } catch {
        setFileError(`「${f.name}」保存失败，请重试`)
        return
      }
      attachments.push({ id, name: f.name, size: f.size, type: f.type || 'application/octet-stream' })
    }
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
      attachments: attachments.length > 0 ? attachments : undefined,
    })
    setPendingFiles([])
    setFileError('')
    setPostOpen(false)
  }, [onPost, user, pendingFiles])

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
              <h3>{isRegistering ? '注册账号' : '登录'}</h3>
              <button className="modal-close" onClick={() => setLoginOpen(false)} aria-label="关闭"><IconClose /></button>
            </div>
            <form onSubmit={isRegistering ? handleRegister : handleLogin}>
              <label className="field-label">
                用户名
                <input name="username" className="field-input" placeholder="输入用户名" required />
              </label>
              <label className="field-label">
                密码
                <input name="password" type="password" className="field-input" placeholder="输入密码" required />
              </label>
              {isRegistering && (
                <>
                  <label className="field-label">
                    确认密码
                    <input name="confirmPassword" type="password" className="field-input" placeholder="再次输入密码" required />
                  </label>
                  <label className="field-label">
                    昵称
                    <input name="name" className="field-input" placeholder="显示昵称" required />
                  </label>
                  <label className="field-label">
                    个人简介
                    <input name="bio" className="field-input" placeholder="一句话介绍" />
                  </label>
                </>
              )}
              {loginError && <p className="login-error">{loginError}</p>}
              <button type="submit" className="btn-primary">
                {isRegistering ? '注册' : '登录'}
              </button>
            </form>
            <div className="login-toggle">
              <button
                type="button"
                className="login-toggle-btn"
                onClick={() => { setIsRegistering(!isRegistering); setLoginError('') }}
              >
                {isRegistering ? '已有账号？去登录' : '没有账号？去注册'}
              </button>
            </div>
          </div>
        </div>
      )}

      {postOpen && (
        <div className="modal-overlay" onClick={() => { setPostOpen(false); setPendingFiles([]); setFileError('') }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>发布帖子</h3>
              <button className="modal-close" onClick={() => { setPostOpen(false); setPendingFiles([]); setFileError('') }} aria-label="关闭"><IconClose /></button>
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
              <div className="field-label">
                附件
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="post-file-input"
                  onChange={handlePickFiles}
                  aria-label="选择附件文件"
                />
                <button type="button" className="post-file-add" onClick={() => fileInputRef.current?.click()}>
                  <IconPaperclip /> 添加附件
                </button>
                <span className="post-file-hint">单个文件不超过 10MB，附件将存入仓库</span>
                {pendingFiles.length > 0 && (
                  <div className="post-file-list">
                    {pendingFiles.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="post-file-item">
                        <span className="post-file-name">{f.name}</span>
                        <span className="post-file-size">{formatFileSize(f.size)}</span>
                        <button
                          type="button"
                          className="post-file-remove"
                          onClick={() => removePendingFile(i)}
                          aria-label={`移除 ${f.name}`}
                        >
                          <IconClose />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {fileError && <p className="login-error">{fileError}</p>}
              </div>
              <button type="submit" className="btn-primary">发布</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
