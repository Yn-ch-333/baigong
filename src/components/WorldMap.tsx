import { useState, useEffect, useMemo } from 'react'
import { IconClose } from '../icons'
import './WorldMap.css'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Enterprise {
  name: string
  nameEn: string
  category: EnterpriseCategory
  desc: string
}

type EnterpriseCategory = '汽车' | '机械' | '电气' | '计算机' | 'AI'

interface Country {
  id: string
  name: string
  nameEn: string
  flag: string
  /** SVG path data approximating the country shape */
  path: string
  /** label text anchor */
  labelX: number
  labelY: number
  /** pulsing dot anchor */
  dotX: number
  dotY: number
  enterprises: Enterprise[]
}

interface WorldMapProps {
  onClose: () => void
}

/* ------------------------------------------------------------------ */
/*  Category styling metadata                                         */
/* ------------------------------------------------------------------ */

interface CategoryStyle {
  cls: string
  color: string
}

const CATEGORY_STYLE: Record<EnterpriseCategory, CategoryStyle> = {
  '汽车': { cls: 'cat-auto', color: 'var(--brass)' },
  '机械': { cls: 'cat-mach', color: 'var(--green-bright)' },
  '电气': { cls: 'cat-elec', color: 'var(--brass-bright)' },
  '计算机': { cls: 'cat-it', color: 'var(--green-bright)' },
  'AI': { cls: 'cat-ai', color: 'var(--brass)' },
}

const CATEGORY_ORDER: EnterpriseCategory[] = ['汽车', '机械', '电气', '计算机', 'AI']

/* ------------------------------------------------------------------ */
/*  Simplified continent background outlines (equirectangular 1000x500) */
/* ------------------------------------------------------------------ */

const CONTINENTS: { id: string; d: string }[] = [
  // North America
  { id: 'na', d: 'M90,90 L150,70 L220,75 L282,92 L300,130 L292,172 L272,202 L250,230 L210,256 L168,252 L130,232 L100,202 L80,162 L75,120 Z M230,232 L252,252 L244,272 L226,262 Z' },
  // South America
  { id: 'sa', d: 'M250,272 L292,266 L312,288 L316,332 L306,382 L286,422 L270,432 L254,412 L244,372 L240,322 Z' },
  // Greenland
  { id: 'gl', d: 'M370,46 L420,42 L442,62 L436,88 L406,96 L378,86 L366,66 Z' },
  // Europe
  { id: 'eu', d: 'M452,86 L500,80 L548,90 L562,122 L552,160 L522,186 L490,192 L464,178 L450,148 L448,112 Z' },
  // Africa
  { id: 'af', d: 'M474,206 L540,200 L586,216 L600,262 L590,312 L570,362 L544,392 L514,396 L490,372 L474,332 L464,282 L468,236 Z' },
  // Asia
  { id: 'as', d: 'M558,100 L642,84 L742,90 L822,100 L882,122 L902,162 L886,212 L840,252 L780,272 L720,266 L660,252 L600,226 L570,192 L554,146 Z' },
  // Southeast Asia / Indonesia
  { id: 'sea', d: 'M760,266 L800,260 L830,272 L848,286 L820,296 L788,292 L762,280 Z' },
  // Australia
  { id: 'au', d: 'M810,340 L862,334 L906,346 L916,376 L894,396 L850,398 L814,386 L804,360 Z' },
]

/* ------------------------------------------------------------------ */
/*  Faint network connection lines (low opacity, decorative)          */
/* ------------------------------------------------------------------ */

const LINKS: [string, string][] = [
  ['cn', 'us'],
  ['cn', 'jp'],
  ['cn', 'kr'],
  ['cn', 'de'],
  ['us', 'uk'],
  ['de', 'fr'],
  ['de', 'it'],
  ['de', 'ch'],
  ['uk', 'se'],
  ['fr', 'uk'],
  ['fr', 'ch'],
]

/* ------------------------------------------------------------------ */
/*  Country data                                                       */
/* ------------------------------------------------------------------ */

const COUNTRIES: Country[] = [
  {
    id: 'cn',
    name: '中国',
    nameEn: 'China',
    flag: '🇨🇳',
    path: 'M655,150 L700,143 L750,145 L790,155 L802,175 L795,198 L775,212 L745,218 L710,215 L678,205 L660,185 L652,165 Z',
    labelX: 726,
    labelY: 182,
    dotX: 726,
    dotY: 178,
    enterprises: [
      { name: '比亚迪', nameEn: 'BYD', category: '汽车', desc: '全球领先的新能源汽车制造商，涵盖电池、电机、电控全产业链。' },
      { name: '三一重工', nameEn: 'SANY', category: '机械', desc: '中国最大的工程机械制造商，产品涵盖挖掘机、起重机与混凝土机械。' },
      { name: '华为', nameEn: 'Huawei', category: '电气', desc: '全球领先的ICT基础设施和智能终端提供商，5G技术领跑者。' },
      { name: '联想', nameEn: 'Lenovo', category: '计算机', desc: '全球最大PC制造商，业务覆盖服务器、超算与智能设备。' },
      { name: '百度', nameEn: 'Baidu', category: 'AI', desc: '文心一言大模型与Apollo自动驾驶平台的核心研发企业。' },
      { name: '宁德时代', nameEn: 'CATL', category: '电气', desc: '全球最大动力电池制造商，新能源储能核心技术企业。' },
    ],
  },
  {
    id: 'jp',
    name: '日本',
    nameEn: 'Japan',
    flag: '🇯🇵',
    path: 'M812,168 Q828,163 836,175 Q840,190 828,200 Q816,202 810,190 Q806,178 812,168 Z M832,150 Q842,148 844,158 Q839,164 832,161 Z M806,202 Q814,204 816,212 Q808,215 804,208 Z',
    labelX: 828,
    labelY: 152,
    dotX: 824,
    dotY: 180,
    enterprises: [
      { name: '丰田', nameEn: 'Toyota', category: '汽车', desc: '全球销量第一的汽车制造商，混动与氢燃料电池技术先驱。' },
      { name: '三菱重工', nameEn: 'Mitsubishi Heavy Industries', category: '机械', desc: '综合重工企业，涵盖航空、航天、能源与工程机械领域。' },
      { name: '索尼', nameEn: 'Sony', category: '计算机', desc: '全球消费电子与娱乐巨头，影像传感器领域领导者。' },
      { name: '富士通', nameEn: 'Fujitsu', category: '计算机', desc: '日本最大IT服务企业，超级计算与云计算领域实力强劲。' },
      { name: '软银', nameEn: 'SoftBank', category: 'AI', desc: '全球科技投资集团，布局ARM、AI芯片与机器人产业。' },
      { name: '日立', nameEn: 'Hitachi', category: '电气', desc: '综合电气与工程机械巨头，能源与数字化解决方案领先者。' },
    ],
  },
  {
    id: 'de',
    name: '德国',
    nameEn: 'Germany',
    flag: '🇩🇪',
    path: 'M494,124 L516,121 L534,128 L536,142 L528,154 L514,158 L500,154 L490,144 L488,132 Z',
    labelX: 513,
    labelY: 134,
    dotX: 513,
    dotY: 142,
    enterprises: [
      { name: '大众', nameEn: 'Volkswagen', category: '汽车', desc: '欧洲最大汽车集团，旗下含奥迪、保时捷等多个知名品牌。' },
      { name: '西门子', nameEn: 'Siemens', category: '电气', desc: '全球电气与自动化巨头，工业数字化与智能基础设施领军者。' },
      { name: '博世', nameEn: 'Bosch', category: '机械', desc: '全球最大汽车零部件供应商，工业技术与家电领域领先。' },
      { name: 'SAP', nameEn: 'SAP', category: '计算机', desc: '全球最大企业应用软件公司，ERP与工业云平台标杆。' },
      { name: '德国电信', nameEn: 'Deutsche Telekom', category: '计算机', desc: '欧洲最大电信运营商，5G与工业物联网布局深入。' },
      { name: '博世AI', nameEn: 'Bosch AI', category: 'AI', desc: '博世人工智能中心，专注工业AI、自动驾驶与智能制造。' },
    ],
  },
  {
    id: 'us',
    name: '美国',
    nameEn: 'USA',
    flag: '🇺🇸',
    path: 'M120,155 L160,145 L220,143 L270,150 L288,168 L282,192 L262,210 L230,220 L195,222 L160,215 L132,200 L115,178 Z',
    labelX: 200,
    labelY: 184,
    dotX: 200,
    dotY: 180,
    enterprises: [
      { name: '特斯拉', nameEn: 'Tesla', category: '汽车', desc: '全球电动汽车与储能标杆，FSD自动驾驶技术领先。' },
      { name: '卡特彼勒', nameEn: 'Caterpillar', category: '机械', desc: '全球最大工程机械与矿山设备制造商。' },
      { name: '通用电气', nameEn: 'GE', category: '电气', desc: '百年工业巨头，航空发动机与能源发电领域领军。' },
      { name: 'IBM', nameEn: 'IBM', category: '计算机', desc: '科技与咨询服务巨头，量子计算与混合云先行者。' },
      { name: 'OpenAI', nameEn: 'OpenAI', category: 'AI', desc: 'ChatGPT缔造者，通用人工智能研究领军企业。' },
      { name: '谷歌', nameEn: 'Google', category: 'AI', desc: '搜索与AI巨头，DeepMind与Gemini大模型引领前沿。' },
    ],
  },
  {
    id: 'kr',
    name: '韩国',
    nameEn: 'South Korea',
    flag: '🇰🇷',
    path: 'M770,178 L782,176 L790,184 L792,200 L786,212 L778,208 L772,196 L769,186 Z',
    labelX: 802,
    labelY: 198,
    dotX: 782,
    dotY: 192,
    enterprises: [
      { name: '现代汽车', nameEn: 'Hyundai Motor', category: '汽车', desc: '韩国最大汽车制造商，氢燃料与电动化转型积极。' },
      { name: '斗山重工', nameEn: 'Doosan Heavy Industries', category: '机械', desc: '重型机械与发电设备制造商，工程机械全球领先。' },
      { name: '三星电子', nameEn: 'Samsung Electronics', category: '计算机', desc: '全球半导体与消费电子龙头，存储芯片市占第一。' },
      { name: 'LG电子', nameEn: 'LG Electronics', category: '电气', desc: '家电与显示技术领先者，新能源电池业务快速增长。' },
      { name: 'Naver', nameEn: 'Naver', category: 'AI', desc: '韩国最大搜索引擎，HyperCLOVA大模型与云计算布局。' },
      { name: 'SK集团', nameEn: 'SK Group', category: '电气', desc: '半导体与新能源综合集团，SK海力士存储芯片全球第二。' },
    ],
  },
  {
    id: 'fr',
    name: '法国',
    nameEn: 'France',
    flag: '🇫🇷',
    path: 'M476,148 L500,146 L514,153 L513,168 L502,178 L486,177 L475,167 L472,156 Z',
    labelX: 470,
    labelY: 176,
    dotX: 493,
    dotY: 162,
    enterprises: [
      { name: '雷诺', nameEn: 'Renault', category: '汽车', desc: '法国百年汽车制造商，电动化战略Megane E-Tech领先。' },
      { name: '施耐德电气', nameEn: 'Schneider Electric', category: '电气', desc: '全球能源管理与自动化专家，工业数字化领域领先。' },
      { name: '达索系统', nameEn: 'Dassault Systèmes', category: '计算机', desc: '3D设计与仿真软件巨头，工业数字孪生平台标杆。' },
      { name: '源讯', nameEn: 'Atos', category: '计算机', desc: '欧洲IT服务与网络安全领军企业，超算与量子计算布局。' },
      { name: 'Mistral AI', nameEn: 'Mistral AI', category: 'AI', desc: '欧洲开源大模型新星，与OpenAI竞争的法国AI独角兽。' },
      { name: '标致', nameEn: 'Peugeot', category: '汽车', desc: '法系汽车代表品牌，现属Stellantis集团核心成员。' },
    ],
  },
  {
    id: 'uk',
    name: '英国',
    nameEn: 'United Kingdom',
    flag: '🇬🇧',
    path: 'M464,98 L476,96 L480,108 L476,124 L470,130 L463,124 L460,110 Z M450,114 L459,112 L461,124 L453,127 Z',
    labelX: 452,
    labelY: 94,
    dotX: 470,
    dotY: 112,
    enterprises: [
      { name: '捷豹路虎', nameEn: 'Jaguar Land Rover', category: '汽车', desc: '英国豪华汽车制造商，全电动化转型持续推进。' },
      { name: '罗罗', nameEn: 'Rolls-Royce', category: '机械', desc: '航空发动机与动力系统巨头，民用航空核心供应商。' },
      { name: 'ARM', nameEn: 'ARM', category: '计算机', desc: '全球芯片架构授权龙头，移动与物联网处理器标准制定者。' },
      { name: 'BAE系统', nameEn: 'BAE Systems', category: '机械', desc: '欧洲最大国防与航空航天承包商。' },
      { name: 'DeepMind', nameEn: 'DeepMind', category: 'AI', desc: 'AlphaGo与AlphaFold缔造者，谷歌旗下AI前沿实验室。' },
      { name: 'Graphcore', nameEn: 'Graphcore', category: 'AI', desc: '英国AI芯片独角兽，专注IPU智能处理器研发。' },
    ],
  },
  {
    id: 'se',
    name: '瑞典',
    nameEn: 'Sweden',
    flag: '🇸🇪',
    path: 'M524,58 L540,56 L548,75 L544,95 L536,110 L530,108 L526,92 L522,75 Z',
    labelX: 534,
    labelY: 50,
    dotX: 535,
    dotY: 84,
    enterprises: [
      { name: '沃尔沃', nameEn: 'Volvo', category: '汽车', desc: '瑞典豪华商用车与卡车制造商，安全与电动化技术领先。' },
      { name: '阿特拉斯·科普柯', nameEn: 'Atlas Copco', category: '机械', desc: '全球工业压缩机与矿山设备龙头企业。' },
      { name: 'ABB', nameEn: 'ABB', category: '电气', desc: '电力与工业自动化巨头，机器人与电气化技术领先。' },
      { name: '爱立信', nameEn: 'Ericsson', category: '计算机', desc: '全球通信设备巨头，5G网络基础设施核心供应商。' },
      { name: 'Spotify', nameEn: 'Spotify', category: '计算机', desc: '全球最大音乐流媒体平台，音频推荐算法领先。' },
      { name: 'Silo AI', nameEn: 'Silo AI', category: 'AI', desc: '北欧最大私有AI实验室，定制化AI解决方案提供商。' },
    ],
  },
  {
    id: 'ch',
    name: '瑞士',
    nameEn: 'Switzerland',
    flag: '🇨🇭',
    path: 'M502,159 L516,157 L519,164 L515,170 L505,169 L500,164 Z',
    labelX: 544,
    labelY: 168,
    dotX: 510,
    dotY: 165,
    enterprises: [
      { name: '斯堪尼亚', nameEn: 'Scania', category: '汽车', desc: '全球重型卡车与商用车制造商，模块化生产与高效动力闻名。' },
      { name: 'ABB', nameEn: 'ABB', category: '电气', desc: '瑞士电力与自动化技术巨头，电网与工业自动化领军。' },
      { name: '瑞士ABB', nameEn: 'ABB Robotics', category: '机械', desc: 'ABB机器人业务，工业机器人与柔性自动化全球领先。' },
      { name: 'Logitech', nameEn: 'Logitech', category: '计算机', desc: '全球外设与视频协作设备龙头，罗技品牌广为人知。' },
      { name: 'Doodle', nameEn: 'Doodle', category: '计算机', desc: '瑞士在线会议日程协调平台，简化团队协作与会议安排。' },
      { name: 'Sophia Genetics', nameEn: 'Sophia Genetics', category: 'AI', desc: 'AI驱动的基因组数据分析平台，精准医疗数据科学领先。' },
    ],
  },
  {
    id: 'it',
    name: '意大利',
    nameEn: 'Italy',
    flag: '🇮🇹',
    path: 'M510,166 L518,164 L523,170 L521,180 L526,188 L532,196 L528,202 L520,198 L516,188 L511,176 Z M524,206 L530,206 L529,212 L524,212 Z',
    labelX: 548,
    labelY: 196,
    dotX: 520,
    dotY: 182,
    enterprises: [
      { name: '菲亚特', nameEn: 'Fiat', category: '汽车', desc: '意大利百年汽车品牌，Stellantis集团创始成员。' },
      { name: '意法半导体', nameEn: 'STMicroelectronics', category: '电气', desc: '欧洲最大半导体制造商，汽车与工业芯片领域领先。' },
      { name: '倍耐力', nameEn: 'Pirelli', category: '汽车', desc: '全球高端轮胎制造商，F1赛事独家轮胎供应商。' },
      { name: '惠普意大利', nameEn: 'Hewlett Packard Enterprise Italy', category: '计算机', desc: '惠普企业意大利分公司，专注服务器与混合云解决方案。' },
      { name: 'CDP', nameEn: 'Cassa Depositi e Prestiti', category: '机械', desc: '意大利国有战略投资控股集团，参股能源与基础设施工业。' },
      { name: 'M31', nameEn: 'M31', category: 'AI', desc: '意大利IT与数字创新企业，专注企业智能化与数字化转型。' },
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function WorldMap({ onClose }: WorldMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const selected = useMemo(
    () => COUNTRIES.find(c => c.id === selectedId) ?? null,
    [selectedId]
  )

  // Group enterprises by category for the detail panel
  const grouped = useMemo(() => {
    if (!selected) return [] as { category: EnterpriseCategory; items: Enterprise[] }[]
    return CATEGORY_ORDER.map(category => ({
      category,
      items: selected.enterprises.filter(e => e.category === category),
    })).filter(g => g.items.length > 0)
  }, [selected])

  return (
    <div className="wm-overlay" role="dialog" aria-modal="true" aria-label="全球工业技术交流网络">
      <div className="wm-container">
        {/* Header */}
        <header className="wm-header">
          <div className="wm-title-group">
            <span className="wm-title-mark" />
            <div className="wm-title-text">
              <h2 className="wm-title">全球工业技术交流网络</h2>
              <span className="wm-subtitle">Global Industrial Technology Exchange Network</span>
            </div>
          </div>
          <div className="wm-header-meta">
            <span className="wm-node-count">{COUNTRIES.length} 节点 · {COUNTRIES.reduce((n, c) => n + c.enterprises.length, 0)} 企业</span>
            <button className="wm-close" onClick={onClose} aria-label="关闭">
              <IconClose />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="wm-body">
          {/* Map area */}
          <div className="wm-map-area">
            <div className="wm-grid-bg" />
            <div className="wm-vignette" />

            <svg
              className="wm-svg"
              viewBox="0 0 1000 500"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="世界地图"
            >
              {/* Continents */}
              {CONTINENTS.map(c => (
                <path key={c.id} d={c.d} className="wm-continent" />
              ))}

              {/* Network links */}
              {LINKS.map(([a, b], i) => {
                const ca = COUNTRIES.find(c => c.id === a)
                const cb = COUNTRIES.find(c => c.id === b)
                if (!ca || !cb) return null
                return (
                  <line
                    key={`link-${i}`}
                    x1={ca.dotX}
                    y1={ca.dotY}
                    x2={cb.dotX}
                    y2={cb.dotY}
                    className="wm-link"
                  />
                )
              })}

              {/* Countries */}
              {COUNTRIES.map(c => {
                const isSel = c.id === selectedId
                const isHover = c.id === hoverId
                const cls = [
                  'wm-country',
                  isSel ? 'wm-country-sel' : '',
                  isHover && !isSel ? 'wm-country-hover' : '',
                ].join(' ').trim()
                return (
                  <path
                    key={c.id}
                    d={c.path}
                    className={cls}
                    onClick={() => setSelectedId(c.id)}
                    onMouseEnter={() => setHoverId(c.id)}
                    onMouseLeave={() => setHoverId(null)}
                  >
                    <title>{c.name} · {c.nameEn}</title>
                  </path>
                )
              })}

              {/* Pulsing dots + labels */}
              {COUNTRIES.map((c, i) => {
                const isSel = c.id === selectedId
                return (
                  <g key={`dot-${c.id}`} className="wm-node-group" style={{ animationDelay: `${(i % 5) * 0.4}s` }}>
                    <circle cx={c.dotX} cy={c.dotY} r="6" className={`wm-dot-ring ${isSel ? 'wm-dot-ring-sel' : ''}`} />
                    <circle cx={c.dotX} cy={c.dotY} r="2.4" className={`wm-dot-core ${isSel ? 'wm-dot-core-sel' : ''}`} />
                    <text
                      x={c.labelX}
                      y={c.labelY}
                      className={`wm-country-label ${isSel ? 'wm-country-label-sel' : ''}`}
                    >
                      {c.name}
                    </text>
                  </g>
                )
              })}
            </svg>

            {/* Legend */}
            <div className="wm-legend">
              <span className="wm-legend-title">图例</span>
              <span className="wm-legend-item">
                <i className="wm-swatch wm-swatch-default" />可选国家
              </span>
              <span className="wm-legend-item">
                <i className="wm-swatch wm-swatch-hover" />悬停
              </span>
              <span className="wm-legend-item">
                <i className="wm-swatch wm-swatch-sel" />已选中
              </span>
              <span className="wm-legend-coord">EQUIRECTANGULAR · 0 0 1000 500</span>
            </div>
          </div>

          {/* Detail panel */}
          <aside className="wm-detail">
            {selected ? (
              <>
                <div className="wm-detail-head">
                  <span className="wm-detail-flag">{selected.flag}</span>
                  <div className="wm-detail-titles">
                    <h3 className="wm-detail-name">{selected.name}</h3>
                    <span className="wm-detail-name-en">{selected.nameEn}</span>
                  </div>
                  <span className="wm-detail-count">{selected.enterprises.length} 企业</span>
                </div>

                <div className="wm-detail-list">
                  {grouped.map(group => (
                    <div key={group.category} className="wm-category-section">
                      <div className="wm-category-head">
                        <span className={`wm-category-bullet ${CATEGORY_STYLE[group.category].cls}`} />
                        <span className="wm-category-label">{group.category}</span>
                        <span className="wm-category-line" />
                        <span className="wm-category-count">{group.items.length}</span>
                      </div>
                      {group.items.map((e, i) => (
                        <article key={i} className="wm-enterprise">
                          <div className="wm-enterprise-top">
                            <span className="wm-enterprise-name">{e.name}</span>
                            <span className={`wm-category-tag ${CATEGORY_STYLE[e.category].cls}`}>{e.category}</span>
                          </div>
                          <span className="wm-enterprise-name-en">{e.nameEn}</span>
                          <p className="wm-enterprise-desc">{e.desc}</p>
                        </article>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="wm-detail-empty">
                <div className="wm-empty-radar">
                  <span className="wm-empty-radar-core" />
                  <span className="wm-empty-radar-ring" />
                  <span className="wm-empty-radar-ring wm-empty-radar-ring-2" />
                </div>
                <p className="wm-empty-text">点击地图上的国家查看企业信息</p>
                <p className="wm-empty-sub">Click a country node to explore its enterprises</p>
                <div className="wm-empty-countries">
                  {COUNTRIES.map(c => (
                    <button
                      key={c.id}
                      className="wm-empty-chip"
                      onClick={() => setSelectedId(c.id)}
                    >
                      <span className="wm-empty-chip-flag">{c.flag}</span>
                      <span className="wm-empty-chip-name">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
