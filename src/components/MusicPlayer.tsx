import { useRef, useState, useEffect, useCallback } from 'react'
import { IconClose } from '../icons'
import './MusicPlayer.css'

export interface Track {
  id: string
  title: string
  artist: string
  src: string
}

interface MusicPlayerProps {
  isAdmin?: boolean
}

const DEFAULT_TRACKS: Track[] = [
  { id: 't1', title: '工厂之声', artist: '工业氛围', src: '' },
  { id: 't2', title: '齿轮律动', artist: '机械节拍', src: '' },
]

export default function MusicPlayer({ isAdmin }: MusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [tracks, setTracks] = useState<Track[]>(() => {
    const saved = localStorage.getItem('baigong-tracks')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return DEFAULT_TRACKS
      }
    }
    return DEFAULT_TRACKS
  })
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState('')

  const current = tracks[currentIndex] || tracks[0]

  useEffect(() => {
    localStorage.setItem('baigong-tracks', JSON.stringify(tracks))
  }, [tracks])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      if (audio.src && audio.src !== window.location.href) {
        audio.play().then(() => setIsPlaying(true)).catch(() => setError('无法播放'))
      }
    }
  }, [isPlaying])

  const playTrack = useCallback((index: number) => {
    setCurrentIndex(index)
    setIsPlaying(true)
    setError('')
    setTimeout(() => {
      const audio = audioRef.current
      if (audio) {
        audio.play().then(() => setIsPlaying(true)).catch(() => {
          setIsPlaying(false)
          setError('无法播放该曲目')
        })
      }
    }, 50)
  }, [])

  const handleNext = useCallback(() => {
    const next = (currentIndex + 1) % tracks.length
    playTrack(next)
  }, [currentIndex, tracks.length, playTrack])

  const handlePrev = useCallback(() => {
    const prev = (currentIndex - 1 + tracks.length) % tracks.length
    playTrack(prev)
  }, [currentIndex, tracks.length, playTrack])

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentTime(audio.currentTime)
    setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0)
  }, [])

  const handleLoadedMeta = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setDuration(audio.duration)
  }, [])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const value = Number(e.target.value)
    const time = (value / 100) * duration
    audio.currentTime = time
    setProgress(value)
  }, [duration])

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      setError('仅支持音频文件')
      return
    }
    const url = URL.createObjectURL(file)
    const title = file.name.replace(/\.[^/.]+$/, '')
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      title,
      artist: '本地导入',
      src: url,
    }
    setTracks(prev => [...prev, newTrack])
    setError('')
    playTrack(tracks.length)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [tracks.length, playTrack])

  const removeTrack = useCallback((index: number) => {
    setTracks(prev => {
      const next = [...prev]
      const removed = next.splice(index, 1)[0]
      if (removed?.src.startsWith('blob:')) {
        URL.revokeObjectURL(removed.src)
      }
      return next
    })
    if (index === currentIndex) {
      setIsPlaying(false)
      setCurrentIndex(0)
    } else if (index < currentIndex) {
      setCurrentIndex(i => i - 1)
    }
  }, [currentIndex])

  const formatTime = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className={`music-player ${expanded ? 'expanded' : ''}`}>
      <audio
        ref={audioRef}
        src={current?.src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMeta}
        onEnded={handleNext}
        onError={() => {
          if (current?.src) setError('音频加载失败')
        }}
      />

      <button
        className="music-toggle"
        onClick={() => setExpanded(v => !v)}
        aria-label={expanded ? '收起播放器' : '展开播放器'}
        title="音乐播放器"
      >
        <span className="music-wave">
          <span />
          <span />
          <span />
        </span>
      </button>

      {expanded && (
        <div className="music-panel">
          <div className="music-head">
            <span className="music-title">工业电台</span>
            {isAdmin && (
              <button
                className="music-import-btn"
                onClick={() => fileInputRef.current?.click()}
                title="导入歌曲"
              >
                +
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="music-file-input"
              onChange={handleFileImport}
            />
          </div>

          <div className="music-info">
            <div className={`music-disc ${isPlaying ? 'spin' : ''}`}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v20" opacity="0.3" />
              </svg>
            </div>
            <div className="music-meta">
              <div className="music-track-name">{current?.title || '无曲目'}</div>
              <div className="music-track-artist">{current?.artist || '-'}</div>
            </div>
          </div>

          <div className="music-progress">
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={progress}
              onChange={handleSeek}
              className="music-seek"
            />
            <div className="music-time">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="music-controls">
            <button className="music-control-btn" onClick={handlePrev} aria-label="上一首">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
            </button>
            <button className="music-play-btn" onClick={togglePlay} aria-label={isPlaying ? '暂停' : '播放'}>
              {isPlaying ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <button className="music-control-btn" onClick={handleNext} aria-label="下一首">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
            </button>
          </div>

          {error && <div className="music-error">{error}</div>}

          <div className="music-list">
            {tracks.map((t, i) => (
              <div
                key={t.id}
                className={`music-list-item ${i === currentIndex ? 'active' : ''}`}
                onClick={() => playTrack(i)}
              >
                <span className="music-list-index">{String(i + 1).padStart(2, '0')}</span>
                <span className="music-list-name">{t.title}</span>
                {isAdmin && tracks.length > 1 && (
                  <button
                    className="music-remove"
                    onClick={e => { e.stopPropagation(); removeTrack(i) }}
                    aria-label="删除"
                  >
                    <IconClose />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
