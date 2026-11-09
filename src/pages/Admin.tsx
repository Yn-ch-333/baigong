import { useMemo, useState, useEffect } from 'react'
import type { User, Post, Category } from '../types'
import { fetchAdminUsers } from '../api'
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
  onAddCategory: (name: string, description?: string) => Promise<void>
  onUpdateCategory: (categoryId: string, data: { name?: string; description?: string }) => Promise<void>
  onSetCategoryModerator: (categoryId: string, userId: string | null) => Promise<void>
  onMoveCategory: (categoryId: string, direction: 'up' | 'down') => Promise<void>
  onDeleteCategory: (categoryId: string) => Promise<void>
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

interface CategoryRowProps {
  category: Category
  users: User[]
  canAdmin: boolean
  isFirst: boolean
  isLast: boolean
  onUpdate: (categoryId: string, data: { name?: string; description?: string }) => Promise<void>
  onSetModerator: (categoryId: string, userId: string | null) => Promise<void>
  onMove: (categoryId: string, direction: 'up' | 'down') => Promise<void>
  onDelete: (categoryId: string) => Promise<void>
}

function CategoryRow({
  category,
  users,
  canAdmin,
  isFirst,
  isLast,
  onUpdate,
  onSetModerator,
  onMove,
  onDelete,
}: CategoryRowProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [description, setDescription] = useState(category.description || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const startEdit = () => {
    setName(category.name)
    setDescription(category.description || '')
    setError('')
    setEditing(true)
  }

  const save = async () => {
    try {
      setBusy(true)
      await onUpdate(category.id, { name: name.trim(), description: description.trim() })
      setEditing(false)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`确定删除板块「${category.name}」吗？`)) return
    try {
      await onDelete(category.id)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '删除板块失败')
    }
  }

  const changeModerator = async (userId: string) => {
    try {
      await onSetModerator(category.id, userId || null)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '设置板块管理员失败')
    }
  }

  const move = async (direction: 'up' | 'down') => {
    try {
      await onMove(category.id, direction)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '调整顺序失败')
    }
  }

  return (
    <article className="admin-card category-card">
      {editing ? (
        <div className="admin-category-editor">
          <input
            type="text"
            className="field-input"
            value={name}
            maxLength={20}
            placeholder="板块名称"
            aria-label="板块名称"
            onChange={e => setName(e.target.value)}
          />
          <input
            type="text"
            className="field-input"
            value={description}
            maxLength={120}
            placeholder="板块简介（可选）"
            aria-label="板块简介"
            onChange={e => setDescription(e.target.value)}
          />
          {error && <p className="login-error">{error}</p>}
        </div>
      ) : (
        <div className="admin-category-main">
          <span className="item-tag">{category.name}</span>
          <span className="admin-category-count">{category.count} 帖</span>
          {category.description && <span className="admin-category-desc">{category.description}</span>}
          <span className="admin-category-mod">管理员：{category.moderatorName || '未设置'}</span>
        </div>
      )}

      <div className="admin-card-actions">
        {canAdmin && (
          <select
            className="field-input admin-mod-select"
            value={category.moderatorId || ''}
            aria-label={`设置「${category.name}」板块管理员`}
            onChange={e => changeModerator(e.target.value)}
          >
            <option value="">未设置管理员</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}
        {editing ? (
          <>
            <button className="admin-action-btn primary" onClick={save} disabled={busy}>
              <IconCheck /> {busy ? '保存中…' : '保存'}
            </button>
            <button
              className="admin-action-btn"
              onClick={() => { setEditing(false); setError('') }}
            >
              取消
            </button>
          </>
        ) : (
          <button className="admin-action-btn" onClick={startEdit}>编辑</button>
        )}
        {canAdmin && (
          <button className="admin-action-btn" onClick={() => move('up')} disabled={isFirst}>上移</button>
        )}
        {canAdmin && (
          <button className="admin-action-btn" onClick={() => move('down')} disabled={isLast}>下移</button>
        )}
        {canAdmin && (
          <button className="admin-action-btn danger" onClick={remove}>
            <IconTrash /> 删除
          </button>
        )}
      </div>
    </article>
  )
}

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
  onUpdateCategory,
  onSetCategoryModerator,
  onMoveCategory,
  onDeleteCategory,
  onThemeChange,
  onThemeReset,
}: AdminProps) {
  const [tab, setTab] = useState<AdminTab>('posts')
  const [search, setSearch] = useState('')
  const [detailUsers, setDetailUsers] = useState<User[]>([])
  const [detailError, setDetailError] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newCategoryDesc, setNewCategoryDesc] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [adding, setAdding] = useState(false)

  const isAdmin = user?.role === 'admin'
  const myCategories = useMemo(
    () => categories.filter(c => c.moderatorId === user?.id),
    [categories, user?.id],
  )
  const canManage = isAdmin || myCategories.length > 0
  /** 用户个人信息（含手机号）仅频道主可见，全局管理员不可查看 */
  const canViewUsers = myCategories.length > 0
  const visibleCategories = isAdmin ? categories : myCategories

  // 频道主拉取完整个人信息（含手机号），用于违规精准溯源
  useEffect(() => {
    if (!canViewUsers) return
    let alive = true
    fetchAdminUsers()
      .then(({ users: list }) => { if (alive) setDetailUsers(list) })
      .catch(() => { if (alive) setDetailError('个人信息加载失败，请重新登录后再试') })
    return () => { alive = false }
  }, [canViewUsers])

  const filteredPosts = useMemo(() => {
    const permitted = isAdmin
      ? posts
      : posts.filter(p => myCategories.some(c => c.name === p.category))
    return permitted.filter(p =>
      p.title.includes(search) || p.author.includes(search) || p.category.includes(search)
    )
  }, [posts, search, isAdmin, myCategories])

  const filteredUsers = useMemo(() => {
    const list = detailUsers.length ? detailUsers : users
    return list.filter(u =>
      u.name.includes(search)
      || (u.bio?.includes(search) ?? false)
      || (u.username?.includes(search) ?? false)
      || (u.phone?.includes(search) ?? false)
    )
  }, [detailUsers, users, search])

  const handleAddCategory = async () => {
    const name = newCategory.trim()
    if (!name) return
    try {
      setAdding(true)
      await onAddCategory(name, newCategoryDesc.trim())
      setNewCategory('')
      setNewCategoryDesc('')
      setCategoryError('')
    } catch (e) {
      setCategoryError(e instanceof Error ? e.message : '新增板块失败')
    } finally {
      setAdding(false)
    }
  }

  if (!canManage) {
    return (
      <div className="admin-center">
        <div className="admin-forbidden">
          <IconShield />
          <h2>需要管理员权限</h2>
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
            {isAdmin ? '管理后台' : '板块管理'}
          </h1>
          <span className="admin-subtitle">
            {isAdmin ? '帖子 / 用户 / 板块' : `管理板块：${myCategories.map(c => c.name).join('、')}`}
          </span>
        </div>

        <div className="admin-tabs">
          <button
            className={`admin-tab ${tab === 'posts' ? 'active' : ''}`}
            onClick={() => setTab('posts')}
          >
            <IconMessage /> 帖子管理
          </button>
          {canViewUsers && (
            <button
              className={`admin-tab ${tab === 'users' ? 'active' : ''}`}
              onClick={() => setTab('users')}
            >
              <IconUserSmall /> 用户信息
            </button>
          )}
          <button
            className={`admin-tab ${tab === 'categories' ? 'active' : ''}`}
            onClick={() => setTab('categories')}
          >
            <IconCode /> 板块管理
          </button>
          {isAdmin && (
            <button
              className={`admin-tab ${tab === 'theme' ? 'active' : ''}`}
              onClick={() => setTab('theme')}
            >
              <IconPalette /> 主题配色
            </button>
          )}
        </div>

        {tab !== 'theme' && (
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
        )}

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

        {tab === 'users' && canViewUsers && (
          <div className="admin-list">
            <p className="admin-subtitle">
              个人信息仅用于违规精准溯源，请勿外传。可按昵称、用户名或手机号检索。
            </p>
            {detailError && <p className="login-error">{detailError}</p>}
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
                    <div className="admin-user-fields">
                      <span className="admin-user-field">
                        <span className="admin-user-field-label">用户名</span>{u.username || '-'}
                      </span>
                      <span className="admin-user-field">
                        <span className="admin-user-field-label">手机号</span>
                        <span className="admin-user-phone">{u.phone || '未绑定'}</span>
                      </span>
                      <span className="admin-user-field">
                        <span className="admin-user-field-label">国家/地区</span>{u.country || '-'}
                      </span>
                    </div>
                    <span className="admin-user-date">加入于 {u.joinDate}</span>
                  </div>
                </div>
                {isAdmin && u.role !== 'admin' && (
                  <button
                    className={`admin-action-btn ${u.banned ? 'primary' : 'danger'}`}
                    onClick={() => onBanUser(u.id, !u.banned)}
                  >
                    {u.banned ? <><IconCheck /> 解封</> : <><IconClose /> 封禁</>}
                  </button>
                )}
              </article>
            ))}
            {filteredUsers.length === 0 && (
              <div className="post-empty">未找到匹配的用户</div>
            )}
          </div>
        )}

        {tab === 'categories' && (
          <div className="admin-list">
            {isAdmin && (
              <>
                <div className="admin-add-bar">
                  <input
                    type="text"
                    className="field-input admin-add-input"
                    placeholder="输入新板块名称"
                    maxLength={20}
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                  />
                  <input
                    type="text"
                    className="field-input admin-add-input"
                    placeholder="板块简介（可选）"
                    maxLength={120}
                    value={newCategoryDesc}
                    onChange={e => setNewCategoryDesc(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                  />
                  <button className="admin-action-btn primary" onClick={handleAddCategory} disabled={adding}>
                    <IconPlus /> {adding ? '新增中…' : '新增板块'}
                  </button>
                </div>
                {categoryError && <p className="login-error">{categoryError}</p>}
                <p className="admin-subtitle">可自由新增、改名、排序、删除板块，并为每个板块指定管理员。</p>
              </>
            )}
            {!isAdmin && (
              <p className="admin-subtitle">你是这些板块的管理员，可修改板块名称与简介、置顶或删除本板块帖子。</p>
            )}

            {visibleCategories.map((c, i) => (
              <CategoryRow
                key={c.id}
                category={c}
                users={users}
                canAdmin={isAdmin}
                isFirst={i === 0}
                isLast={i === visibleCategories.length - 1}
                onUpdate={onUpdateCategory}
                onSetModerator={onSetCategoryModerator}
                onMove={onMoveCategory}
                onDelete={onDeleteCategory}
              />
            ))}
            {visibleCategories.length === 0 && (
              <div className="post-empty">暂无板块，先新增一个吧</div>
            )}
          </div>
        )}

        {tab === 'theme' && isAdmin && (
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
              <span className="admin-stat-label">{isAdmin ? '帖子总数' : '本板块帖子'}</span>
              <span className="admin-stat-value">{filteredPosts.length}</span>
            </div>
            <div className="admin-stat-item">
              <span className="admin-stat-label">{isAdmin ? '板块数量' : '管理板块数'}</span>
              <span className="admin-stat-value">{visibleCategories.length}</span>
            </div>
            <div className="admin-stat-item">
              <span className="admin-stat-label">置顶新闻</span>
              <span className="admin-stat-value">{filteredPosts.filter(p => p.pinned).length}</span>
            </div>
          </div>
        </section>
      </aside>
    </div>
  )
}
