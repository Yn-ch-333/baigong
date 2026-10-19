import { useMemo, useState } from 'react'
import type { User, WarehouseItem, Post } from '../types'
import { downloadAttachment, formatFileSize } from '../fileStore'
import {
  IconWarehouse, IconFilter, IconPlus, IconClose,
  IconFile, IconDownload,
} from '../icons'
import './Warehouse.css'

interface WarehouseProps {
  currentUser: User | null
  items: WarehouseItem[]
  users: User[]
  posts: Post[]
  onAdd: (item: WarehouseItem) => void
  onDelete: (itemId: string) => void
  onViewPost: (postId: string) => void
  onDeleteAttachment: (postId: string, fileId: string) => void
}

const IconTrash = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
)

const statusMap: Record<WarehouseItem['status'], string> = {
  normal: '正常',
  low: '库存不足',
  out: '已耗尽',
}

interface FileRecord {
  id: string
  name: string
  size: number
  type: string
  postId: string
  postTitle: string
  uploader: string
  date: string
}

export default function Warehouse({
  currentUser,
  items,
  users: _users,
  posts,
  onAdd,
  onDelete,
  onViewPost,
  onDeleteAttachment,
}: WarehouseProps) {
  const [search, setSearch] = useState('')
  const [fileSearch, setFileSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [tab, setTab] = useState<'files' | 'items'>('files')

  const allFiles = useMemo<FileRecord[]>(() => (
    posts.flatMap(p =>
      (p.attachments || []).map(a => ({
        ...a,
        postId: p.id,
        postTitle: p.title,
        uploader: p.author,
        date: p.date,
      }))
    )
  ), [posts])

  const totalFileSize = useMemo(
    () => allFiles.reduce((sum, f) => sum + f.size, 0),
    [allFiles]
  )

  const filteredFiles = useMemo(() => {
    const q = fileSearch.trim()
    if (!q) return allFiles
    return allFiles.filter(f =>
      f.name.toLowerCase().includes(q.toLowerCase()) ||
      f.postTitle.includes(q) || f.uploader.includes(q)
    )
  }, [allFiles, fileSearch])

  const filteredItems = useMemo(() => {
    return items.filter(i =>
      i.name.includes(search) || i.category.includes(search) || i.location.includes(search)
    )
  }, [items, search])

  const stats = useMemo(() => ({
    total: items.length,
    normal: items.filter(i => i.status === 'normal').length,
    low: items.filter(i => i.status === 'low').length,
    out: items.filter(i => i.status === 'out').length,
  }), [items])

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget as HTMLFormElement)
    const name = String(fd.get('name') || '').trim()
    const category = String(fd.get('category') || '').trim()
    const quantity = Number(fd.get('quantity') || 0)
    const unit = String(fd.get('unit') || '个')
    const location = String(fd.get('location') || '').trim()
    if (!name || !category || !location) return
    const status: WarehouseItem['status'] = quantity <= 0 ? 'out' : quantity <= 5 ? 'low' : 'normal'
    onAdd({
      id: `w${Date.now()}`,
      name,
      category,
      quantity,
      unit,
      location,
      updatedAt: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
      ownerId: currentUser?.id,
      ownerName: currentUser?.name,
      status,
    })
    setAddOpen(false)
  }

  return (
    <div className="content-row">
      <section className="warehouse-center">
        <div className="warehouse-header-bar">
          <h1 className="warehouse-page-title">
            <IconWarehouse />
            工业仓库
          </h1>
          <button className="warehouse-add-btn" onClick={() => setAddOpen(true)}>
            <IconPlus /> 入库登记
          </button>
        </div>

        <div className="warehouse-tabs">
          <button
            className={`warehouse-tab ${tab === 'files' ? 'active' : ''}`}
            onClick={() => setTab('files')}
          >
            <IconFile /> 文件档案
            <span className="chip-count">{allFiles.length}</span>
          </button>
          <button
            className={`warehouse-tab ${tab === 'items' ? 'active' : ''}`}
            onClick={() => setTab('items')}
          >
            <IconWarehouse /> 物料台账
            <span className="chip-count">{stats.total}</span>
          </button>
        </div>

        {tab === 'files' && (
          <>
            <div className="warehouse-file-stats">
              <div className="warehouse-stat">
                <span className="warehouse-stat-value">{allFiles.length}</span>
                <span className="warehouse-stat-label">文件总数</span>
              </div>
              <div className="warehouse-stat">
                <span className="warehouse-stat-value">{formatFileSize(totalFileSize)}</span>
                <span className="warehouse-stat-label">占用空间</span>
              </div>
            </div>

            <div className="search-wrap">
              <input
                type="text"
                className="search-input"
                placeholder="检索文件名 / 来源帖子 / 上传者"
                aria-label="搜索文件"
                value={fileSearch}
                onChange={e => setFileSearch(e.target.value)}
              />
              <span className="search-icon"><IconFilter /></span>
            </div>

            <div className="warehouse-table-wrap">
              <table className="warehouse-table">
                <thead>
                  <tr>
                    <th>文件名</th>
                    <th>大小</th>
                    <th>来源帖子</th>
                    <th>上传者</th>
                    <th>上传日期</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map(f => (
                    <tr key={f.id}>
                      <td className="warehouse-name">
                        <span className="warehouse-file-cell">
                          <IconFile />
                          {f.name}
                        </span>
                      </td>
                      <td>{formatFileSize(f.size)}</td>
                      <td>
                        <button
                          className="warehouse-post-link"
                          onClick={() => onViewPost(f.postId)}
                          title={f.postTitle}
                        >
                          {f.postTitle}
                        </button>
                      </td>
                      <td>{f.uploader}</td>
                      <td>{f.date}</td>
                      <td>
                        <div className="warehouse-file-actions">
                          <button
                            className="warehouse-file-btn"
                            onClick={() => downloadAttachment(f.id, f.name)}
                            aria-label={`下载 ${f.name}`}
                            title="下载"
                          >
                            <IconDownload />
                          </button>
                          <button
                            className="warehouse-delete-btn"
                            onClick={() => onDeleteAttachment(f.postId, f.id)}
                            aria-label={`删除 ${f.name}`}
                            title="删除"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredFiles.length === 0 && (
                <div className="warehouse-empty">
                  {allFiles.length === 0 ? '暂无文件，发帖时添加附件即可存入仓库' : '未找到匹配的文件'}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'items' && (
          <>
            <div className="warehouse-stats">
              <div className="warehouse-stat">
                <span className="warehouse-stat-value">{stats.total}</span>
                <span className="warehouse-stat-label">总条目</span>
              </div>
              <div className="warehouse-stat normal">
                <span className="warehouse-stat-value">{stats.normal}</span>
                <span className="warehouse-stat-label">库存正常</span>
              </div>
              <div className="warehouse-stat low">
                <span className="warehouse-stat-value">{stats.low}</span>
                <span className="warehouse-stat-label">库存不足</span>
              </div>
              <div className="warehouse-stat out">
                <span className="warehouse-stat-value">{stats.out}</span>
                <span className="warehouse-stat-label">已耗尽</span>
              </div>
            </div>

            <div className="search-wrap">
              <input
                type="text"
                className="search-input"
                placeholder="检索物料名称 / 分类 / 库位"
                aria-label="搜索仓库"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <span className="search-icon"><IconFilter /></span>
            </div>

            <div className="warehouse-table-wrap">
              <table className="warehouse-table">
                <thead>
                  <tr>
                    <th>物料名称</th>
                    <th>分类</th>
                    <th>数量</th>
                    <th>库位</th>
                    <th>状态</th>
                    <th>负责人</th>
                    <th>更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => (
                    <tr key={item.id}>
                      <td className="warehouse-name">{item.name}</td>
                      <td><span className="item-tag">{item.category}</span></td>
                      <td>{item.quantity} {item.unit}</td>
                      <td>{item.location}</td>
                      <td>
                        <span className={`warehouse-status ${item.status}`}>
                          {statusMap[item.status]}
                        </span>
                      </td>
                      <td>{item.ownerName || '-'}</td>
                      <td>{item.updatedAt}</td>
                      <td>
                        <button className="warehouse-delete-btn" onClick={() => onDelete(item.id)}>
                          <IconTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredItems.length === 0 && (
                <div className="warehouse-empty">未找到匹配的物料</div>
              )}
            </div>
          </>
        )}
      </section>

      <aside className="right-modules">
        <section className="module-card" aria-label="仓库说明">
          <div className="module-head">
            <IconWarehouse />
            <h2>仓库说明</h2>
            <span className="accent-dot" />
          </div>
          <div className="module-body">
            <div className="warehouse-hint">
              <p>文件档案：发帖时上传的附件统一存放在这里，可随时下载或删除。</p>
              <p>物料台账：管理论坛成员共享的工业设备、元器件与耗材。</p>
              <p>数量 ≤ 0 标记为“已耗尽”，≤ 5 标记为“库存不足”。</p>
            </div>
          </div>
        </section>
      </aside>

      {addOpen && (
        <div className="modal-overlay" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>入库登记</h3>
              <button className="modal-close" onClick={() => setAddOpen(false)} aria-label="关闭"><IconClose /></button>
            </div>
            <form onSubmit={handleAdd}>
              <label className="field-label">
                物料名称
                <input name="name" className="field-input" placeholder="例如：SIMATIC S7-1500" required />
              </label>
              <label className="field-label">
                分类
                <input name="category" className="field-input" placeholder="例如：PLC" required />
              </label>
              <div className="warehouse-form-row">
                <label className="field-label">
                  数量
                  <input name="quantity" type="number" min="0" className="field-input" defaultValue="0" required />
                </label>
                <label className="field-label">
                  单位
                  <input name="unit" className="field-input" placeholder="台 / 套 / 卷" defaultValue="个" required />
                </label>
              </div>
              <label className="field-label">
                存放库位
                <input name="location" className="field-input" placeholder="例如：A-03-02" required />
              </label>
              <button type="submit" className="btn-primary">登记入库</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
