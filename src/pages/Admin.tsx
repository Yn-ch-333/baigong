import { useState, useMemo } from 'react'
import type { User, Post, Category } from '../types'
import {
  IconFilter, IconMessage, IconEye, IconShield,
  IconCode, IconClose, IconPlus, IconCheck, IconPalette,
} from '../icons'
import ThemePanel from '../components/ThemePanel'
import type { ThemeColors } from '../types'
import './Admin.css'

interface AdminProps {
  user: User | null
  users: User[]
  posts: Post[]
  categories: Category[]
  theme: ThemeColors
  onDeletePost: (postId: string) => void
  onTogglePin: (postId: string) => void
  onBanUser: (userId: string, banned: boolean) => void
  onAddCategory: (name: string) => void
  onDeleteCategory: (categoryId: string) => void
  onThemeChange: (theme: ThemeColors) => void
  onThemeReset: () => void
}

type AdminTab = 'posts' | 'users' | 'categories' | 'theme'

const IconUserSmall = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
)

const IconTrash = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
)

const IconPin = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14"/><path d="M12 2v10"/></svg>
)

export default function Admin({
  user,
  users,
  posts,
  categories,
  theme,
  onDeletePost,
  onTogglePin,
  onBanUser,
  onAddCategory,
  onDeleteCategory,
  onThemeChange,
  onThemeReset,
}: AdminProps) {
  const [tab, setTab] = useState<AdminTab>('posts')
  const [search, setSearch] = useState('')
  const [newCategory, setNewCategory] = useState('')

  const isAdmin = user?.role === 'admin'

  const filteredPosts = useMemo(() => {
    return posts.filter(p =>
      p.title.includes(search) || p.author.includes(search) || p.category.includes(search)
    )
  }, [posts, search])

  const filteredUsers = useMemo(() => {
    return users.filter(u =>
      u.name.includes(search) || (u.bio?.includes(search) ?? false)
    )
  }, [users, search])

  const handleAddCategory = () => {
    const name = newCategory.trim()
    if (!name) return
    onAddCategory(name)
    setNewCategory('')
  }

  if (!isAdmin) {
    return (
      <div className="admin-center">
        <div className="admin-forbidden">
          <IconShield />
          <h2>管理员权限 required</h2>
          <p>请先以管理员身份登录后访问此页面。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="content-row">
      <section className="admin-center">
        <div className="admin-header-bar">
          <h1 className="admin-page-title">
            <IconShield />
            管理后台
          </h1>
          <span className="admin-subtitle">帖子 / 用户 / 板块</span>
        </div>

        <div className="admin-tabs">
          <button
            className={`admin-tab ${tab === 'posts' ? 'active' : ''}`}
            onClick={() => setTab('posts')}
          >
            <IconMessage /> 帖子管理
          </button>
          <button
            className={`admin-tab ${tab === 'users' ? 'active' : ''}`}
            onClick={() => setTab('users')}
          >
            <IconUserSmall /> 用户管理
          </button>
          <button
            className={`admin-tab ${tab === 'categories' ? 'active' : ''}`}
            onClick={() => setTab('categories')}
          >
            <IconCode /> 板块管理
          </button>
          <button
            className={`admin-tab ${tab === 'theme' ? 'active' : ''}`}
            onClick={() => setTab('theme')}
          >
            <IconPalette /> 主题配色
          </button>
        </div>

        <div className="search-wrap">
          <input
            type="text"
            className="search-input"
            placeholder={tab === 'posts' ? '检索帖子标题 / 作者 / 板块' : '检索用户名 / 简介'}
            aria-label="搜索"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="search-icon"><IconFilter /></span>
        </div>

        {tab === 'posts' && (
          <div className="admin-list">
            {filteredPosts.map(p => (
              <article key={p.id} className="admin-card">
                <div className="admin-card-meta">
                  <span className="item-tag">{p.category}</span>
                  {p.pinned && <span className="item-tag pin-tag">置顶</span>}
                  <span className="admin-card-date">{p.date}</span>
                </div>
                <h2 className="admin-card-title">{p.title}</h2>
                <p className="admin-card-summary">{p.summary}</p>
                <div className="admin-card-stats">
                  <span className="stat-author">{p.author}</span>
                  <span className="stat-divider" />
                  <span className="stat-item"><IconEye /> {p.views}</span>
                  <span className="stat-item"><IconMessage /> {p.comments ?? 0}</span>
                </div>
                <div className="admin-card-actions">
                  <button className="admin-action-btn" onClick={() => onTogglePin(p.id)}>
                    <IconPin /> {p.pinned ? '取消置顶' : '置顶'}
                  </button>
                  <button className="admin-action-btn danger" onClick={() => onDeletePost(p.id)}>
                    <IconTrash /> 删除
                  </button>
                </div>
              </article>
            ))}
            {filteredPosts.length === 0 && (
              <div className="post-empty">未找到匹配的帖子</div>
            )}
          </div>
        )}

        {tab === 'users' && (
          <div className="admin-list">
            {filteredUsers.map(u => (
              <article key={u.id} className="admin-card user-card">
                <div className="admin-user-main">
                  <div className="admin-user-avatar">{u.avatar}</div>
                  <div className="admin-user-info">
                    <div className="admin-user-name-row">
                      <span className="admin-user-name">{u.name}</span>
                      {u.role === 'admin' && <span className="role-badge admin"><IconShield /> 管理员</span>}
                      {u.banned && <span className="role-badge banned">已封禁</span>}
                    </div>
                    <p className="admin-user-bio">{u.bio || '暂无个人简介'}</p>
                    <span className="admin-user-date">加入于 {u.joinDate}</span>
                  </div>
                </div>
                {u.role !== 'admin' && (
                  <button
                    className={`admin-action-btn ${u.banned ? 'primary' : 'danger'}`}
                    onClick={() => onBanUser(u.id, !u.banned)}
                  >
                    {u.banned ? <><IconCheck /> 解封</> : <><IconClose /> 封禁</>}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}

        {tab === 'categories' && (
          <div className="admin-list">
            <div className="admin-add-bar">
              <input
                type="text"
                className="field-input admin-add-input"
                placeholder="输入新板块名称"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
              />
              <button className="admin-action-btn primary" onClick={handleAddCategory}>
                <IconPlus /> 新增板块
              </button>
            </div>
            {categories.map(c => (
              <article key={c.id} className="admin-card category-card">
                <div className="admin-category-main">
                  <span className="item-tag">{c.name}</span>
                  <span className="admin-category-count">{c.count} 帖</span>
                </div>
                <button className="admin-action-btn danger" onClick={() => onDeleteCategory(c.id)}>
                  <IconTrash /> 删除
                </button>
              </article>
            ))}
          </div>
        )}

        {tab === 'theme' && (
          <div className="admin-list">
            <div className="admin-card">
              <h2 className="admin-card-title"><IconPalette /> 论坛主题配色</h2>
              <p className="admin-card-summary">调整下列颜色即可实时刷新整个论坛界面。仅当前会话生效。</p>
              <ThemePanel theme={theme} onChange={onThemeChange} onReset={onThemeReset} />
            </div>
          </div>
        )}
      </section>

      <aside className="right-modules">
        <section className="module-card" aria-label="管理概览">
          <div className="module-head">
            <IconShield />
            <h2>管理概览</h2>
            <span className="accent-dot" />
          </div>
          <div className="module-body">
            <div className="admin-stat-item">
              <span className="admin-stat-label">注册用户</span>
              <span className="admin-stat-value">{users.length}</span>
            </div>
            <div className="admin-stat-item">
              <span className="admin-stat-label">帖子总数</span>
              <span className="admin-stat-value">{posts.length}</span>
            </div>
            <div className="admin-stat-item">
              <span className="admin-stat-label">板块数量</span>
              <span className="admin-stat-value">{categories.length}</span>
            </div>
            <div className="admin-stat-item">
              <span className="admin-stat-label">置顶新闻</span>
              <span className="admin-stat-value">{posts.filter(p => p.pinned).length}</span>
            </div>
          </div>
        </section>
      </aside>
    </div>
  )
}
