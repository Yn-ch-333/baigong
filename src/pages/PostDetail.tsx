import { useMemo, useState } from 'react'
import type { Post, Category, Comment, User, Attachment } from '../types'
import { downloadAttachment, formatFileSize, fileUrl, getPreviewKind } from '../fileStore'
import FilePreview from '../components/FilePreview'
import {
  IconChevronLeft, IconMessage, IconEye, IconBookmark,
  IconNewspaper, IconCode, IconPaperclip, IconDownload, IconFile,
  IconClose,
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
  onAddComment: (postId: string, content: string, parentId?: string) => void
  onDeleteComment: (commentId: string) => Promise<void>
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
  onDeleteComment,
  onToggleCollect,
}: PostDetailProps) {
  const [draft, setDraft] = useState('')
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null)
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null)

  const pinnedPosts = useMemo(() => posts.filter(p => p.pinned).slice(0, 5), [posts])

  const attachments = post.attachments || []
  const imageAttachments = attachments.filter(a => getPreviewKind(a.name, a.type) === 'image')
  const videoAttachments = attachments.filter(a => getPreviewKind(a.name, a.type) === 'video')
  const fileAttachments = attachments.filter(a => {
    const kind = getPreviewKind(a.name, a.type)
    return kind !== 'image' && kind !== 'video'
  })

  const commentMap = useMemo(() => {
    const m = new Map<string, Comment>()
    comments.forEach(c => m.set(c.id, c))
    return m
  }, [comments])

  const childrenMap = useMemo(() => {
    const m = new Map<string, Comment[]>()
    comments.forEach(c => {
      if (c.parentId && commentMap.has(c.parentId)) {
        const list = m.get(c.parentId) || []
        list.push(c)
        m.set(c.parentId, list)
      }
    })
    return m
  }, [comments, commentMap])

  const rootComments = comments.filter(c => !c.parentId || !commentMap.has(c.parentId))

  const handleDeleteComment = async (c: Comment) => {
    if (!window.confirm('确定删除这条评论及其所有回复吗？')) return
    const ids = new Set<string>()
    const collect = (id: string) => {
      ids.add(id)
      ;(childrenMap.get(id) || []).forEach(ch => collect(ch.id))
    }
    collect(c.id)
    if (replyTarget && ids.has(replyTarget.id)) setReplyTarget(null)
    try {
      await onDeleteComment(c.id)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '删除评论失败')
    }
  }

  const renderComment = (c: Comment, depth: number) => {
    const children = childrenMap.get(c.id) || []
    const parentAuthor = c.parentId ? commentMap.get(c.parentId)?.author : undefined
    return (
      <div key={c.id} className={`post-comment ${depth > 0 ? 'is-reply' : ''}`}>
        <div className="post-comment-head">
          <span className="post-comment-avatar">{c.author.slice(0, 1)}</span>
          <span className="post-comment-author-name">{c.author}</span>
          {parentAuthor && <span className="post-comment-reply-to">回复 @{parentAuthor}</span>}
          <span className="post-comment-date">{c.date}</span>
          {currentUser && (
            <button
              className="post-comment-reply-btn"
              onClick={() => setReplyTarget(c)}
            >回复</button>
          )}
          {currentUser && (currentUser.role === 'admin' || c.authorId === currentUser.id) && (
            <button
              className="post-comment-delete-btn"
              onClick={() => handleDeleteComment(c)}
            >删除</button>
          )}
        </div>
        <div className="post-comment-content">{c.content}</div>
        {children.length > 0 && (
          <div className="post-comment-replies">
            {children.map(ch => renderComment(ch, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const handleComment = () => {
    const content = draft.trim()
    if (!content) return
    onAddComment(post.id, content, replyTarget?.id)
    setDraft('')
    setReplyTarget(null)
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

          {videoAttachments.length > 0 && (
            <div className="post-media-block">
              {videoAttachments.map(v => (
                <video
                  key={v.id}
                  className="post-media-video"
                  src={fileUrl(v.id)}
                  controls
                  preload="metadata"
                  playsInline
                />
              ))}
            </div>
          )}

          {imageAttachments.length > 0 && (
            <div className="post-media-block">
              <div className={`post-media-grid ${imageAttachments.length === 1 ? 'single' : ''}`}>
                {imageAttachments.map(a => (
                  <button
                    key={a.id}
                    className={`post-media-item ${imageAttachments.length === 1 ? 'single' : ''}`}
                    onClick={() => setPreviewFile(a)}
                    aria-label={`查看图片 ${a.name}`}
                  >
                    <img src={fileUrl(a.id)} alt={a.name} loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {fileAttachments.length > 0 && (
            <div className="post-attachments">
              <div className="post-attachments-head">
                <IconPaperclip />
                <span>附件 {fileAttachments.length} 个 · 已存入仓库</span>
              </div>
              {fileAttachments.map(a => (
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
            {rootComments.map(c => renderComment(c, 0))}
            {comments.length === 0 && (
              <div className="post-empty">暂无评论，来发表第一条吧</div>
            )}
          </div>

          {replyTarget && (
            <div className="post-comment-reply-banner">
              <span>正在回复 <b>@{replyTarget.author}</b></span>
              <button
                className="post-comment-reply-cancel"
                onClick={() => setReplyTarget(null)}
                aria-label="取消回复"
              ><IconClose /> 取消</button>
            </div>
          )}

          {currentUser ? (
            <div className="post-comment-input-bar">
              <input
                type="text"
                className="messages-input"
                placeholder={replyTarget ? `回复 @${replyTarget.author}…` : '发表评论…'}
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
