import { useRef } from 'react'
import type { ThemeColors } from '../types'
import './ThemePanel.css'

interface ThemePanelProps {
  theme: ThemeColors
  onChange: (theme: ThemeColors) => void
  onReset: () => void
}

const labels: Record<keyof Omit<ThemeColors, 'bgImage' | 'bgVideo' | 'overlayImage'>, string> = {
  bg: '背景色',
  bgPanel: '面板色',
  fg: '主文字',
  brass: '黄铜强调',
  green: '工业绿',
  red: '警示红',
}

function removeWhiteBackground(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        resolve(url)
        return
      }
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        // 白色/近白色像素变透明
        if (r > 245 && g > 245 && b > 245) {
          data[i + 3] = 0
        } else if (r > 200 && g > 200 && b > 200) {
          // 过渡区域根据亮度计算透明度
          const max = Math.max(r, g, b)
          data[i + 3] = Math.round(255 * (255 - max) / 55)
        }
      }
      ctx.putImageData(imageData, 0, 0)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}

export default function ThemePanel({ theme, onChange, onReset }: ThemePanelProps) {
  const bgInputRef = useRef<HTMLInputElement>(null)
  const overlayInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const handleChange = (key: keyof ThemeColors, value: string) => {
    onChange({ ...theme, [key]: value })
  }

  const handleFile = async (key: 'bgImage' | 'bgVideo' | 'overlayImage', file?: File | null) => {
    if (!file) return
    let url: string
    if (key === 'overlayImage') {
      url = await removeWhiteBackground(file)
    } else {
      url = URL.createObjectURL(file)
    }
    const next: ThemeColors = { ...theme, [key]: url }
    if (key === 'bgImage') delete next.bgVideo
    if (key === 'bgVideo') delete next.bgImage
    onChange(next)
  }

  const clearMedia = (key: 'bgImage' | 'bgVideo' | 'overlayImage') => {
    const next = { ...theme }
    delete next[key]
    onChange(next)
  }

  return (
    <div className="theme-panel">
      <div className="theme-section">
        <div className="theme-section-title">配色</div>
        <div className="theme-rows">
          {(Object.keys(labels) as (keyof Omit<ThemeColors, 'bgImage' | 'bgVideo' | 'overlayImage'>)[]).map(key => (
            <label key={key} className="theme-row">
              <span className="theme-label">{labels[key]}</span>
              <input
                type="color"
                className="theme-color-input"
                value={theme[key]}
                onChange={e => handleChange(key, e.target.value)}
              />
              <span className="theme-hex">{theme[key]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="theme-section">
        <div className="theme-section-title">背景层（管理员可更换图片或视频）</div>
        <div className="theme-media-row">
          <input
            ref={bgInputRef}
            type="file"
            accept="image/*"
            className="theme-file-input"
            onChange={e => handleFile('bgImage', e.target.files?.[0])}
          />
          <button
            className="theme-media-btn"
            onClick={() => bgInputRef.current?.click()}
          >
            {theme.bgImage ? '更换背景图' : '上传背景图'}
          </button>
          <button
            className="theme-media-btn secondary"
            onClick={() => videoInputRef.current?.click()}
          >
            {theme.bgVideo ? '更换视频' : '上传视频'}
          </button>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="theme-file-input"
            onChange={e => handleFile('bgVideo', e.target.files?.[0])}
          />
          {(theme.bgImage || theme.bgVideo) && (
            <button className="theme-media-btn danger" onClick={() => clearMedia(theme.bgVideo ? 'bgVideo' : 'bgImage')}>
              清除
            </button>
          )}
        </div>
        {(theme.bgImage || theme.bgVideo) && (
          <div className="theme-media-preview">
            {theme.bgVideo ? (
              <video src={theme.bgVideo} muted loop className="theme-preview-media" />
            ) : (
              <img src={theme.bgImage} alt="背景预览" className="theme-preview-media" />
            )}
          </div>
        )}
      </div>

      <div className="theme-section">
        <div className="theme-section-title">中心叠加层（抠去白色区域，管理员可更换）</div>
        <div className="theme-media-row">
          <input
            ref={overlayInputRef}
            type="file"
            accept="image/*"
            className="theme-file-input"
            onChange={e => handleFile('overlayImage', e.target.files?.[0])}
          />
          <button
            className="theme-media-btn"
            onClick={() => overlayInputRef.current?.click()}
          >
            {theme.overlayImage ? '更换叠加图' : '上传叠加图'}
          </button>
          {theme.overlayImage && (
            <button className="theme-media-btn danger" onClick={() => clearMedia('overlayImage')}>
              清除
            </button>
          )}
        </div>
        {theme.overlayImage && (
          <div className="theme-media-preview overlay-preview">
            <img src={theme.overlayImage} alt="叠加层预览" className="theme-preview-media" />
          </div>
        )}
      </div>

      <div className="theme-actions">
        <button className="btn-primary" onClick={onReset}>恢复默认</button>
      </div>
    </div>
  )
}
