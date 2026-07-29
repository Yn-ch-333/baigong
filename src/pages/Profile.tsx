import { useMemo } from 'react'
import type { User, Post, PageRoute, Collection } from '../types'
import {
  IconNewspaper, IconCode, IconMessage, IconMail, IconBookmark,
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
  isAdmin?: boolean
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

export default function Profile({ users, posts, currentUser, selectedUserId, collections, onNavigate, onSendMessage, onViewPost, onToggleCollection, isAdmin }: ProfileProps) {
  const profileUser = useMemo(() => {
    return users.find(u => u.id === selectedUserId) || users[0]
  }, [users, selectedUserId])

  const userPosts = useMemo(() => {
    return posts.filter(p => p.authorId === profileUser?.id)
  }, [posts, profileUser])

  const pinnedPosts = posts.filter(p => p.pinned).slice(0, 5)

  const collectedPosts = useMemo(() => {
    const ids = new Set(collections.filter(c => c.userId === currentUser?.id).map(c => c.postId))
    return posts.filter(p => ids.has(p.id))
  }, [collections, currentUser, posts])

  const isSelf = currentUser?.id === profileUser?.id

  return (
    <div className="content-row">
      {/* Center column */}
      <section className="profile-center">
        <div className="profile-card">
          <div className="profile-avatar">
            <IconUserLarge />
          </div>
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
              {isSelf && <span className="profile-meta-item"><IconBookmark /> 收藏 {collectedPosts.length}</span>}
            </div>
          </div>
          <div className="profile-actions">
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
              {collectedPosts.map(p => (
                <article key={p.id} className="item" onClick={() => onViewPost(p.id)}>
                  <div className="item-meta">
                    <span className="item-tag">{p.category}</span>
                    <button
                      className="collect-remove"
                      onClick={e => { e.stopPropagation(); onToggleCollection(p.id) }}
                    >取消收藏</button>
                  </div>
                  <div className="item-title">{p.title}</div>
                </article>
              ))}
              {collectedPosts.length === 0 && (
                <div className="item empty-hint">暂无收藏</div>
              )}
            </div>
          </section>
        )}
      </aside>
    </div>
  )
}
