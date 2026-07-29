import { useState } from 'react'
import type { Post, Category, PageRoute } from '../types'
import {
  IconSearch, IconNewspaper, IconCode,
} from '../icons'
import worldMap from '../assets/world-map.jpg'
import WorldMap from '../components/WorldMap'
import './Home.css'

interface HomeProps {
  posts: Post[]
  categories: Category[]
  onNavigate: (page: PageRoute) => void
  onSelectCategory: (name: string) => void
  onViewProfile: (userId: string) => void
  onViewPost: (postId: string) => void
}

export default function Home({ posts, categories, onNavigate, onSelectCategory, onViewProfile, onViewPost }: HomeProps) {
  const [search, setSearch] = useState('')
  const [mapOpen, setMapOpen] = useState(false)

  const pinnedPosts = posts.filter(p => p.pinned)
  const filteredPosts = pinnedPosts.filter(p =>
    p.title.includes(search) || p.summary.includes(search) || p.category.includes(search)
  )

  const goToPosts = (category?: string) => {
    if (category) onSelectCategory(category)
    onNavigate('posts')
  }

  return (
    <div className="content-row">
      {/* Center column */}
      <section className="center-column">
        <div className="center-space">
          <div className="center-overlay" />
        </div>

        <div className="search-wrap">
          <input
            type="text"
            className="search-input"
            placeholder="检索帖子 / 板块 / 用户"
            aria-label="搜索"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="search-icon"><IconSearch /></span>
        </div>

        <button
          className="map-strip"
          aria-label="全球工业技术交流网络"
          onClick={() => setMapOpen(true)}
          style={{ backgroundImage: `url(${worldMap})` }}
        >
          <div className="map-grid">
            {Array.from({ length: 48 }).map((_, i) => (
              <span key={i} className="map-dot" />
            ))}
          </div>
          <div className="map-label">全球工业技术交流网络</div>
          <span className="map-hint">点击查看分布</span>
        </button>

        <div className="slogan-bar">
          <div className="slogan-line" />
          <span>知行合一 学以致用</span>
          <div className="slogan-line" />
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
              {filteredPosts.slice(0, 5).map(p => (
                <article key={p.id} className="item" onClick={() => onViewPost(p.id)}>
                  <div className="item-meta">
                    <span className="item-tag pin-tag">置顶</span>
                    <span className="item-date">{p.date}</span>
                  </div>
                  <div className="item-title">{p.title}</div>
                  <div className="item-summary">{p.summary}</div>
                  <div className="item-author">
                    作者：
                    <span
                      className="author-link"
                      onClick={e => { e.stopPropagation(); if (p.authorId) onViewProfile(p.authorId) }}
                    >{p.author}</span>
                    · 阅读 {p.views}
                  </div>
                </article>
              ))}
              {filteredPosts.length === 0 && (
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
                className="item category-item"
                onClick={() => goToPosts(c.name)}
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

      {mapOpen && (
        <WorldMap onClose={() => setMapOpen(false)} />
      )}
    </div>
  )
}
