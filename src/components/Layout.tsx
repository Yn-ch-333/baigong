import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { User, Category, Post, PageRoute, ThemeColors, Attachment } from '../types'
import { formatFileSize, avatarUrl, fileRelativeFolder, attachmentTopFolder, attachmentPath } from '../fileStore'
import * as api from '../api'
import { COUNTRY_OPTIONS } from './WorldMap'
import SmsCodeField from './SmsCodeField'
import {
  IconHome, IconWarehouse, IconSettings, IconShield,
  IconMail, IconUser, IconPlus, IconClose, IconPaperclip, IconFolder, IconChevronLeft,
} from '../icons'
import './Layout.css'

/** 待上传附件：文件 + 整文件夹上传时的相对目录 */
interface PendingFile {
  file: File
  folder: string
}

/** 后台发布任务：关闭弹窗后继续上传/发布 */
interface BgPublishTask {
  id: string
  title: string
  percent: number
  name?: string
  status: 'uploading' | 'publishing' | 'done' | 'error'
  error?: string
  retry?: () => void
}



interface LayoutProps {
  page: PageRoute
  user: User | null
  setUser: (u: User | null) => void
  users: User[]
  categories: Category[]
  onPost: (p: Post) => Promise<void> | void
  children: React.ReactNode
  onNavigate: (page: PageRoute) => void
  onProfile: () => void
  onMessages: () => void
  onOpenTheme: () => void
  isAdmin?: boolean
  isModerator?: boolean
  theme?: ThemeColors
  onRegisterUser: (u: User) => void
  /** 短信通道是否已配置 */
  smsEnabled?: boolean
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
  isModerator,
  theme,
  onRegisterUser,
  smsEnabled,
}: LayoutProps) {
  const [loginOpen, setLoginOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login')
  const [phoneInput, setPhoneInput] = useState('')
  const [registerCode, setRegisterCode] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [loginError, setLoginError] = useState('')
  const [postOpen, setPostOpen] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [expandedFolders, setExpandedFolders] = useState<string[]>([])
  const [fileError, setFileError] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [uploadingName, setUploadingName] = useState('')
  const [postToast, setPostToast] = useState('')
  const [bgTasks, setBgTasks] = useState<BgPublishTask[]>([])
  const uploadedCacheRef = useRef<Map<File, Attachment>>(new Map())
  const toastTimerRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

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

  const requestNotifyPermission = useCallback(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  const showToast = useCallback((message: string) => {
    setPostToast(message)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setPostToast(''), 3200)
  }, [])

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
  }, [])

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    const username = String(fd.get('username') || '').trim()
    const password = String(fd.get('password') || '').trim()
    try {
      const { token, user: loggedIn } = await api.login(username, password)
      api.setToken(token)
      setUser(loggedIn)
      requestNotifyPermission()
      setLoginError('')
      setLoginOpen(false)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : '登录失败')
    }
  }, [setUser, requestNotifyPermission])

  const handleRegister = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    const username = String(fd.get('username') || '').trim()
    const password = String(fd.get('password') || '').trim()
    const confirm = String(fd.get('confirmPassword') || '').trim()
    const name = String(fd.get('name') || '').trim()
    const country = String(fd.get('country') || '').trim()
    const phone = phoneInput.trim()

    if (!username || !password || !name) {
      setLoginError('请填写用户名、密码和昵称')
      return
    }
    if (!country) {
      setLoginError('请选择所在国家或地区')
      return
    }
    if (!/^\+?[\d\s-]{6,20}$/.test(phone)) {
      setLoginError('请填写有效手机号（用于违规溯源）')
      return
    }
    if (smsEnabled && !/^\d{6}$/.test(registerCode)) {
      setLoginError('请填写手机收到的 6 位短信验证码')
      return
    }
    if (password !== confirm) {
      setLoginError('两次输入的密码不一致')
      return
    }

    try {
      const { token, user: registered } = await api.register(username, password, name, country, phone, registerCode)
      api.setToken(token)
      onRegisterUser(registered)
      setUser(registered)
      requestNotifyPermission()
      setLoginError('')
      setLoginOpen(false)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : '注册失败')
    }
  }, [onRegisterUser, setUser, requestNotifyPermission, phoneInput, registerCode, smsEnabled])

  const handleResetPassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    const password = String(fd.get('newPassword') || '').trim()
    const confirm = String(fd.get('confirmPassword') || '').trim()
    const username = String(fd.get('username') || '').trim()
    const phone = phoneInput.trim()

    if (!/^\+?[\d\s-]{6,20}$/.test(phone)) {
      setLoginError('请填写已绑定的手机号')
      return
    }
    if (!smsEnabled && !username) {
      setLoginError('请填写用户名')
      return
    }
    if (smsEnabled && !/^\d{6}$/.test(resetCode)) {
      setLoginError('请填写手机收到的 6 位短信验证码')
      return
    }
    if (!password) {
      setLoginError('请输入新密码')
      return
    }
    if (password !== confirm) {
      setLoginError('两次输入的密码不一致')
      return
    }

    try {
      const { token, user: restored } = await api.resetPassword(phone, resetCode, password, username)
      api.setToken(token)
      setUser(restored)
      requestNotifyPermission()
      setLoginError('')
      setLoginOpen(false)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : '密码重置失败')
    }
  }, [setUser, requestNotifyPermission, phoneInput, resetCode, smsEnabled])

  const switchAuthMode = useCallback((mode: 'login' | 'register' | 'reset') => {
    setAuthMode(mode)
    setLoginError('')
    setRegisterCode('')
    setResetCode('')
  }, [])

  const handleLogout = useCallback(() => {
    api.logout().catch(() => { /* 忽略登出接口失败 */ })
    api.clearToken()
    setUser(null)
  }, [setUser])

  const handlePickFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []).map(file => ({
      file,
      folder: fileRelativeFolder(file),
    }))
    e.target.value = ''
    if (picked.length === 0) return
    if (pendingFiles.length + picked.length > 100) {
      setFileError('单个帖子最多 100 个附件，请分批发布')
      return
    }
    setFileError('')
    setPendingFiles(prev => [...prev, ...picked])
  }, [pendingFiles.length])

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const removePendingFolder = useCallback((name: string) => {
    setPendingFiles(prev => prev.filter(p => attachmentTopFolder(p) !== name))
    setExpandedFolders(prev => prev.filter(n => n !== name))
  }, [])

  const togglePendingFolder = useCallback((name: string) => {
    setExpandedFolders(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }, [])

  // 文件夹合并展示：同一次选择的整文件夹只占一条，展开后才是里面的文件
  const pendingGroups = useMemo(() => {
    const folders = new Map<string, { name: string; entries: Array<{ pending: PendingFile; index: number }> }>()
    const loose: Array<{ pending: PendingFile; index: number }> = []
    pendingFiles.forEach((pending, index) => {
      const top = attachmentTopFolder(pending)
      if (!top) {
        loose.push({ pending, index })
        return
      }
      const group = folders.get(top) || { name: top, entries: [] }
      group.entries.push({ pending, index })
      folders.set(top, group)
    })
    return { folders: Array.from(folders.values()), loose }
  }, [pendingFiles])

  const resetPostComposer = useCallback(() => {
    setPostOpen(false)
    setPendingFiles([])
    setExpandedFolders([])
    setFileError('')
    setPublishing(false)
    setUploadPercent(0)
    setUploadingName('')
  }, [])

  // 发布中禁止关闭；有未发布附件时关闭需确认，避免误点遮罩丢内容
  const requestClosePost = useCallback(() => {
    if (publishing) return
    if (pendingFiles.length > 0 && !window.confirm('还有未发布的附件，确定放弃本次发布？')) return
    resetPostComposer()
  }, [publishing, pendingFiles.length, resetPostComposer])

  // 上传附件并发布帖子；失败时抛出带具体原因的错误，供前台/后台共用
  const publishPost = useCallback(async (params: {
    title: string
    summary: string
    category: string
    files: PendingFile[]
    onProgress?: (percent: number, name: string) => void
  }) => {
    const { title, summary, category, files } = params
    const total = files.length
    const progress = new Map<File, number>()
    const report = (name = '') => {
      if (total === 0) {
        params.onProgress?.(100, name)
        return
      }
      let sum = 0
      for (const item of files) {
        sum += uploadedCacheRef.current.has(item.file) ? 100 : (progress.get(item.file) || 0)
      }
      params.onProgress?.(Math.round(sum / total), name)
    }

    const results: Array<Attachment | undefined> = new Array(total)
    const errors: string[] = []
    let cursor = 0
    let aborted = false

    // 并发 4 个上传，避免几十个附件串行等待；已上传成功的文件在重试时直接复用
    const worker = async () => {
      while (!aborted && cursor < total) {
        const index = cursor++
        const file = files[index].file
        const cached = uploadedCacheRef.current.get(file)
        if (cached) {
          results[index] = cached
          report(file.name)
          continue
        }
        report(file.name)
        try {
          const uploaded = await api.uploadFile(file, pct => {
            progress.set(file, pct)
            report(file.name)
          })
          uploadedCacheRef.current.set(file, uploaded)
          results[index] = uploaded
        } catch (err) {
          aborted = true
          errors.push(`「${file.name}」${err instanceof Error ? err.message : '上传失败'}`)
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, total) }, worker))

    if (aborted || errors.length > 0) {
      throw new Error(`上传失败：${errors[0] || '请检查网络后重试'}`)
    }

    const attachments = results.filter((a): a is Attachment => !!a)
    try {
      await onPost({
        id: '',
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
    } catch (err) {
      throw new Error(`发布失败：${err instanceof Error ? err.message : '请稍后重试'}`)
    }
  }, [onPost, user])

  const handlePost = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (publishing) return
    const form = e.currentTarget as HTMLFormElement
    const fd = new FormData(form)
    const title = String(fd.get('title') || '')
    const summary = String(fd.get('summary') || '')
    const category = String(fd.get('category') || '技术问答')
    if (!title.trim()) return

    const files = pendingFiles
    setPublishing(true)
    setFileError('')
    setUploadPercent(files.length === 0 ? 100 : 0)
    setUploadingName(files.length > 0 ? files[0].file.name : '')
    try {
      await publishPost({
        title,
        summary,
        category,
        files,
        onProgress: (percent, name) => {
          setUploadPercent(percent)
          if (name) setUploadingName(name)
        },
      })
      showToast('发布成功，已存入对应板块')
      resetPostComposer()
    } catch (err) {
      setFileError(err instanceof Error ? err.message : '发布失败，请稍后重试')
      setPublishing(false)
      setUploadingName('')
    }
  }, [publishPost, publishing, pendingFiles, resetPostComposer, showToast])

  const dismissBgTask = useCallback((id: string) => {
    setBgTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  // 转为后台发布：立即关闭弹窗，上传与发布在后台继续，可正常看帖、发私信
  const startBackgroundPublish = useCallback((form: HTMLFormElement | null) => {
    if (!form || publishing) return
    const fd = new FormData(form)
    const title = String(fd.get('title') || '').trim()
    const summary = String(fd.get('summary') || '')
    const category = String(fd.get('category') || '技术问答')
    if (!title) {
      setFileError('请先填写标题')
      return
    }
    const files = pendingFiles
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const patchTask = (patch: Partial<BgPublishTask>) => {
      setBgTasks(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)))
    }

    const run = () => {
      patchTask({
        status: files.length === 0 ? 'publishing' : 'uploading',
        percent: files.length === 0 ? 100 : 0,
        error: undefined,
        name: undefined,
      })
      publishPost({
        title,
        summary,
        category,
        files,
        onProgress: (percent, name) => {
          patchTask({
            percent,
            status: percent >= 100 ? 'publishing' : 'uploading',
            ...(name ? { name } : {}),
          })
        },
      }).then(() => {
        patchTask({ percent: 100, status: 'done' })
        showToast(`《${title}》发布成功`)
        window.setTimeout(() => {
          setBgTasks(prev => prev.filter(t => t.id !== id))
        }, 5000)
      }).catch(err => {
        patchTask({
          status: 'error',
          error: err instanceof Error ? err.message : '发布失败',
          retry: run,
        })
      })
    }

    setBgTasks(prev => [...prev, {
      id,
      title,
      percent: files.length === 0 ? 100 : 0,
      status: files.length === 0 ? 'publishing' : 'uploading',
    }])
    resetPostComposer()
    run()
  }, [publishPost, publishing, pendingFiles, resetPostComposer, showToast])

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
            className="icon-btn profile-entry-btn"
            aria-label="个人信息入口"
            onClick={() => user ? onProfile() : setLoginOpen(true)}
          >
            {user && avatarUrl(user.avatar)
              ? <img className="header-avatar-img" src={avatarUrl(user.avatar) as string} alt={user.name} />
              : <IconUser />}
          </button>
          {user && (
            <span className="header-user" style={{ cursor: 'pointer' }} onClick={onProfile}>{user.name}</span>
          )}
          {user && (
            <span
              className="header-user"
              style={{ cursor: 'pointer' }}
              title="退出登录"
              onClick={handleLogout}
            >
              退出
            </span>
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
          {(isAdmin || isModerator) && (
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

      <button className="fab" aria-label="发帖" onClick={() => { uploadedCacheRef.current.clear(); setPostOpen(true) }}>
        <IconPlus />
      </button>

      {loginOpen && (
        <div className="modal-overlay" onClick={() => setLoginOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{authMode === 'register' ? '注册账号' : authMode === 'reset' ? '找回密码' : '登录'}</h3>
              <button className="modal-close" onClick={() => setLoginOpen(false)} aria-label="关闭"><IconClose /></button>
            </div>
            {authMode === 'reset' ? (
              <form onSubmit={handleResetPassword}>
                <p className="login-hint">
                  {smsEnabled
                    ? '用注册时绑定的手机号接收短信验证码，即可设置新密码。'
                    : '填写注册时的用户名与绑定手机号，即可设置新密码。'}
                </p>
                {!smsEnabled && (
                  <label className="field-label">
                    用户名
                    <input name="username" className="field-input" placeholder="输入注册时的用户名" required />
                  </label>
                )}
                <label className="field-label">
                  已绑定手机号
                  <input
                    name="phone"
                    type="tel"
                    className="field-input"
                    placeholder="输入绑定的手机号"
                    value={phoneInput}
                    onChange={e => { setPhoneInput(e.target.value); setLoginError('') }}
                    required
                  />
                </label>
                {smsEnabled && (
                  <SmsCodeField
                    phone={phoneInput}
                    purpose="reset"
                    value={resetCode}
                    onChange={setResetCode}
                    onError={setLoginError}
                  />
                )}
                <label className="field-label">
                  新密码
                  <input name="newPassword" type="password" className="field-input" placeholder="输入新密码" required />
                </label>
                <label className="field-label">
                  确认新密码
                  <input name="confirmPassword" type="password" className="field-input" placeholder="再次输入新密码" required />
                </label>
                {loginError && <p className="login-error">{loginError}</p>}
                <button type="submit" className="btn-primary">重置密码并登录</button>
              </form>
            ) : (
              <form onSubmit={authMode === 'register' ? handleRegister : handleLogin}>
                <label className="field-label">
                  用户名
                  <input name="username" className="field-input" placeholder="输入用户名" required />
                </label>
                <label className="field-label">
                  密码
                  <input name="password" type="password" className="field-input" placeholder="输入密码" required />
                </label>
                {authMode === 'register' && (
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
                      国家 / 地区
                      <select name="country" className="field-input" defaultValue="" required>
                        <option value="" disabled>选择你所在的国家或地区</option>
                        {COUNTRY_OPTIONS.map(c => (
                          <option key={c.id} value={c.id}>{c.flag} {c.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field-label">
                      手机号（必填）
                      <input
                        name="phone"
                        type="tel"
                        className="field-input"
                        placeholder="用于实名绑定，违规可溯源"
                        value={phoneInput}
                        onChange={e => { setPhoneInput(e.target.value); setLoginError('') }}
                        required
                      />
                    </label>
                    {smsEnabled && (
                      <SmsCodeField
                        phone={phoneInput}
                        purpose="register"
                        value={registerCode}
                        onChange={setRegisterCode}
                        onError={setLoginError}
                      />
                    )}
                    <label className="field-label">
                      个人简介
                      <input name="bio" className="field-input" placeholder="一句话介绍" />
                    </label>
                  </>
                )}
                {loginError && <p className="login-error">{loginError}</p>}
                <button type="submit" className="btn-primary">
                  {authMode === 'register' ? '注册' : '登录'}
                </button>
              </form>
            )}
            <div className="login-toggle">
              {authMode === 'login' && (
                <>
                  <button type="button" className="login-toggle-btn" onClick={() => switchAuthMode('reset')}>
                    忘记密码？
                  </button>
                  <button type="button" className="login-toggle-btn" onClick={() => switchAuthMode('register')}>
                    没有账号？去注册
                  </button>
                </>
              )}
              {authMode === 'register' && (
                <button type="button" className="login-toggle-btn" onClick={() => switchAuthMode('login')}>
                  已有账号？去登录
                </button>
              )}
              {authMode === 'reset' && (
                <button type="button" className="login-toggle-btn" onClick={() => switchAuthMode('login')}>
                  返回登录
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {postOpen && (
        <div className="modal-overlay">
          <div className="modal post-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>发布帖子</h3>
              <button className="modal-close" onClick={requestClosePost} disabled={publishing} aria-label="关闭"><IconClose /></button>
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
                  aria-label="选择附件文件或图片"
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  multiple
                  className="post-file-input"
                  onChange={handlePickFiles}
                  aria-label="选择文件夹"
                  {...({ webkitdirectory: '', directory: '' } as any)}
                />
                <button type="button" className="post-file-add" onClick={() => fileInputRef.current?.click()} disabled={publishing}>
                  <IconPaperclip /> 添加文件/图片
                </button>
                <button type="button" className="post-file-add" onClick={() => folderInputRef.current?.click()} disabled={publishing}>
                  <IconFolder /> 添加文件夹
                </button>
                <span className="post-file-hint">支持一次选择多个文件、图片，或直接上传整个文件夹；文件夹会整体归档到仓库，支持在线预览</span>
                {pendingFiles.length > 0 && (
                  <div className="post-file-list">
                    {pendingGroups.folders.map(g => {
                      const open = expandedFolders.includes(g.name)
                      const totalSize = g.entries.reduce((sum, it) => sum + it.pending.file.size, 0)
                      return (
                        <div key={`folder-${g.name}`} className="post-folder-item">
                          <div className="post-file-item post-folder-row">
                            <button
                              type="button"
                              className="post-folder-toggle"
                              onClick={() => togglePendingFolder(g.name)}
                              aria-expanded={open}
                            >
                              <span className={`post-folder-chevron ${open ? 'open' : ''}`}><IconChevronLeft /></span>
                              <IconFolder />
                              <span className="post-file-name">{g.name}</span>
                              <span className="post-file-size">{g.entries.length} 个文件 · {formatFileSize(totalSize)}</span>
                            </button>
                            <button
                              type="button"
                              className="post-file-remove"
                              onClick={() => removePendingFolder(g.name)}
                              disabled={publishing}
                              aria-label={`移除文件夹 ${g.name}`}
                            >
                              <IconClose />
                            </button>
                          </div>
                          {open && (
                            <div className="post-folder-children">
                              {g.entries.map(it => (
                                <div key={`${it.pending.folder}/${it.pending.file.name}-${it.index}`} className="post-file-item">
                                  <span className="post-file-name">{attachmentPath({ folder: it.pending.folder, name: it.pending.file.name }, g.name)}</span>
                                  <span className="post-file-size">{formatFileSize(it.pending.file.size)}</span>
                                  <button
                                    type="button"
                                    className="post-file-remove"
                                    onClick={() => removePendingFile(it.index)}
                                    disabled={publishing}
                                    aria-label={`移除 ${it.pending.file.name}`}
                                  >
                                    <IconClose />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {pendingGroups.loose.map(it => (
                      <div key={`${it.pending.file.name}-${it.index}`} className="post-file-item">
                        <span className="post-file-name">{it.pending.file.name}</span>
                        <span className="post-file-size">{formatFileSize(it.pending.file.size)}</span>
                        <button
                          type="button"
                          className="post-file-remove"
                          onClick={() => removePendingFile(it.index)}
                          disabled={publishing}
                          aria-label={`移除 ${it.pending.file.name}`}
                        >
                          <IconClose />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {fileError && <p className="login-error">{fileError}</p>}
              </div>
              {publishing && (
                <p className="post-publish-hint">
                  {uploadPercent < 100
                    ? `正在上传 ${uploadPercent}%${uploadingName ? ` · ${uploadingName}` : ''}，请勿关闭窗口…`
                    : '文件已上传，正在发布…'}
                </p>
              )}
              <div className="post-submit-row">
                <button type="submit" className="btn-primary" disabled={publishing}>
                  {publishing ? (uploadPercent < 100 ? `发布中 ${uploadPercent}%` : '发布中…') : '发布'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={publishing}
                  onClick={e => startBackgroundPublish(e.currentTarget.form)}
                  title="立即关闭弹窗，上传和发布在后台继续，可同时看帖、发私信"
                >
                  转为后台发布
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bgTasks.length > 0 && (
        <div className="bg-publish-panel" aria-live="polite">
          <div className="bg-publish-panel-head">后台发布</div>
          {bgTasks.map(t => (
            <div key={t.id} className={`bg-publish-task ${t.status}`}>
              <div className="bg-publish-task-top">
                <span className="bg-publish-title" title={t.title}>{t.title}</span>
                {(t.status === 'done' || t.status === 'error') && (
                  <button
                    type="button"
                    className="bg-publish-dismiss"
                    onClick={() => dismissBgTask(t.id)}
                    aria-label="关闭提示"
                  ><IconClose /></button>
                )}
              </div>
              <div className="bg-publish-meta">
                {t.status === 'done' && '发布成功'}
                {t.status === 'error' && (t.error || '发布失败')}
                {t.status === 'publishing' && '正在发布…'}
                {t.status === 'uploading' && `上传中 ${t.percent}%${t.name ? ` · ${t.name}` : ''}`}
              </div>
              {(t.status === 'uploading' || t.status === 'publishing') && (
                <div className="bg-publish-bar">
                  <span style={{ width: `${t.status === 'publishing' ? 100 : t.percent}%` }} />
                </div>
              )}
              {t.status === 'error' && t.retry && (
                <div className="bg-publish-retry-row">
                  <button type="button" className="bg-publish-retry" onClick={t.retry}>重试</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {postToast && <div className="app-toast" role="status">{postToast}</div>}
    </div>
  )
}
