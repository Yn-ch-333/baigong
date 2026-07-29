import { useEffect, useMemo, useRef, useState } from 'react'
import type { User, Message } from '../types'
import {
  IconMail, IconPlus, IconUser, IconSparkles,
} from '../icons'
import './Messages.css'

interface MessagesProps {
  currentUser: User | null
  users: User[]
  messages: Message[]
  initialTargetId?: string
  onSend: (receiverId: string, content: string) => void
  onMarkRead: (messageId: string) => void
}

const IconSend = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
)

export default function Messages({
  currentUser,
  users,
  messages,
  initialTargetId,
  onSend,
  onMarkRead,
}: MessagesProps) {
  const [selectedId, setSelectedId] = useState<string>(initialTargetId || '')
  const [draft, setDraft] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [newTargetId, setNewTargetId] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const self = currentUser || { id: 'guest', name: '访客', avatar: '客' }

  // Contacts = users that have exchanged messages with current user
  const contacts = useMemo(() => {
    const ids = new Set<string>()
    messages.forEach(m => {
      if (m.senderId === self.id) ids.add(m.receiverId)
      if (m.receiverId === self.id) ids.add(m.senderId)
    })
    // Ensure initial target and selected users are included
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

  useEffect(() => {
    thread.forEach(m => {
      if (m.receiverId === self.id && !m.read) onMarkRead(m.id)
    })
  }, [thread, self.id, onMarkRead])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread])

  const handleSend = () => {
    const content = draft.trim()
    if (!content || !selectedUser) return
    onSend(selectedUser.id, content)
    setDraft('')
  }

  const handleNew = () => {
    if (!newTargetId) return
    setSelectedId(newTargetId)
    setNewTargetId('')
    setNewOpen(false)
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
            const unread = messages.filter(m => m.senderId === u.id && m.receiverId === self.id && !m.read).length
            return (
              <button
                key={u.id}
                className={`messages-contact ${selectedUser?.id === u.id ? 'active' : ''}`}
                onClick={() => setSelectedId(u.id)}
              >
                <span className="messages-contact-avatar">{u.avatar}</span>
                <span className="messages-contact-name">{u.name}</span>
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
              <span className="messages-chat-avatar">{selectedUser.avatar}</span>
              <div className="messages-chat-info">
                <span className="messages-chat-name">{selectedUser.name}</span>
                <span className="messages-chat-bio">{selectedUser.bio || '暂无简介'}</span>
              </div>
            </div>

            <div className="messages-bubble-list">
              {thread.map(m => {
                const isSelf = m.senderId === self.id
                return (
                  <div key={m.id} className={`messages-bubble ${isSelf ? 'self' : ''}`}>
                    <div className="messages-bubble-content">{m.content}</div>
                    <div className="messages-bubble-meta">
                      {isSelf ? '我' : m.senderName} · {m.date}
                    </div>
                  </div>
                )
              })}
              {thread.length === 0 && (
                <div className="messages-empty-thread">暂无消息，发送第一条私信吧</div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="messages-input-bar">
              <input
                type="text"
                className="messages-input"
                placeholder={`给 ${selectedUser.name} 发消息…`}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
              />
              <button className="messages-send-btn" onClick={handleSend} aria-label="发送">
                <IconSend />
              </button>
            </div>
          </>
        ) : (
          <div className="messages-empty-state">
            <IconUser />
            <p>选择一位用户开始对话</p>
          </div>
        )}
      </section>

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
