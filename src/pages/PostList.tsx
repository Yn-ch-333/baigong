import { useEffect, useMemo, useState } from 'react'
import type { Post, Category } from '../types'
import {
  IconSearch, IconNewspaper, IconCode,
  IconMessage, IconEye, IconFilter,
  IconChevronLeft,
} from '../icons'
import './PostList.css'

interface PostListProps {
  posts: Post[]
  categories: Category[]
  selectedCategory: string
  onSelectCategory: (name: string) => void
  onViewProfile: (userId: string) => void
  onViewPost: (postId: string) => void
}

const PAGE_SIZE = 5

export default function PostList({
  posts,
  categories,
  selectedCategory,
  onSelectCategory,
  onViewProfile,
  onViewPost,
}: PostListProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [selectedCategory, search])

  const filteredPosts = useMemo(() => {
    return posts
      .filter(p => (selectedCategory ? p.category === selectedCategory : true))
      .filter(p =>
        p.title.includes(search) || p.summary.includes(search) || p.author.includes(search)
      )
  }, [posts, selectedCategory, search])

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE))
  const pagedPosts = filteredPosts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const pinnedPosts = posts.filter(p => p.pinned).slice(0, 5)

  return (
    <div className="content-row">
      {/* Center column */}
      <section className="post-center">
        <div className="post-header-bar">
          <h1 className="post-page-title">
            <IconFilter />
            帖子广场
          </h1>
          <span className="post-count">共 {filteredPosts.length} 帖</span>
        </div>

        <div className="filter-bar">
          <button
            className={`filter-chip ${selectedCategory === '' ? 'active' : ''}`}
            onClick={() => onSelectCategory('')}
          >
            全部
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              className={`filter-chip ${selectedCategory === c.name ? 'active' : ''}`}
              onClick={() => onSelectCategory(c.name)}
            >
              {c.name}
              <span className="chip-count">{c.count}</span>
            </button>
          ))}
        </div>

        <div className="search-wrap">
          <input
            type="text"
            className="search-input"
            placeholder="检索帖子标题 / 摘要 / 作者"
            aria-label="搜索帖子"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="search-icon"><IconSearch /></span>
        </div>

        <div className="post-list" role="feed" aria-busy="false">
          {pagedPosts.map(p => (
            <article key={p.id} className="post-card" onClick={() => onViewPost(p.id)}>
              <div className="post-card-meta">
                <span className="item-tag">{p.category}</span>
                <span className="post-card-date">{p.date}</span>
              </div>
              <h2 className="post-card-title">{p.title}</h2>
              <p className="post-card-summary">{p.summary}</p>
              <div className="post-card-stats">
                <span
                  className="stat-author"
                  onClick={e => { e.stopPropagation(); if (p.authorId) onViewProfile(p.authorId) }}
                >{p.author}</span>
                <span className="stat-divider" />
                <span className="stat-item"><IconEye /> {p.views}</span>
                <span className="stat-item"><IconMessage /> {p.comments ?? 0}</span>
              </div>
            </article>
          ))}
          {pagedPosts.length === 0 && (
            <div className="post-empty">未找到匹配的帖子</div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="page-btn"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              aria-label="上一页"
            >
              <IconChevronLeft />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                className={`page-btn ${page === n ? 'active' : ''}`}
                onClick={() => setPage(n)}
                aria-label={`第 ${n} 页`}
                aria-current={page === n ? 'page' : undefined}
              >
                {n}
              </button>
            ))}
            <button
              className="page-btn"
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              aria-label="下一页"
            >
              <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}>
                <IconChevronLeft />
              </span>
            </button>
          </div>
        )}
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
              <article
                key={p.id}
                className="item"
                onClick={() => onViewPost(p.id)}
              >
                <div className="item-meta">
                  <span className="item-tag pin-tag">置顶</span>
                  <span className="item-date">{p.date}</span>
                </div>
                <div className="item-title">{p.title}</div>
              </article>
            ))}
            {pinnedPosts.length === 0 && (
              <div className="item empty-hint">暂无置顶新闻</div>
            )}
          </div>
        </section>

        <section className="module-card" aria-label="板块分类">
          <div className="module-head">
            <IconCode />
            <h2>板块分类</h2>
            <span className="accent-dot" />
          </div>
          <div className="module-body">
            {categories.map(c => (
              <article
                key={c.id}
                className={`item category-item ${selectedCategory === c.name ? 'active' : ''}`}
                onClick={() => onSelectCategory(c.name)}
              >
                <div className="item-meta">
                  <span className="item-tag">{c.name}</span>
                  <span className="item-date">{c.count} 帖</span>
                </div>
                <div className="item-title">进入 {c.name} 板块</div>
              </article>
            ))}
          </div>
        </section>
      </aside>
    </div>
  )
}
