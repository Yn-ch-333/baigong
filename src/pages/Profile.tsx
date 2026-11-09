import { useMemo, useRef, useState } from 'react'
import type { User, Post, PageRoute, Collection } from '../types'
import { avatarUrl, avatarInitial } from '../fileStore'
import * as api from '../api'
import { COUNTRY_OPTIONS } from '../components/WorldMap'
import SmsCodeField from '../components/SmsCodeField'
import {
  IconNewspaper, IconCode, IconMessage, IconMail, IconBookmark,
  IconClose, IconPaperclip, IconEye,
} from '../icons'
import './PostList.css'
import './Profile.css'

interface ProfileProps {
  users: User[]
  posts: Post[]
  currentUser: User | null
  selectedUserId: string
  collections: Collection[]
  onNavigate: (page: PageRoute) => void
  onSendMessage: (userId: string) => void
  onViewPost: (postId: string) => void
  onToggleCollection: (postId: string) => void
  onUpdateProfile: (data: { name?: string; bio?: string; avatar?: string; country?: string }) => Promise<void>
  onPhoneBound: (user: User) => void
  /** 短信通道是否已配置；未配置时隐藏更换手机号入口 */
  smsEnabled?: boolean
  isAdmin?: boolean
}

function maskPhone(phone?: string): string {
  if (!phone || phone.length <= 7) return phone || ''
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

const IconUserLarge = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
)

const IconShield = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
)

const IconCalendar = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
)

const IconFileText = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
)

const IconEdit = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
)

function UserAvatar({ user, size }: { user?: User; size?: 'large' }) {
  const src = avatarUrl(user?.avatar)
  const initial = avatarInitial(user?.avatar, user?.name)
  return (
    <div className={`profile-avatar ${size === 'large' ? 'large' : ''}`}>
      {src
        ? <img className="profile-avatar-img" src={src} alt={user?.name || '头像'} />
        : initial
          ? <span className="profile-avatar-letter">{initial}</span>
          : <IconUserLarge />}
    </div>
  )
}

export default function Profile({
  users, posts, currentUser, selectedUserId, collections,
  onNavigate, onSendMessage, onViewPost, onToggleCollection, onUpdateProfile, onPhoneBound, smsEnabled, isAdmin,
}: ProfileProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editAvatar, setEditAvatar] = useState('')
  const [editCountry, setEditCountry] = useState('')
  const [editError, setEditError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [collectionsOpen, setCollectionsOpen] = useState(false)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [phoneBusy, setPhoneBusy] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const profileUser = useMemo(() => {
    return users.find(u => u.id === selectedUserId) || users[0]
  }, [users, selectedUserId])

  const userPosts = useMemo(() => {
    return posts.filter(p => p.authorId === profileUser?.id)
  }, [posts, profileUser])

  const pinnedPosts = posts.filter(p => p.pinned).slice(0, 5)

  const collectedItems = useMemo(() => {
    return collections
      .filter(c => c.userId === currentUser?.id)
      .map(c => ({ collection: c, post: posts.find(p => p.id === c.postId) }))
      .filter((it): it is { collection: Collection; post: Post } => !!it.post)
  }, [collections, currentUser, posts])

  const isSelf = currentUser?.id === profileUser?.id

  const openEdit = () => {
    if (!profileUser) return
    setEditName(profileUser.name)
    setEditBio(profileUser.bio || '')
    setEditAvatar(profileUser.avatar || '')
    setEditCountry(profileUser.country || '')
    setEditError('')
    setEditOpen(true)
  }

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setEditError('请选择图片文件作为头像')
      return
    }
    setUploading(true)
    setEditError('')
    try {
      const uploaded = await api.uploadFile(file)
      setEditAvatar(`file:${uploaded.id}`)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '头像上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setEditError('昵称不能为空')
      return
    }
    setSaving(true)
    setEditError('')
    try {
      await onUpdateProfile({ name: editName.trim(), bio: editBio.trim(), avatar: editAvatar, country: editCountry })
      setEditOpen(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const openPhoneModal = () => {
    setNewPhone('')
    setPhoneCode('')
    setPhoneError('')
    setPhoneOpen(true)
  }

  const handleChangePhone = async () => {
    if (!/^\+?[\d\s-]{6,20}$/.test(newPhone.trim())) {
      setPhoneError('请填写有效的新手机号')
      return
    }
    if (!/^\d{6}$/.test(phoneCode)) {
      setPhoneError('请填写手机收到的 6 位短信验证码')
      return
    }
    setPhoneBusy(true)
    setPhoneError('')
    try {
      const { user: updated } = await api.bindPhone(newPhone.trim(), phoneCode)
      onPhoneBound(updated)
      setPhoneOpen(false)
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : '更换失败，请重试')
    } finally {
      setPhoneBusy(false)
    }
  }

  return (
    <div className="content-row">
      {/* Center column */}
      <section className="profile-center">
        <div className="profile-card">
          <UserAvatar user={profileUser} />
          <div className="profile-info">
            <div className="profile-name-row">
              <h1 className="profile-name">{profileUser?.name}</h1>
              {profileUser?.role === 'admin' && (
                <span className="role-badge admin"><IconShield /> 管理员</span>
              )}
              {profileUser?.banned && (
                <span className="role-badge banned">已封禁</span>
              )}
            </div>
            <p className="profile-bio">{profileUser?.bio || '暂无个人简介'}</p>
            <div className="profile-meta">
              <span className="profile-meta-item"><IconCalendar /> 加入于 {profileUser?.joinDate || '2025.01.01'}</span>
              <span className="profile-meta-item"><IconFileText /> 发帖 {userPosts.length}</span>
              {isSelf && (
                <button
                  className="profile-meta-item profile-meta-btn"
                  onClick={() => setCollectionsOpen(true)}
                  title="查看我的收藏"
                >
                  <IconBookmark /> 收藏 {collectedItems.length}
                </button>
              )}
            </div>
          </div>
          <div className="profile-actions">
            {isSelf && (
              <button className="profile-btn primary" onClick={openEdit}>
                <IconEdit /> 编辑资料
              </button>
            )}
            {isSelf && smsEnabled && currentUser?.phone && (
              <button className="profile-btn" onClick={openPhoneModal}>
                更换手机号
              </button>
            )}
            {isSelf && (
              <button className="profile-btn" onClick={() => setCollectionsOpen(true)}>
                <IconBookmark /> 我的收藏
              </button>
            )}
            {!isSelf && (
              <button className="profile-btn primary" onClick={() => profileUser && onSendMessage(profileUser.id)}>
                <IconMail /> 发私信
              </button>
            )}
            {isAdmin && !isSelf && (
              <button className="profile-btn danger" onClick={() => profileUser && onSendMessage(profileUser.id)}>
                私信警告
              </button>
            )}
          </div>
        </div>

        <div className="profile-section-head">
          <IconMessage />
          <h2>Ta 的帖子</h2>
          <span className="accent-dot" />
        </div>

        <div className="profile-post-list">
          {userPosts.map(p => (
            <article key={p.id} className="post-card" onClick={() => onViewPost(p.id)}>
              <div className="post-card-meta">
                <span className="item-tag">{p.category}</span>
                <span className="post-card-date">{p.date}</span>
              </div>
              <h2 className="post-card-title">{p.title}</h2>
              <p className="post-card-summary">{p.summary}</p>
              <div className="post-card-stats">
                <span className="stat-item"><IconFileText /> 阅读 {p.views}</span>
                <span className="stat-item"><IconMessage /> {p.comments ?? 0}</span>
              </div>
            </article>
          ))}
          {userPosts.length === 0 && (
            <div className="post-empty">该用户还没有发布帖子</div>
          )}
        </div>
      </section>

      {/* Right modules */}
      <aside className="right-modules">
        <section className="module-card" aria-label="新闻">
          <div className="module-head">
            <IconNewspaper />
            <h2>新闻</h2>
            <span className="accent-dot" />
          </div>
          <div className="module-body">
            {pinnedPosts.map(p => (
              <article key={p.id} className="item" onClick={() => onNavigate('posts')}>
                <div className="item-meta">
                  <span className="item-tag pin-tag">置顶</span>
                  <span className="item-date">{p.date}</span>
                </div>
                <div className="item-title">{p.title}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="module-card" aria-label="板块分类">
          <div className="module-head">
            <IconCode />
            <h2>板块分类</h2>
            <span className="accent-dot" />
          </div>
          <div className="module-body">
            <div className="item empty-hint">从帖子列表选择板块</div>
          </div>
        </section>

        {isSelf && (
          <section className="module-card" aria-label="我的收藏">
            <div className="module-head">
              <IconBookmark />
              <h2>我的收藏</h2>
              <span className="accent-dot" />
            </div>
            <div className="module-body">
              {collectedItems.map(({ collection, post }) => (
                <article key={collection.id} className="item" onClick={() => onViewPost(post.id)}>
                  <div className="item-meta">
                    <span className="item-tag">{post.category}</span>
                    <button
                      className="collect-remove"
                      onClick={e => { e.stopPropagation(); onToggleCollection(post.id) }}
                    >取消收藏</button>
                  </div>
                  <div className="item-title">{post.title}</div>
                </article>
              ))}
              {collectedItems.length === 0 && (
                <div className="item empty-hint">暂无收藏</div>
              )}
            </div>
          </section>
        )}
      </aside>

      {editOpen && (
        <div className="modal-overlay" onClick={() => !saving && setEditOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>编辑个人资料</h3>
              <button
                className="modal-close"
                onClick={() => !saving && setEditOpen(false)}
                aria-label="关闭"
              ><IconClose /></button>
            </div>

            <div className="profile-edit-avatar-row">
              <div className="profile-edit-avatar">
                {avatarUrl(editAvatar)
                  ? <img src={avatarUrl(editAvatar) as string} alt="头像预览" />
                  : <span>{avatarInitial(editAvatar, editName) || '头'}</span>}
              </div>
              <div className="profile-edit-avatar-actions">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="post-file-input"
                  onChange={handleAvatarPick}
                />
                <button
                  type="button"
                  className="profile-btn"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploading}
                ><IconPaperclip /> {uploading ? '上传中…' : '更换头像'}</button>
                <span className="profile-edit-hint">支持 JPG / PNG / GIF / WEBP，建议正方形</span>
              </div>
            </div>

            <label className="field-label">
              昵称
              <input
                className="field-input"
                value={editName}
                maxLength={24}
                placeholder="输入昵称"
                onChange={e => setEditName(e.target.value)}
              />
            </label>
            <label className="field-label">
              国家 / 地区
              <select
                className="field-input"
                value={editCountry}
                onChange={e => setEditCountry(e.target.value)}
              >
                <option value="">未选择</option>
                {COUNTRY_OPTIONS.map(c => (
                  <option key={c.id} value={c.id}>{c.flag} {c.name}</option>
                ))}
              </select>
            </label>
            <label className="field-label">
              个人简介
              <textarea
                className="field-input field-area"
                rows={3}
                value={editBio}
                maxLength={120}
                placeholder="一句话介绍自己"
                onChange={e => setEditBio(e.target.value)}
              />
            </label>
            {editError && <p className="login-error">{editError}</p>}
            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveProfile}
              disabled={saving || uploading}
            >{saving ? '保存中…' : '保存'}</button>
          </div>
        </div>
      )}

      {phoneOpen && (
        <div className="modal-overlay" onClick={() => !phoneBusy && setPhoneOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>更换绑定手机号</h3>
              <button
                className="modal-close"
                onClick={() => !phoneBusy && setPhoneOpen(false)}
                aria-label="关闭"
              ><IconClose /></button>
            </div>
            <p className="login-hint">
              验证码将发送至当前绑定的 {maskPhone(currentUser?.phone)}，验证通过后更换为新号码。
            </p>
            <label className="field-label">
              新手机号
              <input
                type="tel"
                className="field-input"
                placeholder="输入要更换的新手机号"
                value={newPhone}
                onChange={e => { setNewPhone(e.target.value); setPhoneError('') }}
              />
            </label>
            <SmsCodeField
              phone=""
              purpose="rebind"
              value={phoneCode}
              onChange={setPhoneCode}
              onError={setPhoneError}
            />
            {phoneError && <p className="login-error">{phoneError}</p>}
            <button
              type="button"
              className="btn-primary"
              onClick={handleChangePhone}
              disabled={phoneBusy}
            >{phoneBusy ? '更换中…' : '确认更换'}</button>
          </div>
        </div>
      )}

      {collectionsOpen && (
        <div className="modal-overlay" onClick={() => setCollectionsOpen(false)}>
          <div className="modal profile-collection-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3><IconBookmark /> 我的收藏 {collectedItems.length}</h3>
              <button className="modal-close" onClick={() => setCollectionsOpen(false)} aria-label="关闭"><IconClose /></button>
            </div>
            <div className="profile-collection-list">
              {collectedItems.map(({ collection, post }) => (
                <div
                  key={collection.id}
                  className="profile-collection-item"
                  onClick={() => { setCollectionsOpen(false); onViewPost(post.id) }}
                >
                  <div className="profile-collection-main">
                    <div className="item-meta">
                      <span className="item-tag">{post.category}</span>
                      <span className="item-date">收藏于 {collection.date}</span>
                    </div>
                    <div className="profile-collection-title">{post.title}</div>
                    <div className="profile-collection-summary">{post.summary}</div>
                  </div>
                  <div className="profile-collection-actions">
                    <button className="profile-btn" onClick={e => { e.stopPropagation(); setCollectionsOpen(false); onViewPost(post.id) }}>
                      <IconEye /> 查看
                    </button>
                    <button className="collect-remove" onClick={e => { e.stopPropagation(); onToggleCollection(post.id) }}>
                      取消收藏
                    </button>
                  </div>
                </div>
              ))}
              {collectedItems.length === 0 && (
                <div className="post-empty">还没有收藏内容，在帖子详情点击「收藏」即可</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
