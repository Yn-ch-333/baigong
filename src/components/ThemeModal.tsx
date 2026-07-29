import ThemePanel from './ThemePanel'
import { IconClose, IconPalette } from '../icons'
import type { ThemeColors } from '../types'

interface ThemeModalProps {
  theme: ThemeColors
  onChange: (theme: ThemeColors) => void
  onReset: () => void
  onClose: () => void
}

export default function ThemeModal({ theme, onChange, onReset, onClose }: ThemeModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal theme-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconPalette /> 主题配色
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            <IconClose />
          </button>
        </div>
        <ThemePanel theme={theme} onChange={onChange} onReset={onReset} />
      </div>
    </div>
  )
}
