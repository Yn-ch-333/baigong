import { useRef, useState, useEffect, useCallback } from 'react'
import { IconClose } from '../icons'
import type { RadioTrack, User } from '../types'
import { fetchTracks, uploadTrack, deleteTrack } from '../api'
import './MusicPlayer.css'

interface MusicPlayerProps {
  user: User | null
}

const MAX_FILE_SIZE = 20 * 1024 * 1024

export default function MusicPlayer({ user }: MusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [tracks, setTracks] = useState<RadioTrack[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const current = tracks[currentIndex]
  const currentSrc = current ? `/api/tracks/${current.id}/audio` : undefined

  const loadTracks = useCallback(async () => {
    try {
      const { tracks: list } = await fetchTracks()
      setTracks(list)
      setCurrentIndex(i => (list.length ? Math.min(i, list.length - 1) : 0))
    } catch {
      setError('曲目加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // 首次加载；展开面板时刷新，确保能听到别人新上传的曲目
  useEffect(() => {
    loadTracks()
  }, [loadTracks])

  useEffect(() => {
    if (expanded) loadTracks()
  }, [expanded, loadTracks])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !current) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setError('无法播放'))
    }
  }, [isPlaying, current])

  const playTrack = useCallback((index: number) => {
    if (!tracks[index]) return
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
    }, 80)
  }, [tracks])

  const handleNext = useCallback(() => {
    if (!tracks.length) return
    playTrack((currentIndex + 1) % tracks.length)
  }, [currentIndex, tracks.length, playTrack])

  const handlePrev = useCallback(() => {
    if (!tracks.length) return
    playTrack((currentIndex - 1 + tracks.length) % tracks.length)
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

  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      setError('仅支持音频文件')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('音频不能超过 20MB')
      return
    }
    try {
      setUploading(true)
      setError('')
      const { track } = await uploadTrack(file)
      const { tracks: list } = await fetchTracks()
      setTracks(list)
      const index = list.findIndex(t => t.id === track.id)
      setCurrentIndex(index >= 0 ? index : 0)
      setIsPlaying(true)
      setTimeout(() => {
        audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => {
          setIsPlaying(false)
          setError('无法播放该曲目')
        })
      }, 80)
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }, [])

  const removeTrack = useCallback(async (index: number) => {
    const track = tracks[index]
    if (!track) return
    if (!window.confirm(`确定删除「${track.title}」吗？`)) return
    try {
      await deleteTrack(track.id)
      const { tracks: list } = await fetchTracks()
      setTracks(list)
      if (index === currentIndex) {
        audioRef.current?.pause()
        setIsPlaying(false)
        setCurrentIndex(0)
        setProgress(0)
        setCurrentTime(0)
        setDuration(0)
      } else if (index < currentIndex) {
        setCurrentIndex(i => i - 1)
      }
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }, [tracks, currentIndex])

  const formatTime = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const canDelete = (track: RadioTrack) =>
    !!user && (track.uploaderId === user.id || user.role === 'admin')

  return (
    <div className={`music-player ${expanded ? 'expanded' : ''}`}>
      <audio
        ref={audioRef}
        src={currentSrc}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMeta}
        onEnded={handleNext}
        onError={() => {
          if (currentSrc) setError('音频加载失败')
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
            {user && (
              <button
                className="music-import-btn"
                onClick={() => fileInputRef.current?.click()}
                title="上传音乐（音频 ≤ 20MB）"
                disabled={uploading}
              >
                {uploading ? '…' : '+'}
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
              <div className="music-track-name">{current?.title || '暂无曲目'}</div>
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
            <button className="music-control-btn" onClick={handlePrev} aria-label="上一首" disabled={!current}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></svg>
            </button>
            <button className="music-play-btn" onClick={togglePlay} aria-label={isPlaying ? '暂停' : '播放'} disabled={!current}>
              {isPlaying ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <button className="music-control-btn" onClick={handleNext} aria-label="下一首" disabled={!current}>
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
                <span className="music-list-name">
                  {t.title}
                  {t.artist && <span className="music-list-artist"> · {t.artist}</span>}
                </span>
                {canDelete(t) && (
                  <button
                    className="music-remove"
                    onClick={e => { e.stopPropagation(); removeTrack(i) }}
                    aria-label={`删除 ${t.title}`}
                  >
                    <IconClose />
                  </button>
                )}
              </div>
            ))}
            {!loading && tracks.length === 0 && (
              <div className="music-empty">
                暂无曲目{user ? '，点击 + 上传第一首' : '，登录后可上传'}
              </div>
            )}
            {loading && <div className="music-empty">加载中…</div>}
          </div>
        </div>
      )}
    </div>
  )
}
