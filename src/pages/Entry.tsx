import { useEffect, useState, useCallback } from 'react'
import './Entry.css'

interface EntryProps {
  onEnter: () => void
}

export default function Entry({ onEnter }: EntryProps) {
  const [progress, setProgress] = useState(0)
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    const timers: number[] = []
    const interval = window.setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          window.clearInterval(interval)
          return 100
        }
        return prev + 2
      })
    }, 40)
    timers.push(interval)
    timers.push(window.setTimeout(() => setBooted(true), 2400))
    return () => {
      timers.forEach(t => window.clearInterval(t))
      timers.forEach(t => window.clearTimeout(t))
    }
  }, [])

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter') onEnter()
  }, [onEnter])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return (
    <div className="entry-page">
      <div className="entry-console">
        <div className="entry-brand">
          <span className="entry-brand-cn">百工</span>
          <span className="entry-brand-de">Technikerkreis</span>
          <span className="entry-cursor" />
        </div>

        {!booted ? (
          <div className="entry-boot">
            <div className="entry-log">SYSTEM BOOT SEQUENCE v2.6</div>
            <div className="entry-progress">
              <div className="entry-progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <div className="entry-log">{`加载核心模块... ${progress.toString().padStart(3, '0')}%`}</div>
            <div className="entry-log">{progress > 40 ? '初始化用户会话... OK' : ''}</div>
            <div className="entry-log">{progress > 70 ? '连接工业技术网络... OK' : ''}</div>
            <div className="entry-log">{progress > 90 ? '渲染控制台界面... OK' : ''}</div>
          </div>
        ) : (
          <div className="entry-intro">
            <p className="entry-tagline">工业技术交流论坛</p>
            <ul className="entry-features">
              <li>多板块：技术问答 / 项目展示 / 行业动态 / 招聘求职</li>
              <li>发帖、评论、收藏、私信、仓库管理</li>
              <li>管理员：删帖、封禁、板块管理、主题换色</li>
            </ul>
            <button className="entry-enter-btn" onClick={onEnter}>
              进入论坛
              <span className="entry-enter-hint">按 Enter</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
