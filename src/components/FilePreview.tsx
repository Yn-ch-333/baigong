import { useEffect, useState } from 'react'
import { getFile, getPreviewKind, downloadAttachment } from '../fileStore'
import type { Attachment } from '../types'
import { IconClose, IconDownload } from '../icons'
import './FilePreview.css'

interface FilePreviewProps {
  file: Attachment
  onClose: () => void
}

export default function FilePreview({ file, onClose }: FilePreviewProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const kind = getPreviewKind(file.name, file.type)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    getFile(file.id).then(async blob => {
      if (cancelled) return
      if (!blob) {
        setMissing(true)
        return
      }
      if (kind === 'text') {
        const t = await blob.text()
        if (!cancelled) setText(t)
        return
      }
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }).catch(() => {
      if (!cancelled) setMissing(true)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file.id, kind])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="file-preview-overlay" onClick={onClose}>
      <div className="file-preview-modal" onClick={e => e.stopPropagation()}>
        <div className="file-preview-head">
          <span className="file-preview-name" title={file.name}>{file.name}</span>
          <div className="file-preview-actions">
            <button
              className="file-preview-btn"
              onClick={() => downloadAttachment(file.id, file.name)}
              aria-label={`下载 ${file.name}`}
            >
              <IconDownload /> 下载
            </button>
            <button className="modal-close" onClick={onClose} aria-label="关闭">
              <IconClose />
            </button>
          </div>
        </div>
        <div className="file-preview-body">
          {missing && <p className="file-preview-fallback">文件不存在或已被删除</p>}
          {!missing && kind === 'none' && (
            <p className="file-preview-fallback">该文件类型暂不支持在线预览，请下载后查看</p>
          )}
          {!missing && kind === 'image' && url && (
            <img src={url} alt={file.name} className="file-preview-media" />
          )}
          {!missing && kind === 'video' && url && (
            <video src={url} controls className="file-preview-media" />
          )}
          {!missing && kind === 'audio' && url && (
            <audio src={url} controls className="file-preview-audio" />
          )}
          {!missing && kind === 'pdf' && url && (
            <iframe src={url} title={file.name} className="file-preview-frame" />
          )}
          {!missing && kind === 'text' && text !== null && (
            <pre className="file-preview-text">{text}</pre>
          )}
          {!missing && !url && text === null && kind !== 'none' && (
            <p className="file-preview-fallback">加载中...</p>
          )}
        </div>
      </div>
    </div>
  )
}
