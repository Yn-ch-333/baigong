import { useEffect, useRef } from 'react'
import type { MapCountryPath } from '../data/worldMapPaths'

export interface GlobeCountry {
  id: string
  mapName: string
  name: string
  lat: number
  lon: number
  hideLabel?: boolean
}

interface GlobeCanvasProps {
  countries: GlobeCountry[]
  paths: MapCountryPath[]
  links: [string, string][]
  selectedId: string | null
  hoverId: string | null
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

const DEG = Math.PI / 180
/** 透视参数：球面 z 方向缩放系数与焦距（以半径 R 为单位） */
const PERSP_K = 0.34
const FOCAL = 3.2
/** A = F / (k·R)，用于透视反解的闭式求根 */
const PERSP_A = FOCAL / PERSP_K
const PERSP_A2 = PERSP_A * PERSP_A
/** 透视相机的可见地平线：z 小于该值的点已转到背面（非简单 z>0） */
const HORIZON_Z = 1 / PERSP_A
/** 标签文本宽度缓存，避免每帧重复 measureText */
const LABEL_WIDTHS = new Map<string, number>()
/** 抽稀阈值（单位向量距离平方，约 0.33°），在保证轮廓清晰的前提下压缩点数 */
const MIN_STEP_SQ = 3.2e-5

interface Ring {
  /** 单位向量 xyz */
  v: Float32Array
  /** 经纬度对 */
  ll: Float32Array
  n: number
}

interface ParsedPaths {
  all: Ring[]
  byName: Map<string, Ring[]>
}

let cacheKey: MapCountryPath[] | null = null
let cached: ParsedPaths | null = null

/* ---------------------------- 路径解析 ---------------------------- */

function parsePaths(paths: MapCountryPath[]): ParsedPaths {
  if (cacheKey === paths && cached) return cached

  const all: Ring[] = []
  const byName = new Map<string, Ring[]>()

  for (const item of paths) {
    const tokens = item.d.match(/[MLZmlz]|-?\d*\.?\d+/g)
    if (!tokens) continue

    const rings: Ring[] = []
    let vbuf: number[] = []
    let lbuf: number[] = []
    let hasPrev = false
    let prevX = 0
    let prevY = 0
    let prevZ = 0
    let cmd: 'M' | 'L' = 'M'
    let rel = false
    let curX = 0
    let curY = 0

    const flush = () => {
      if (vbuf.length >= 9) {
        const ring: Ring = {
          v: new Float32Array(vbuf),
          ll: new Float32Array(lbuf),
          n: vbuf.length / 3,
        }
        rings.push(ring)
        all.push(ring)
      }
      vbuf = []
      lbuf = []
      hasPrev = false
    }

    const pushPoint = (x: number, y: number) => {
      const lon = (x / 1000) * 360 - 180
      const lat = 90 - (y / 500) * 180
      const phi = lat * DEG
      const lam = lon * DEG
      const vx = Math.cos(phi) * Math.sin(lam)
      const vy = Math.sin(phi)
      const vz = Math.cos(phi) * Math.cos(lam)
      if (hasPrev) {
        const dx = vx - prevX
        const dy = vy - prevY
        const dz = vz - prevZ
        if (dx * dx + dy * dy + dz * dz < MIN_STEP_SQ) return
      }
      hasPrev = true
      prevX = vx
      prevY = vy
      prevZ = vz
      vbuf.push(vx, vy, vz)
      lbuf.push(lon, lat)
    }

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]
      if (/^[MLZmlz]$/.test(t)) {
        if (t === 'Z' || t === 'z') {
          flush()
          cmd = 'M'
          rel = false
          continue
        }
        if (t === 'M' || t === 'm') {
          flush()
          cmd = 'M'
        } else {
          cmd = 'L'
        }
        rel = t === t.toLowerCase()
        continue
      }
      const rawX = parseFloat(t)
      const rawY = parseFloat(tokens[i + 1] ?? '0')
      i++
      const x = rel ? curX + rawX : rawX
      const y = rel ? curY + rawY : rawY
      curX = x
      curY = y
      if (cmd === 'M') {
        pushPoint(x, y)
        cmd = 'L'
      } else {
        pushPoint(x, y)
      }
    }
    flush()

    if (rings.length) {
      const bucket = byName.get(item.name) ?? []
      bucket.push(...rings)
      byName.set(item.name, bucket)
    }
  }

  cacheKey = paths
  cached = { all, byName }
  return cached
}

/* ---------------------------- 经纬网 ---------------------------- */

function buildGraticule(): Ring[] {
  const rings: Ring[] = []
  const vec = (lat: number, lon: number) => {
    const phi = lat * DEG
    const lam = lon * DEG
    return [Math.cos(phi) * Math.sin(lam), Math.sin(phi), Math.cos(phi) * Math.cos(lam)] as const
  }
  // 经线
  for (let lon = -180; lon < 180; lon += 30) {
    const v: number[] = []
    const ll: number[] = []
    for (let lat = -90; lat <= 90; lat += 3) {
      const [x, y, z] = vec(lat, lon)
      v.push(x, y, z)
      ll.push(lon, lat)
    }
    rings.push({ v: new Float32Array(v), ll: new Float32Array(ll), n: v.length / 3 })
  }
  // 纬线
  for (let lat = -60; lat <= 60; lat += 30) {
    const v: number[] = []
    const ll: number[] = []
    for (let lon = -180; lon <= 180; lon += 3) {
      const [x, y, z] = vec(lat, lon)
      v.push(x, y, z)
      ll.push(lon, lat)
    }
    rings.push({ v: new Float32Array(v), ll: new Float32Array(ll), n: v.length / 3 })
  }
  return rings
}

const GRATICULE = buildGraticule()

/* ---------------------------- 组件 ---------------------------- */

export default function GlobeCanvas({
  countries,
  paths,
  links,
  selectedId,
  hoverId,
  onSelect,
  onHover,
}: GlobeCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 供动画循环读取的最新 props
  const live = useRef({ countries, links, selectedId, hoverId, onSelect, onHover })
  live.current = { countries, links, selectedId, hoverId, onSelect, onHover }

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const parsed = parsePaths(paths)
    const nodeVec = new Map<string, [number, number, number]>()
    for (const c of countries) {
      const phi = c.lat * DEG
      const lam = c.lon * DEG
      nodeVec.set(c.id, [Math.cos(phi) * Math.sin(lam), Math.sin(phi), Math.cos(phi) * Math.cos(lam)])
    }

    let width = 0
    let height = 0
    let dpr = 1
    let baseR = 1
    let zoom = 1
    let yaw = -105 * DEG
    let pitch = 26 * DEG
    let velYaw = 0
    let velPitch = 0
    let dragging = false
    let moved = false
    let lastPX = 0
    let lastPY = 0
    let raf = 0

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      baseR = Math.min(width * 0.46, height * 0.44)
    }

    const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)

    /* ---------- 投影 ---------- */

    let cosY = 1
    let sinY = 0
    let cosX = 1
    let sinX = 0
    let cx = 0
    let cy = 0
    let R = 1
    /** 透视焦距，随半径缩放 */
    let perspF = 1
    let lastInteract = 0

    const syncCamera = () => {
      cosY = Math.cos(yaw)
      sinY = Math.sin(yaw)
      cosX = Math.cos(pitch)
      sinX = Math.sin(pitch)
      cx = width / 2
      cy = height / 2
      R = baseR * zoom
      perspF = R * 3.2
    }

    /** 返回 [屏幕x, 屏幕y, 是否正面] */
    const project = (vx: number, vy: number, vz: number): [number, number, boolean] => {
      const x1 = vx * cosY + vz * sinY
      const z1 = -vx * sinY + vz * cosY
      const y2 = vy * cosX - z1 * sinX
      const z2 = vy * sinX + z1 * cosX
      const persp = perspF / (perspF - z2 * R * 0.34)
      return [cx + x1 * R * persp, cy - y2 * R * persp, z2 > HORIZON_Z]
    }

    /* ---------- 命中检测 ---------- */

    const inPolygon = (lon: number, lat: number, ll: Float32Array): boolean => {
      let inside = false
      const n = ll.length / 2
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = ll[i * 2]
        const yi = ll[i * 2 + 1]
        const xj = ll[j * 2]
        const yj = ll[j * 2 + 1]
        if (yi > lat !== yj > lat) {
          const t = (lat - yi) / (yj - yi)
          if (lon < xi + t * (xj - xi)) inside = !inside
        }
      }
      return inside
    }

    const hitTest = (mx: number, my: number): string | null => {
      const u = (mx - cx) / R
      const v = -(my - cy) / R
      const q = u * u + v * v
      // 透视下球体轮廓略大于 R：z≈0.1 处的投影半径最大
      const qMax = 1 / (1 - (PERSP_K / FOCAL) ** 2)
      if (q > qMax) return null
      // 透视反解：s = F / (F - P·R·z2)，令 t = 1/s，
      // 由 x1²+y2²+z2²=1 得 (A²+q)t² - 2A²t + (A²-1) = 0，
      // 判别式 A²(1-q)+q；取较小根（离相机最近的正面交点）
      const disc = Math.sqrt(Math.max(0, PERSP_A2 * (1 - q) + q))
      const t = (PERSP_A2 - disc) / (PERSP_A2 + q)
      const z2v = PERSP_A * (1 - t)
      const x1 = u * t
      const y2v = v * t
      const wy = y2v * cosX + z2v * sinX
      const z1 = -y2v * sinX + z2v * cosX
      const wx = x1 * cosY - z1 * sinY
      const wz = x1 * sinY + z1 * cosY
      const lat = Math.asin(clamp(wy, -1, 1)) / DEG
      const lon = Math.atan2(wx, wz) / DEG

      for (const c of live.current.countries) {
        const rings = parsed.byName.get(c.mapName)
        if (!rings) continue
        for (const ring of rings) {
          for (const shift of [0, 360, -360]) {
            if (inPolygon(lon + shift, lat, ring.ll)) return c.id
          }
        }
      }
      // 兜底：靠近节点也算命中
      let best: string | null = null
      let bestD = 15
      for (const c of live.current.countries) {
        const v = nodeVec.get(c.id)
        if (!v) continue
        const [sx, sy, vis] = project(v[0], v[1], v[2])
        if (!vis) continue
        const d = Math.hypot(sx - mx, sy - my)
        if (d < bestD) {
          bestD = d
          best = c.id
        }
      }
      return best
    }

    /* ---------- 绘制 ---------- */

    const drawRings = (
      rings: Ring[],
      front: boolean,
      strokeStyle: string,
      lineWidth: number,
      opts?: { dash?: number[]; fill?: string; glow?: number },
    ) => {
      ctx.save()
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.lineWidth = lineWidth
      ctx.strokeStyle = strokeStyle
      ctx.setLineDash(opts?.dash ?? [])
      if (opts?.glow) {
        ctx.shadowColor = strokeStyle
        ctx.shadowBlur = opts.glow
      }
      for (const ring of rings) {
        ctx.beginPath()
        let pen = false
        let hidden = false
        const v = ring.v
        for (let i = 0; i < ring.n; i++) {
          const [sx, sy, vis] = project(v[i * 3], v[i * 3 + 1], v[i * 3 + 2])
          if (vis !== front) {
            pen = false
            hidden = true
            continue
          }
          if (pen) ctx.lineTo(sx, sy)
          else {
            ctx.moveTo(sx, sy)
            pen = true
          }
        }
        ctx.stroke()
        if (front && !hidden && opts?.fill) {
          ctx.fillStyle = opts.fill
          ctx.fill()
        }
      }
      ctx.restore()
    }

    const drawGlobe = (time: number, hover: string | null) => {
      syncCamera()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      const pulse = 0.5 + 0.5 * Math.sin(time / 900)

      // 球体底色
      const body = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R)
      body.addColorStop(0, 'rgba(10, 34, 27, 0.72)')
      body.addColorStop(0.72, 'rgba(6, 22, 18, 0.62)')
      body.addColorStop(1, 'rgba(4, 14, 12, 0.18)')
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fillStyle = body
      ctx.fill()

      // 球面光照：左上方受光、右下方阴影，强化立体感
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.clip()
      const lit = ctx.createRadialGradient(
        cx - R * 0.34, cy - R * 0.38, R * 0.04,
        cx - R * 0.08, cy - R * 0.1, R * 1.22,
      )
      lit.addColorStop(0, 'rgba(190, 255, 232, 0.16)')
      lit.addColorStop(0.42, 'rgba(120, 220, 190, 0.05)')
      lit.addColorStop(0.76, 'rgba(0, 0, 0, 0.10)')
      lit.addColorStop(1, 'rgba(0, 0, 0, 0.36)')
      ctx.fillStyle = lit
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2)
      ctx.restore()

      // 外圈光晕
      const halo = ctx.createRadialGradient(cx, cy, R * 0.94, cx, cy, R * 1.14)
      halo.addColorStop(0, `rgba(84, 235, 190, ${0.16 + pulse * 0.08})`)
      halo.addColorStop(1, 'rgba(84, 235, 190, 0)')
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.14, 0, Math.PI * 2)
      ctx.fillStyle = halo
      ctx.fill()

      // 背面经纬网（玻璃感）
      drawRings(GRATICULE, false, 'rgba(72, 176, 148, 0.13)', 0.8)

      // 背面国土轮廓
      drawRings(parsed.all, false, 'rgba(64, 158, 132, 0.16)', 0.7)

      // 正面经纬网
      drawRings(GRATICULE, true, 'rgba(96, 220, 186, 0.17)', 0.8)

      // 正面国土填充 + 边界
      drawRings(parsed.all, true, 'rgba(124, 246, 205, 0.78)', 1.05, {
        fill: 'rgba(24, 120, 92, 0.16)',
      })

      // 高亮国家
      const sel = live.current.selectedId
      const selRings = sel ? parsed.byName.get(live.current.countries.find(c => c.id === sel)?.mapName ?? '') : undefined
      if (selRings) {
        drawRings(selRings, true, 'rgba(240, 208, 126, 0.95)', 1.9, {
          fill: 'rgba(201, 169, 97, 0.28)',
          glow: 16,
        })
      }
      if (hover && hover !== sel) {
        const hovRings = parsed.byName.get(live.current.countries.find(c => c.id === hover)?.mapName ?? '')
        if (hovRings) {
          drawRings(hovRings, true, 'rgba(160, 255, 216, 0.95)', 1.7, {
            fill: 'rgba(120, 255, 205, 0.16)',
            glow: 12,
          })
        }
      }

      // 网络连线（大圆插值）
      ctx.save()
      ctx.setLineDash([3, 5])
      ctx.strokeStyle = 'rgba(110, 232, 200, 0.22)'
      ctx.lineWidth = 0.9
      for (const [a, b] of live.current.links) {
        const va = nodeVec.get(a)
        const vb = nodeVec.get(b)
        if (!va || !vb) continue
        ctx.beginPath()
        let pen = false
        for (let t = 0; t <= 28; t++) {
          const k = t / 28
          let x = va[0] * (1 - k) + vb[0] * k
          let y = va[1] * (1 - k) + vb[1] * k
          let z = va[2] * (1 - k) + vb[2] * k
          const len = Math.hypot(x, y, z) || 1
          x /= len
          y /= len
          z /= len
          const [sx, sy, vis] = project(x, y, z)
          if (!vis) {
            pen = false
            continue
          }
          if (pen) ctx.lineTo(sx, sy)
          else {
            ctx.moveTo(sx, sy)
            pen = true
          }
        }
        ctx.stroke()
      }
      ctx.restore()

      // 节点 + 标签
      const labels: {
        x: number
        y: number
        name: string
        alpha: number
        sel: boolean
        hov: boolean
        hide: boolean
        order: number
      }[] = []
      for (const c of live.current.countries) {
        const v = nodeVec.get(c.id)
        if (!v) continue
        const [sx, sy, vis] = project(v[0], v[1], v[2])
        if (!vis) continue
        // 靠近边缘时淡出，避免贴边突兀
        const depth = Math.max(0, Math.min(1, ((sx - cx) ** 2 + (sy - cy) ** 2) / (R * R)))
        const alpha = 1 - depth * 0.55
        const isSel = c.id === sel
        const isHov = hover === c.id
        ctx.beginPath()
        ctx.arc(sx, sy, isSel ? 4.6 : 2.6, 0, Math.PI * 2)
        ctx.fillStyle = isSel
          ? `rgba(245, 214, 132, ${alpha})`
          : isHov
            ? `rgba(170, 255, 220, ${alpha})`
            : `rgba(126, 240, 205, ${alpha * 0.9})`
        ctx.fill()
        if (isSel || isHov) {
          ctx.beginPath()
          ctx.arc(sx, sy, (isSel ? 9 : 7) + pulse * 2.5, 0, Math.PI * 2)
          ctx.strokeStyle = isSel ? 'rgba(245, 214, 132, 0.55)' : 'rgba(170, 255, 220, 0.45)'
          ctx.lineWidth = 1
          ctx.stroke()
        }
        labels.push({
          x: sx + 8,
          y: sy - 6,
          name: c.name,
          alpha,
          sel: isSel,
          hov: isHov,
          hide: !!c.hideLabel,
          order: labels.length,
        })
      }

      // 标签避让：选中 / 悬停优先，其余按数据顺序，重叠的跳过
      if (R > 150) {
        ctx.font = '600 11px "JetBrains Mono", Consolas, monospace'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        const placed: { x0: number; y0: number; x1: number; y1: number }[] = []
        const ordered = labels.slice().sort((a, b) => {
          const pa = a.sel ? 2 : a.hov ? 1 : 0
          const pb = b.sel ? 2 : b.hov ? 1 : 0
          return pb - pa || a.order - b.order
        })
        for (const l of ordered) {
          if (l.hide && !l.sel && !l.hov) continue
          let w = LABEL_WIDTHS.get(l.name)
          if (w === undefined) {
            w = ctx.measureText(l.name).width
            LABEL_WIDTHS.set(l.name, w)
          }
          const x0 = l.x
          const y0 = l.y - 7
          const x1 = l.x + w
          const y1 = l.y + 7
          if (
            placed.some(
              r => x0 < r.x1 + 3 && x1 > r.x0 - 3 && y0 < r.y1 + 2 && y1 > r.y0 - 2
            )
          ) {
            continue
          }
          placed.push({ x0, y0, x1, y1 })
          ctx.fillStyle = l.sel
            ? `rgba(248, 222, 150, ${l.alpha})`
            : `rgba(176, 238, 214, ${l.alpha * 0.82})`
          ctx.fillText(l.name, l.x, l.y)
        }
      }

      // 扫描带（全息感）
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.clip()
      const bandY = cy + Math.sin(time / 1400) * R * 0.85
      const band = ctx.createLinearGradient(0, bandY - 26, 0, bandY + 26)
      band.addColorStop(0, 'rgba(120, 255, 210, 0)')
      band.addColorStop(0.5, 'rgba(120, 255, 210, 0.055)')
      band.addColorStop(1, 'rgba(120, 255, 210, 0)')
      ctx.fillStyle = band
      ctx.fillRect(cx - R, bandY - 26, R * 2, 52)
      ctx.restore()

      // 球体边缘 + 旋转虚线环
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(110, 245, 205, ${0.32 + pulse * 0.12})`
      ctx.lineWidth = 1.1
      ctx.stroke()

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(time / 2200)
      ctx.beginPath()
      ctx.arc(0, 0, R * 1.07, 0, Math.PI * 2)
      ctx.setLineDash([12, 16])
      ctx.strokeStyle = 'rgba(106, 226, 194, 0.22)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(-time / 3200)
      ctx.beginPath()
      ctx.arc(0, 0, R * 1.13, 0, Math.PI * 2)
      ctx.setLineDash([4, 26])
      ctx.strokeStyle = 'rgba(201, 169, 97, 0.20)'
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.restore()
    }

    /* ---------- 动画循环 ---------- */

    let hoverCache: string | null = live.current.hoverId
    let lastTime = 0

    const frame = (time: number) => {
      const dt = lastTime ? Math.min(64, time - lastTime) : 16
      lastTime = time
      if (!dragging) {
        yaw += velYaw
        pitch += velPitch
        velYaw *= 0.9
        velPitch *= 0.9
        if (Math.abs(velYaw) < 1e-5) velYaw = 0
        if (Math.abs(velPitch) < 1e-5) velPitch = 0
        // 闲置超过 2.2 秒后缓慢自转，形成 3D 全息旋转效果
        if (time - lastInteract > 2200) yaw += dt * 0.000032
      }
      pitch = clamp(pitch, -78 * DEG, 78 * DEG)
      drawGlobe(time, hoverCache)
      raf = requestAnimationFrame(frame)
    }

    /* ---------- 交互 ---------- */

    const rectOf = () => canvas.getBoundingClientRect()

    const updateHover = (mx: number, my: number) => {
      const id = hitTest(mx, my)
      if (id !== hoverCache) {
        hoverCache = id
        live.current.onHover(id)
      }
      canvas.style.cursor = id ? 'pointer' : 'grab'
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      dragging = true
      moved = false
      lastInteract = performance.now()
      lastPX = e.clientX
      lastPY = e.clientY
      velYaw = 0
      velPitch = 0
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = 'grabbing'
    }

    const onPointerMove = (e: PointerEvent) => {
      const rect = rectOf()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      if (dragging) {
        lastInteract = performance.now()
        const dx = e.clientX - lastPX
        const dy = e.clientY - lastPY
        lastPX = e.clientX
        lastPY = e.clientY
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true
        const k = 0.0052
        yaw += dx * k
        pitch += dy * k
        velYaw = dx * k * 0.5
        velPitch = dy * k * 0.5
      } else {
        updateHover(mx, my)
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      canvas.style.cursor = 'grab'
      const rect = rectOf()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      if (!moved) {
        lastInteract = performance.now()
        const id = hitTest(mx, my)
        if (id) live.current.onSelect(id)
      }
      updateHover(mx, my)
    }

    const onPointerLeave = () => {
      if (hoverCache !== null) {
        hoverCache = null
        live.current.onHover(null)
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      lastInteract = performance.now()
      const next = zoom * Math.exp(-e.deltaY * 0.0012)
      zoom = clamp(next, 0.6, 2.3)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.style.cursor = 'grab'

    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [paths])

  return (
    <div className="wm-globe-wrap" ref={wrapRef}>
      <canvas className="wm-globe" ref={canvasRef} role="img" aria-label="全球工业技术交流网络 3D 全息地球" />
      <div className="wm-globe-hint">拖动旋转 · 滚轮缩放 · 点击国家查看</div>
    </div>
  )
}
