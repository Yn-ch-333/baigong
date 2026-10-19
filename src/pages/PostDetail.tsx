import { useMemo, useState } from 'react'
import type { Post, Category, Comment, User, Attachment } from '../types'
import { downloadAttachment, formatFileSize } from '../fileStore'
import FilePreview from '../components/FilePreview'
import {
  IconChevronLeft, IconMessage, IconEye, IconBookmark,
  IconNewspaper, IconCode, IconPaperclip, IconDownload, IconFile,
} from '../icons'
import './PostDetail.css'
import './PostList.css'
import './Profile.css'
import './Messages.css'

interface PostDetailProps {
  post: Post
  posts: Post[]
  categories: Category[]
  comments: Comment[]
  currentUser: User | null
  isCollected: boolean
  onBack: () => void
  onViewProfile: (userId: string) => void
  onGoToPosts: (category?: string) => void
  onAddComment: (postId: string, content: string) => void
  onToggleCollect: (postId: string) => void
}

export default function PostDetail({
  post,
  posts,
  categories,
  comments,
  currentUser,
  isCollected,
  onBack,
  onViewProfile,
  onGoToPosts,
  onAddComment,
  onToggleCollect,
}: PostDetailProps) {
  const [draft, setDraft] = useState('')
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null)

  const pinnedPosts = useMemo(() => posts.filter(p => p.pinned).slice(0, 5), [posts])

  const handleComment = () => {
    const content = draft.trim()
    if (!content) return
    onAddComment(post.id, content)
    setDraft('')
  }

  return (
    <div className="content-row">
      <section className="post-detail-center">
        <button className="post-back-btn" onClick={onBack}>
          <IconChevronLeft /> 返回
        </button>

        <article className="post-detail-card">
          <div className="post-detail-meta">
            <span
              className="item-tag"
              onClick={() => onGoToPosts(post.category)}
            >{post.category}</span>
            {post.pinned && <span className="item-tag pin-tag">置顶</span>}
            <span className="post-detail-date">{post.date}</span>
          </div>

          <h1 className="post-detail-title">{post.title}</h1>
          <div className="post-detail-body">{post.content || post.summary}</div>

          {post.attachments && post.attachments.length > 0 && (
            <div className="post-attachments">
              <div className="post-attachments-head">
                <IconPaperclip />
                <span>附件 {post.attachments.length} 个 · 已存入仓库</span>
              </div>
              {post.attachments.map(a => (
                <div key={a.id} className="post-attachment-item">
                  <span className="post-attachment-icon"><IconFile /></span>
                  <button
                    className="post-attachment-name post-attachment-preview-link"
                    onClick={() => setPreviewFile(a)}
                    title={`在线预览 ${a.name}`}
                  >
                    {a.name}
                  </button>
                  <span className="post-attachment-size">{formatFileSize(a.size)}</span>
                  <button
                    className="post-attachment-download"
                    onClick={() => setPreviewFile(a)}
                    aria-label={`预览 ${a.name}`}
                  >
                    <IconEye /> 查看
                  </button>
                  <button
                    className="post-attachment-download"
                    onClick={() => downloadAttachment(a.id, a.name)}
                    aria-label={`下载 ${a.name}`}
                  >
                    <IconDownload /> 下载
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="post-detail-actions">
            <span
              className="post-detail-author"
              onClick={() => post.authorId && onViewProfile(post.authorId)}
            >{post.author}</span>
            <span className="stat-item"><IconEye /> {post.views}</span>
            <span className="stat-item"><IconMessage /> {comments.length}</span>
            <button
              className={`post-collect-btn ${isCollected ? 'active' : ''}`}
              onClick={() => onToggleCollect(post.id)}
              aria-label={isCollected ? '取消收藏' : '收藏帖子'}
            >
              <IconBookmark /> {isCollected ? '已收藏' : '收藏'}
            </button>
          </div>
        </article>

        <div className="post-comments">
          <div className="profile-section-head">
            <IconMessage />
            <h2>评论 {comments.length}</h2>
            <span className="accent-dot" />
          </div>

          <div className="post-comment-list">
            {comments.map(c => (
              <div key={c.id} className="post-comment">
                <div className="post-comment-author">
                  {c.author}
                  <span className="post-comment-date">{c.date}</span>
                </div>
                <div className="post-comment-content">{c.content}</div>
              </div>
            ))}
            {comments.length === 0 && (
              <div className="post-empty">暂无评论，来发表第一条吧</div>
            )}
          </div>

          {currentUser ? (
            <div className="post-comment-input-bar">
              <input
                type="text"
                className="messages-input"
                placeholder="发表评论…"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleComment()}
              />
              <button
                className="messages-send-btn"
                onClick={handleComment}
                aria-label="发表评论"
              >
                <IconMessage />
              </button>
            </div>
          ) : (
            <div className="post-comment-login-hint">登录后即可发表评论</div>
          )}
        </div>
      </section>

      <aside className="right-modules">
        <section className="module-card" aria-label="新闻">
          <div className="module-head">
            <IconNewspaper />
            <h2>新闻</h2>
            <span className="accent-dot" />
          </div>
          <div className="module-body">
            {pinnedPosts.map(p => (
              <article key={p.id} className="item" onClick={() => onGoToPosts(p.category)}>
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
                className="item category-item"
                onClick={() => onGoToPosts(c.name)}
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

      {previewFile && (
        <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  )
}
