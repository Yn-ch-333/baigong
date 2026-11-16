export async function getFile(id: string): Promise<Blob | null> {
  const res = await fetch(`/api/files/${id}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`文件加载失败（${res.status}）`)
  return res.blob()
}

export function fileUrl(id: string): string {
  return `/api/files/${id}`
}

// 头像可能是单个字符（默认首字），也可能是 file:<id>（上传的图片）
export function avatarUrl(avatar?: string): string | null {
  if (!avatar) return null
  if (avatar.startsWith('file:')) return fileUrl(avatar.slice(5))
  return null
}

export function avatarInitial(avatar?: string, name?: string): string {
  if (avatar && !avatar.startsWith('file:')) return avatar.slice(0, 1)
  return (name || '').slice(0, 1)
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

/** 整文件夹上传时，取文件相对路径中的目录部分（不含文件名） */
export function fileRelativeFolder(file: File): string {
  const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || ''
  const idx = relative.lastIndexOf('/')
  return idx > 0 ? relative.slice(0, idx) : ''
}

/** 顶层文件夹名：folder 可能是 "资料/图纸"，顶层即 "资料" */
export function attachmentTopFolder(a: { folder?: string }): string {
  return (a.folder || '').split('/')[0]
}

/** 文件夹内文件的相对路径，用于展开时展示子目录 */
export function attachmentPath(a: { folder?: string; name: string }, top: string): string {
  const folder = a.folder || ''
  const rest = (folder === top ? '' : folder.startsWith(top) ? folder.slice(top.length) : folder)
    .replace(/^\//, '')
  return rest ? `${rest}/${a.name}` : a.name
}

/** 把附件按顶层文件夹分组，返回文件夹与散落文件 */
export function groupAttachments<T extends { folder?: string }>(list: T[]) {
  const folders: Array<{ name: string; files: T[] }> = []
  const index = new Map<string, number>()
  const loose: T[] = []
  for (const a of list) {
    const top = attachmentTopFolder(a)
    if (!top) {
      loose.push(a)
      continue
    }
    let i = index.get(top)
    if (i === undefined) {
      i = folders.length
      index.set(top, i)
      folders.push({ name: top, files: [] })
    }
    folders[i].files.push(a)
  }
  return { folders, loose }
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
