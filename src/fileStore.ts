export async function getFile(id: string): Promise<Blob | null> {
  const res = await fetch(`/api/files/${id}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`文件加载失败（${res.status}）`)
  return res.blob()
}

export function downloadAttachment(id: string, name: string): void {
  const a = document.createElement('a')
  a.href = `/api/files/${id}?download=1`
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export type PreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'none'

const TEXT_EXT = /\.(txt|md|json|js|ts|tsx|jsx|css|html|xml|csv|log|yml|yaml|ini|conf?|sh|py|c|cpp|h|java|sql)$/i

export function getPreviewKind(name: string, type: string): PreviewKind {
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('audio/')) return 'audio'
  if (type === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf'
  if (type.startsWith('text/') || TEXT_EXT.test(name)) return 'text'
  return 'none'
}
