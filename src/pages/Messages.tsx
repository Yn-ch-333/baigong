import { useEffect, useMemo, useRef, useState } from 'react'
import type { User, Message, Attachment } from '../types'
import {
  IconMail, IconPlus, IconUser, IconSparkles, IconClose,
  IconPaperclip, IconEye, IconDownload, IconFile,
} from '../icons'
import {
  avatarUrl, avatarInitial, fileUrl, formatFileSize, getPreviewKind, downloadAttachment,
} from '../fileStore'
import * as api from '../api'
import FilePreview from '../components/FilePreview'
import './Messages.css'

interface MessagesProps {
  currentUser: User | null
  users: User[]
  messages: Message[]
  initialTargetId?: string
  onSend: (receiverId: string, content: string, fileId?: string) => void
  onMarkRead: (messageId: string) => void
  onRecall: (messageId: string) => Promise<void>
}

const IconSend = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
)

// 小螺母标识
const IconNut = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 20.6 7 20.6 17 12 22 3.4 17 3.4 7" />
    <circle cx="12" cy="12" r="4.2" />
  </svg>
)

const pad2 = (n: number) => String(n).padStart(2, '0')

// 私信撤回时限：发送后 3 分钟内
const RECALL_WINDOW_MS = 3 * 60 * 1000

// "YYYY.MM.DD HH:mm"（北京时间）-> 毫秒时间戳
function dateTimeToMs(value: string): number {
  const m = /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2})$/.exec(value || '')
  if (!m) return 0
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - 8 * 3600e3
}

function canRecall(m: Message): boolean {
  const sentAt = dateTimeToMs(m.date)
  return !!sentAt && Date.now() - sentAt <= RECALL_WINDOW_MS
}

function dayKeyFromMs(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}.${pad2(d.getUTCMonth() + 1)}.${pad2(d.getUTCDate())}`
}

// 连续聊天天数：以北京时间“今天”为基准，中断一天即归零
function calcStreak(list: Message[]): number {
  const days = new Set(list.map(m => m.date.slice(0, 10)).filter(Boolean))
  if (days.size === 0) return 0
  const now = new Date(Date.now() + 8 * 3600e3)
  let cursor = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  if (!days.has(dayKeyFromMs(cursor))) cursor -= 86400000
  if (!days.has(dayKeyFromMs(cursor))) return 0
  let n = 0
  while (days.has(dayKeyFromMs(cursor))) {
    n += 1
    cursor -= 86400000
  }
  return n
}

function Avatar({ user, className }: { user: User; className: string }) {
  const src = avatarUrl(user.avatar)
  return (
    <span className={className}>
      {src
        ? <img className="messages-avatar-img" src={src} alt={user.name} />
        : (avatarInitial(user.avatar, user.name) || '?')}
    </span>
  )
}

export default function Messages({
  currentUser,
  users,
  messages,
  initialTargetId,
  onSend,
  onMarkRead,
  onRecall,
}: MessagesProps) {
  const [selectedId, setSelectedId] = useState<string>(initialTargetId || '')
  const [draft, setDraft] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [newTargetId, setNewTargetId] = useState('')
  const [pendingFile, setPendingFile] = useState<Attachment | null>(null)
  const [uploading, setUploading] = useState(false)
  const [fileError, setFileError] = useState('')
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null)
  const [notifyPermission, setNotifyPermission] = useState<string>(() => (
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  ))
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const self = currentUser || { id: 'guest', name: '访客', avatar: '客' }

  // Contacts = users that have exchanged messages with current user
  const contacts = useMemo(() => {
    const ids = new Set<string>()
    messages.forEach(m => {
      if (m.senderId === self.id) ids.add(m.receiverId)
      if (m.receiverId === self.id) ids.add(m.senderId)
    })
    if (initialTargetId) ids.add(initialTargetId)
    if (selectedId) ids.add(selectedId)
    return users.filter(u => ids.has(u.id))
  }, [messages, self.id, users, initialTargetId, selectedId])

  const selectedUser = useMemo(() => {
    return users.find(u => u.id === selectedId) || contacts[0]
  }, [users, selectedId, contacts])

  const thread = useMemo(() => {
    if (!selectedUser) return []
    return messages
      .filter(m =>
        (m.senderId === self.id && m.receiverId === selectedUser.id) ||
        (m.senderId === selectedUser.id && m.receiverId === self.id)
      )
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [messages, selectedUser, self.id])

  const streak = useMemo(() => calcStreak(thread), [thread])

  const streakFor = (userId: string) => calcStreak(messages.filter(m =>
    (m.senderId === self.id && m.receiverId === userId) ||
    (m.senderId === userId && m.receiverId === self.id)
  ))

  useEffect(() => {
    thread.forEach(m => {
      if (m.receiverId === self.id && !m.read && !m.recalled) onMarkRead(m.id)
    })
  }, [thread, self.id, onMarkRead])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread])

  const handleSend = () => {
    const content = draft.trim()
    if (!selectedUser || uploading) return
    if (!content && !pendingFile) return
    onSend(selectedUser.id, content, pendingFile?.id)
    setDraft('')
    setPendingFile(null)
    setFileError('')
  }

  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setFileError('')
    setUploading(true)
    try {
      const uploaded = await api.uploadFile(file)
      setPendingFile(uploaded)
    } catch (err) {
      setFileError(err instanceof Error ? err.message : '附件上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleRecall = async (m: Message) => {
    if (!canRecall(m)) {
      window.alert('发送超过 3 分钟的消息不能撤回')
      return
    }
    if (!window.confirm('撤回这条消息？撤回后双方都只能看到撤回提示。')) return
    try {
      await onRecall(m.id)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '撤回失败')
    }
  }

  const handleNew = () => {
    if (!newTargetId) return
    setSelectedId(newTargetId)
    setNewTargetId('')
    setNewOpen(false)
  }

  const requestNotify = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    Notification.requestPermission().then(p => setNotifyPermission(p)).catch(() => {})
  }

  if (!currentUser) {
    return (
      <div className="messages-center">
        <div className="messages-empty">
          <IconMail />
          <h2>请先登录</h2>
          <p>登录后即可查看和发送私信。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="content-row messages-row">
      <aside className="messages-sidebar">
        <div className="messages-sidebar-head">
          <h2><IconMail /> 私信</h2>
          <div className="messages-head-actions">
            <a
              className="messages-ai-btn"
              href="https://kimi.moonshot.cn/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Kimi AI"
              title="跳转 Kimi 网页版"
            >
              <IconSparkles />
            </a>
            <button className="messages-new-btn" onClick={() => setNewOpen(true)} aria-label="新建私信">
              <IconPlus />
            </button>
          </div>
        </div>
        <div className="messages-contact-list">
          {contacts.map(u => {
            const unread = messages.filter(m => m.senderId === u.id && m.receiverId === self.id && !m.read && !m.recalled).length
            const s = streakFor(u.id)
            return (
              <button
                key={u.id}
                className={`messages-contact ${selectedUser?.id === u.id ? 'active' : ''}`}
                onClick={() => setSelectedId(u.id)}
              >
                <Avatar user={u} className="messages-contact-avatar" />
                <span className="messages-contact-name">{u.name}</span>
                {s >= 3 && (
                  <span className="messages-streak-mini" title={`已连续聊天 ${s} 天`}>
                    <IconNut />
                  </span>
                )}
                {unread > 0 && <span className="messages-unread">{unread}</span>}
              </button>
            )
          })}
          {contacts.length === 0 && (
            <div className="messages-empty-sidebar">暂无联系人</div>
          )}
        </div>
      </aside>

      <section className="messages-main">
        {selectedUser ? (
          <>
            <div className="messages-chat-head">
              <Avatar user={selectedUser} className="messages-chat-avatar" />
              <div className="messages-chat-info">
                <span className="messages-chat-name">{selectedUser.name}</span>
                <span className="messages-chat-bio">{selectedUser.bio || '暂无简介'}</span>
              </div>
              {streak >= 3 && (
                <span className="messages-streak-badge" title={`已连续聊天 ${streak} 天`}>
                  <IconNut /> 连续聊天 {streak} 天
                </span>
              )}
              {notifyPermission === 'default' && (
                <button className="messages-notify-btn" onClick={requestNotify}>开启消息提醒</button>
              )}
            </div>

            <div className="messages-bubble-list">
              {thread.map(m => {
                const isSelf = m.senderId === self.id
                const kind = m.file ? getPreviewKind(m.file.name, m.file.type) : null
                return (
                  <div key={m.id} className={`messages-bubble ${isSelf ? 'self' : ''}`}>
                    {m.recalled ? (
                      <div className="messages-bubble-content messages-recalled">
                        {isSelf ? '你撤回了一条消息' : '对方撤回了一条消息'}
                      </div>
                    ) : (
                      <>
                        {m.file && kind === 'image' && (
                          <button className="messages-image-btn" onClick={() => setPreviewFile(m.file!)}>
                            <img src={fileUrl(m.file.id)} alt={m.file.name} loading="lazy" />
                          </button>
                        )}
                        {m.file && kind === 'video' && (
                          <video
                            className="messages-video"
                            src={fileUrl(m.file.id)}
                            controls
                            preload="metadata"
                            playsInline
                          />
                        )}
                        {m.file && kind !== 'image' && kind !== 'video' && (
                          <div className="messages-file-card">
                            <IconFile />
                            <div className="messages-file-info">
                              <span className="messages-file-name">{m.file.name}</span>
                              <span className="messages-file-size">{formatFileSize(m.file.size)}</span>
                            </div>
                            <button
                              className="messages-file-action"
                              onClick={() => setPreviewFile(m.file!)}
                              aria-label="预览文件"
                            ><IconEye /></button>
                            <button
                              className="messages-file-action"
                              onClick={() => downloadAttachment(m.file!.id, m.file!.name)}
                              aria-label="下载文件"
                            ><IconDownload /></button>
                          </div>
                        )}
                        {m.content && <div className="messages-bubble-content">{m.content}</div>}
                      </>
                    )}
                    <div className="messages-bubble-meta">
                      {isSelf ? '我' : m.senderName} · {m.date}
                      {isSelf && !m.recalled && canRecall(m) && (
                        <button className="messages-recall-btn" onClick={() => handleRecall(m)}>撤回</button>
                      )}
                    </div>
                  </div>
                )
              })}
              {thread.length === 0 && (
                <div className="messages-empty-thread">暂无消息，发送第一条私信吧</div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="messages-composer">
              {pendingFile && (
                <div className="messages-pending-file">
                  <span className="messages-pending-name">{pendingFile.name}</span>
                  <span className="messages-pending-size">{formatFileSize(pendingFile.size)}</span>
                  <button
                    className="messages-pending-remove"
                    onClick={() => setPendingFile(null)}
                    aria-label="移除待发送附件"
                  ><IconClose /></button>
                </div>
              )}
              {fileError && <p className="login-error messages-file-error">{fileError}</p>}
              <div className="messages-input-bar">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="messages-file-input"
                  onChange={handlePickFile}
                  aria-label="选择私信附件"
                />
                <button
                  className="messages-attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  aria-label="添加图片、视频或文件"
                  title="添加图片、视频或文件（不计入仓库）"
                >
                  <IconPaperclip />
                </button>
                <input
                  type="text"
                  className="messages-input"
                  placeholder={uploading ? '附件上传中…' : `给 ${selectedUser.name} 发消息…`}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                />
                <button
                  className="messages-send-btn"
                  onClick={handleSend}
                  disabled={uploading}
                  aria-label="发送"
                >
                  <IconSend />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="messages-empty-state">
            <IconUser />
            <p>选择一位用户开始对话</p>
          </div>
        )}
      </section>

      {previewFile && (
        <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />
      )}

      {newOpen && (
        <div className="modal-overlay" onClick={() => setNewOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>新建私信</h3>
              <button className="modal-close" onClick={() => setNewOpen(false)}>✕</button>
            </div>
            <label className="field-label">
              选择用户
              <select
                className="field-input"
                value={newTargetId}
                onChange={e => setNewTargetId(e.target.value)}
              >
                <option value="">请选择</option>
                {users.filter(u => u.id !== self.id).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </label>
            <button className="btn-primary" onClick={handleNew}>开始对话</button>
          </div>
        </div>
      )}
    </div>
  )
}
