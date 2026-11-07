import { useState, useEffect, useMemo } from 'react'
import type { User } from '../types'
import { IconClose } from '../icons'
import { WORLD_COUNTRY_PATHS } from '../data/worldMapPaths'
import './WorldMap.css'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Enterprise {
  name: string
  nameEn: string
  category: EnterpriseCategory
  desc: string
  /** 企业官网 */
  website: string
}

type EnterpriseCategory = '汽车' | '机械' | '电气' | '计算机' | 'AI'

interface Country {
  id: string
  /** Natural Earth 国家名，用于在世界地图矢量数据中定位该国轮廓 */
  mapName: string
  name: string
  nameEn: string
  flag: string
  /** 节点经纬度（等距圆柱投影换算为 1000x500 坐标） */
  lat: number
  lon: number
  /** 标签坐标与对齐方式（手工微调避免重叠） */
  labelX?: number
  labelY?: number
  labelAnchor?: 'start' | 'middle' | 'end'
  /** 国家过小或区域拥挤时只显示节点，不显示名称标签 */
  hideLabel?: boolean
  enterprises: Enterprise[]
}

interface WorldMapProps {
  onClose: () => void
  /** 全部注册用户，用于统计各国注册人数 */
  users?: User[]
}

/* ------------------------------------------------------------------ */
/*  Projection helpers (equirectangular, viewBox 0 0 1000 500)        */
/* ------------------------------------------------------------------ */

const px = (lon: number) => Math.round(((lon + 180) / 360) * 1000)
const py = (lat: number) => Math.round(((90 - lat) / 180) * 500)

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
/*  Faint network connection lines (low opacity, decorative)          */
/* ------------------------------------------------------------------ */

const LINKS: [string, string][] = [
  ['cn', 'us'],
  ['cn', 'jp'],
  ['cn', 'kr'],
  ['cn', 'de'],
  ['cn', 'sg'],
  ['us', 'ca'],
  ['us', 'mx'],
  ['us', 'br'],
  ['us', 'uk'],
  ['de', 'fr'],
  ['de', 'nl'],
  ['de', 'ch'],
  ['de', 'it'],
  ['de', 'se'],
  ['de', 'es'],
  ['uk', 'se'],
  ['fr', 'es'],
  ['fr', 'ch'],
  ['sg', 'in'],
  ['in', 'ae'],
  ['ae', 'il'],
  ['jp', 'kr'],
  ['kr', 'sg'],
]

/* ------------------------------------------------------------------ */
/*  Country data                                                       */
/* ------------------------------------------------------------------ */

const COUNTRIES: Country[] = [
  {
    id: 'cn', mapName: 'China', name: '中国', nameEn: 'China', flag: '🇨🇳',
    lat: 35.0, lon: 105.0, labelX: 814, labelY: 124,
    enterprises: [
      { name: '比亚迪', nameEn: 'BYD', category: '汽车', desc: '全球新能源汽车销量冠军，掌握电池、电机、电控与车规级半导体全产业链，旗下仰望、方程豹等品牌覆盖全价位段。', website: 'https://www.bydglobal.com' },
      { name: '三一重工', nameEn: 'SANY', category: '机械', desc: '全球工程机械前三强，挖掘机销量全球第一，混凝土机械世界领先，正在推进电动化与无人化施工。', website: 'https://www.sanyglobal.com' },
      { name: '华为', nameEn: 'Huawei', category: '电气', desc: '全球ICT基础设施与智能终端龙头，5G专利数世界第一，昇腾AI芯片与鸿蒙系统构建自主技术生态。', website: 'https://www.huawei.com' },
      { name: '宁德时代', nameEn: 'CATL', category: '电气', desc: '全球最大动力电池制造商，市占率超35%，麒麟电池、神行超充电池引领行业技术迭代。', website: 'https://www.catl.com' },
      { name: '联想', nameEn: 'Lenovo', category: '计算机', desc: '全球PC出货量第一，服务器与超算业务强劲，曾八次登顶全球超算500强供应商榜首。', website: 'https://www.lenovo.com' },
      { name: '大疆', nameEn: 'DJI', category: '机械', desc: '全球民用无人机市占率超70%，飞控、图传与影像系统技术壁垒深厚，行业应用覆盖农业、测绘与电力巡检。', website: 'https://www.dji.com' },
      { name: '百度', nameEn: 'Baidu', category: 'AI', desc: '文心大模型与Apollo自动驾驶平台核心研发者，萝卜快跑无人车已在北京、武汉等城市规模化运营。', website: 'https://www.baidu.com' },
      { name: '京东方', nameEn: 'BOE', category: '计算机', desc: '全球最大LCD面板制造商，柔性OLED出货量全球第二，物联网与智慧医工业务快速扩张。', website: 'https://www.boe.com' },
      { name: '台积电', nameEn: 'TSMC', category: '计算机', desc: '中国台湾企业，全球最大晶圆代工厂，3nm/2nm先进制程与CoWoS封装产能全球领先，AI芯片产业链核心。', website: 'https://www.tsmc.com' },
      { name: '鸿海精密', nameEn: 'Foxconn', category: '计算机', desc: '中国台湾企业，全球最大电子制造服务商，消费电子代工龙头，正切入AI服务器与电动车代工。', website: 'https://www.honhai.com' },
      { name: '联发科', nameEn: 'MediaTek', category: '电气', desc: '中国台湾企业，全球手机芯片出货量领先，天玑旗舰SoC与Wi-Fi 7、车用芯片快速扩张。', website: 'https://www.mediatek.com' },
      { name: '台达电子', nameEn: 'Delta Electronics', category: '电气', desc: '中国台湾企业，全球电源管理与散热龙头，服务器电源、光伏逆变器与工业自动化市占率领先。', website: 'https://www.deltaww.com' },
      { name: '华硕', nameEn: 'ASUS', category: '计算机', desc: '中国台湾企业，全球主板与消费笔记本一线品牌，ROG电竞生态与AI PC产品线完整。', website: 'https://www.asus.com' },
      { name: '广达电脑', nameEn: 'Quanta Computer', category: '计算机', desc: '中国台湾企业，全球最大笔记本ODM，AI服务器与云端数据中心代工份额领先。', website: 'https://www.quanta.com' },
      { name: '上银科技', nameEn: 'HIWIN', category: '机械', desc: '中国台湾企业，全球滚珠丝杠与直线导轨龙头，精密传动部件广泛应用于半导体设备与工业机器人。', website: 'https://www.hiwin.com' },
      { name: '巨大机械', nameEn: 'Giant', category: '机械', desc: '中国台湾企业，全球自行车制造龙头，捷安特与Liv品牌覆盖高端公路车与电动自行车。', website: 'https://www.giantgroup.com' },
      { name: '友嘉实业', nameEn: 'FFG', category: '机械', desc: '中国台湾企业，全球机床集团，数控机床与自动化产线服务汽车、航空航天客户。', website: 'https://www.ffg-corp.com' },
      { name: '台塑集团', nameEn: 'Formosa Plastics', category: '电气', desc: '中国台湾企业，全球石化与塑料原料巨头，六轻基地一体化炼化，电子材料与碳纤维业务延伸。', website: 'https://www.fpg.com.tw' },
      { name: '凌云工业', nameEn: 'Lingyun Industrial', category: '汽车', desc: '国内汽车安全结构件与管路系统龙头，车身轻量化与电池壳体配套主流新能源车企。', website: 'https://www.lingyun.com.cn' },
      { name: '思灵机器人', nameEn: 'Agile Robots', category: 'AI', desc: '中德合资智能机器人公司，力控机械臂与视觉系统服务3C、医疗与汽车精密装配。', website: 'https://www.agile-robots.com' },
      { name: '汇川技术', nameEn: 'Inovance', category: '电气', desc: '工业自动化与新能源汽车电驱龙头，伺服系统与变频器国产替代主力。', website: 'https://www.inovance.com' },
      { name: '徐工集团', nameEn: 'XCMG', category: '机械', desc: '全球工程机械前五，起重机与挖掘机出口170多国，电动化与无人化产品线齐全。', website: 'https://www.xcmg.com' },
      { name: '中联重科', nameEn: 'Zoomlion', category: '机械', desc: '全球混凝土机械与起重机械龙头，高空作业平台与智慧农业装备增长迅速。', website: 'https://www.zoomlion.com' },
      { name: '潍柴动力', nameEn: 'Weichai', category: '汽车', desc: '全球重型柴油机龙头，柴油机本体热效率突破53%，氢燃料电池与商用车动力总成布局领先。', website: 'https://www.weichai.com' },
      { name: '吉利汽车', nameEn: 'Geely', category: '汽车', desc: '中国自主品牌销量前列，SEA浩瀚架构与雷神电混技术输出沃尔沃、极氪等品牌。', website: 'https://www.geely.com' },
      { name: '小米', nameEn: 'Xiaomi', category: '计算机', desc: '手机与AIoT生态全球领先，自研芯片与SU7电动车构建人车家全生态。', website: 'https://www.mi.com' },
      { name: '中国中车', nameEn: 'CRRC', category: '机械', desc: '全球最大轨道交通装备制造商，高铁列车占全球市场过半，风电与新材料业务协同。', website: 'https://www.crrcgc.cc' },
      { name: '国家电网', nameEn: 'State Grid', category: '电气', desc: '全球最大公用事业企业，特高压输电与智能电网技术标准输出多国。', website: 'https://www.sgcc.com.cn' },
      { name: '宇树科技', nameEn: 'Unitree', category: 'AI', desc: '四足与人形机器人全球出货领先，运动控制与关节模组自研，产品进入工业巡检与科研场景。', website: 'https://www.unitree.com' },
      { name: '科大讯飞', nameEn: 'iFlytek', category: 'AI', desc: '中文语音识别与大模型龙头，星火大模型赋能教育、医疗与工业质检。', website: 'https://www.iflytek.com' },
      { name: '商汤科技', nameEn: 'SenseTime', category: 'AI', desc: '计算机视觉与日日新大模型，AI基础设施与智能汽车、智慧城市方案规模化落地。', website: 'https://www.sensetime.com' },
    ],
  },
  {
    id: 'jp', mapName: 'Japan', name: '日本', nameEn: 'Japan', flag: '🇯🇵',
    lat: 36.2, lon: 138.3, labelX: 897, labelY: 139,
    enterprises: [
      { name: '丰田', nameEn: 'Toyota', category: '汽车', desc: '全球销量第一的汽车集团，混动技术开创者，Mirai氢燃料电池车与固态电池研发处于行业前沿。', website: 'https://global.toyota' },
      { name: '三菱重工', nameEn: 'Mitsubishi Heavy Industries', category: '机械', desc: '日本最大综合重工集团，业务覆盖航空发动机、燃气轮机、火箭发射系统与核电设备。', website: 'https://www.mhi.com' },
      { name: '发那科', nameEn: 'FANUC', category: '机械', desc: '全球工业机器人四大家族之首，数控系统市占率全球第一，"黄色机器人"遍布全球工厂。', website: 'https://www.fanuc.co.jp' },
      { name: '索尼', nameEn: 'Sony', category: '计算机', desc: '影像传感器全球市占率超50%，PlayStation游戏生态与CMOS技术构成双核心，娱乐与半导体巨头。', website: 'https://www.sony.com' },
      { name: '日立', nameEn: 'Hitachi', category: '电气', desc: '综合电机巨头，Lumada工业数字化平台服务全球，新干线列车与核电技术代表日本制造水准。', website: 'https://www.hitachi.com' },
      { name: '富士通', nameEn: 'Fujitsu', category: '计算机', desc: '日本最大IT服务商，"富岳"超级计算机曾连续四期全球第一，量子计算与AI研发领先。', website: 'https://www.fujitsu.com' },
      { name: '软银集团', nameEn: 'SoftBank Group', category: 'AI', desc: '全球最大科技投资基金运营者，控股ARM并重仓AI芯片与机器人，愿景基金重塑全球AI投资版图。', website: 'https://group.softbank' },
    ],
  },
  {
    id: 'kr', mapName: 'South Korea', name: '韩国', nameEn: 'South Korea', flag: '🇰🇷',
    lat: 36.5, lon: 127.9, labelX: 864, labelY: 158, labelAnchor: 'start',
    enterprises: [
      { name: '现代汽车', nameEn: 'Hyundai Motor Group', category: '汽车', desc: '全球销量前三的汽车集团，E-GMP纯电平台与氢燃料电池车NEXO技术领先，旗下含起亚与捷尼赛思。', website: 'https://www.hyundai.com' },
      { name: '三星电子', nameEn: 'Samsung Electronics', category: '计算机', desc: '全球存储芯片市占率第一，晶圆代工全球第二，Galaxy手机与先进制程半导体双轮驱动。', website: 'https://www.samsung.com' },
      { name: 'SK海力士', nameEn: 'SK hynix', category: '电气', desc: '全球第二大存储芯片商，HBM高带宽内存市占率过半，是英伟达AI加速卡核心供应商。', website: 'https://www.skhynix.com' },
      { name: 'LG新能源', nameEn: 'LG Energy Solution', category: '电气', desc: '全球动力电池前三强，为特斯拉、通用、大众等主流车企供应电池，正极材料技术积累深厚。', website: 'https://www.lgensol.com' },
      { name: '斗山重工', nameEn: 'Doosan Enerbility', category: '机械', desc: '韩国最大发电设备制造商，核电站主设备与大型燃气轮机出口全球，氢能与小型模块化反应堆布局领先。', website: 'https://www.doosan.com' },
      { name: 'Naver', nameEn: 'NAVER', category: 'AI', desc: '韩国最大互联网与搜索平台，HyperCLOVA X大模型支撑搜索、云与机器人业务，LINE覆盖东南亚市场。', website: 'https://www.navercorp.com' },
    ],
  },
  {
    id: 'sg', mapName: 'Singapore', name: '新加坡', nameEn: 'Singapore', flag: '🇸🇬',
    lat: 1.35, lon: 103.8, labelX: 792, labelY: 264,
    enterprises: [
      { name: '新科工程', nameEn: 'ST Engineering', category: '机械', desc: '亚洲最大防务与工程集团之一，业务覆盖航空航天MRO、智慧城市系统与船舶修造。', website: 'https://www.stengg.com' },
      { name: '伟创力', nameEn: 'Flex', category: '电气', desc: '全球第三大电子制造服务商，为汽车、医疗与云计算行业提供设计制造一体化服务。', website: 'https://www.flex.com' },
      { name: 'Grab', nameEn: 'Grab Holdings', category: '计算机', desc: '东南亚超级应用龙头，出行、外卖与数字金融覆盖8国，AI调度系统处理每日数千万订单。', website: 'https://www.grab.com' },
      { name: '冬海集团', nameEn: 'Sea Limited', category: '计算机', desc: '东南亚最大互联网公司，旗下Shopee电商、Garena游戏与SeaMoney支付三驾马车。', website: 'https://www.sea.com' },
      { name: '吉宝企业', nameEn: 'Keppel', category: '机械', desc: '全球海工装备龙头，岸外钻井平台与数据中心基础设施运营商，正转型为可持续城市解决方案商。', website: 'https://www.keppel.com' },
      { name: 'GovTech AI', nameEn: 'AI Singapore', category: 'AI', desc: '新加坡国家AI计划核心机构，推动AI在制造业、医疗与城市治理落地，培养本土AI工程人才。', website: 'https://aisingapore.org' },
    ],
  },
  {
    id: 'in', mapName: 'India', name: '印度', nameEn: 'India', flag: '🇮🇳',
    lat: 22.5, lon: 78.9, labelX: 719, labelY: 158,
    enterprises: [
      { name: '塔塔汽车', nameEn: 'Tata Motors', category: '汽车', desc: '印度最大商用车制造商，旗下拥有捷豹路虎，本土电动车市占率超70%，Nexon EV引领印度电动化。', website: 'https://www.tatamotors.com' },
      { name: '马恒达', nameEn: 'Mahindra & Mahindra', category: '汽车', desc: '印度SUV与拖拉机制造龙头，拖拉机销量全球第一，电动SUV与Formula E车队展示技术实力。', website: 'https://www.mahindra.com' },
      { name: '拉森图博', nameEn: 'Larsen & Toubro', category: '机械', desc: '印度最大工程总承包集团，承建核电、高铁与石化超级工程，重型装备与防务制造并举。', website: 'https://www.larsentoubro.com' },
      { name: '塔塔咨询', nameEn: 'TCS', category: '计算机', desc: '全球第二大IT服务商，市值曾超2000亿美元，为波音、空客等工业巨头提供数字化工程服务。', website: 'https://www.tcs.com' },
      { name: '印孚瑟斯', nameEn: 'Infosys', category: '计算机', desc: '印度IT服务三巨头之一，Topaz AI平台服务全球财富500强，工业物联网与自动化咨询见长。', website: 'https://www.infosys.com' },
      { name: '信实工业', nameEn: 'Reliance Industries', category: '电气', desc: '印度最大私营企业，拥有全球最大单体炼化基地，正投资千亿建设新能源超级工厂集群。', website: 'https://www.ril.com' },
    ],
  },
  {
    id: 'de', mapName: 'Germany', name: '德国', nameEn: 'Germany', flag: '🇩🇪',
    lat: 51.2, lon: 10.4, labelX: 546, labelY: 100, labelAnchor: 'start',
    enterprises: [
      { name: '大众集团', nameEn: 'Volkswagen Group', category: '汽车', desc: '欧洲最大汽车集团，旗下大众、奥迪、保时捷等12大品牌，MEB平台与PowerCo电池工厂驱动电动转型。', website: 'https://www.volkswagenag.com' },
      { name: '梅赛德斯-奔驰', nameEn: 'Mercedes-Benz', category: '汽车', desc: '汽车发明者，豪华轿车标杆，MB.OS操作系统与L3级Drive Pilot自动驾驶率先量产落地。', website: 'https://www.mercedes-benz.com' },
      { name: '宝马', nameEn: 'BMW Group', category: '汽车', desc: '全球豪华汽车三强，Neue Klasse新世代车型采用800V架构与全景iDrive，氢燃料电池iX5同步推进。', website: 'https://www.bmwgroup.com' },
      { name: '西门子', nameEn: 'Siemens', category: '电气', desc: '工业自动化全球霸主，Xcelerator工业元宇宙平台与数字孪生技术定义工业4.0标准。', website: 'https://www.siemens.com' },
      { name: '博世', nameEn: 'Bosch', category: '机械', desc: '全球最大汽车零部件供应商，ESP、柴油共轨等技术行业标准制定者，正发力碳化硅芯片与氢动力。', website: 'https://www.bosch.com' },
      { name: 'SAP', nameEn: 'SAP', category: '计算机', desc: '全球最大企业管理软件公司，S/4HANA服务全球工业企业，Joule AI助手嵌入全产品线的数字化核心。', website: 'https://www.sap.com' },
      { name: '巴斯夫', nameEn: 'BASF', category: '电气', desc: '全球最大化工企业，电池材料与催化剂技术领先，湛江一体化基地是其最大海外投资项目。', website: 'https://www.basf.com' },
      { name: '蒂森克虏伯', nameEn: 'thyssenkrupp', category: '机械', desc: '德国钢铁与工业工程巨头，全球最大绿氢电解槽供应商之一，subsea潜艇技术世界顶尖。', website: 'https://www.thyssenkrupp.com' },
    ],
  },
  {
    id: 'fr', mapName: 'France', name: '法国', nameEn: 'France', flag: '🇫🇷',
    lat: 46.6, lon: 2.4, labelX: 498, labelY: 121, labelAnchor: 'end',
    enterprises: [
      { name: '雷诺集团', nameEn: 'Renault Group', category: '汽车', desc: '欧洲电动车先行者，Megane E-Tech与Ampere纯电子公司引领转型，与日产三菱联盟共享技术平台。', website: 'https://www.renaultgroup.com' },
      { name: '空客', nameEn: 'Airbus', category: '机械', desc: '全球最大商用飞机制造商，A320neo系列订单破万架，正研发ZEROe氢能零排放客机。', website: 'https://www.airbus.com' },
      { name: '施耐德电气', nameEn: 'Schneider Electric', category: '电气', desc: '全球能源管理与工业自动化专家，EcoStruxure平台连接工厂与楼宇，多次获评全球最可持续企业。', website: 'https://www.se.com' },
      { name: '阿尔斯通', nameEn: 'Alstom', category: '机械', desc: '全球轨道交通巨头，TGV高速列车与氢动力Coradia iLint列车开创者，收购庞巴迪运输后规模倍增。', website: 'https://www.alstom.com' },
      { name: '达索系统', nameEn: 'Dassault Systèmes', category: '计算机', desc: 'CATIA与SOLIDWORKS背后的3D设计软件霸主，3DEXPERIENCE平台是全球工业数字孪生事实标准。', website: 'https://www.3ds.com' },
      { name: '道达尔能源', nameEn: 'TotalEnergies', category: '电气', desc: '欧洲能源巨头，液化天然气贸易全球前三，大规模投资光伏、储能与海上风电实现多能源转型。', website: 'https://totalenergies.com' },
      { name: 'Mistral AI', nameEn: 'Mistral AI', category: 'AI', desc: '欧洲最强开源大模型公司，Mixtral专家混合架构与Le Chat助手，被视为OpenAI的欧洲竞争者。', website: 'https://mistral.ai' },
    ],
  },
  {
    id: 'uk', mapName: 'United Kingdom', name: '英国', nameEn: 'United Kingdom', flag: '🇬🇧',
    lat: 52.5, lon: -1.5, labelX: 487, labelY: 96, labelAnchor: 'end',
    enterprises: [
      { name: '捷豹路虎', nameEn: 'Jaguar Land Rover', category: '汽车', desc: '英国最大汽车制造商，揽胜与卫士系列豪华SUV全球热销，2025年起捷豹转型纯电超豪华品牌。', website: 'https://www.jaguarlandrover.com' },
      { name: '罗尔斯·罗伊斯', nameEn: 'Rolls-Royce', category: '机械', desc: '全球航空发动机三巨头，遄达系列驱动空客A350，小型模块化核反应堆技术英国国家战略核心。', website: 'https://www.rolls-royce.com' },
      { name: 'BAE系统', nameEn: 'BAE Systems', category: '机械', desc: '欧洲最大防务承包商，台风战机、机敏级核潜艇与第六代GCAP战机项目主承包商。', website: 'https://www.baesystems.com' },
      { name: 'ARM', nameEn: 'Arm', category: '计算机', desc: '全球芯片架构霸主，每年超250亿颗芯片基于ARM架构，从手机到AI服务器无处不在。', website: 'https://www.arm.com' },
      { name: '戴森', nameEn: 'Dyson', category: '电气', desc: '无袋吸尘器与高速数码马达发明者，固态电池与机器人研发投入巨大，新加坡全球总部运营。', website: 'https://www.dyson.com' },
      { name: 'DeepMind', nameEn: 'Google DeepMind', category: 'AI', desc: 'AlphaGo与AlphaFold蛋白质结构预测缔造者，Gemini大模型核心团队，AI for Science的全球标杆。', website: 'https://deepmind.google' },
    ],
  },
  {
    id: 'se', mapName: 'Sweden', name: '瑞典', nameEn: 'Sweden', flag: '🇸🇪',
    lat: 62.0, lon: 15.0, labelX: 555, labelY: 72,
    enterprises: [
      { name: '沃尔沃集团', nameEn: 'Volvo Group', category: '汽车', desc: '全球重卡与建筑设备巨头，电动卡车与自动驾驶矿车率先商用，与戴姆勒合资燃料电池公司。', website: 'https://www.volvogroup.com' },
      { name: '斯堪尼亚', nameEn: 'Scania', category: '汽车', desc: '重型卡车"公路之王"，模块化制造体系行业标杆，生物燃料与电动卡车并行推进低碳运输。', website: 'https://www.scania.com' },
      { name: '阿特拉斯·科普柯', nameEn: 'Atlas Copco', category: '机械', desc: '全球工业压缩机与真空设备霸主，半导体真空泵市占率领先，无油压缩技术行业标准。', website: 'https://www.atlascopcogroup.com' },
      { name: '山特维克', nameEn: 'Sandvik', category: '机械', desc: '全球矿山机械与金属切削刀具龙头，自动化采矿设备与硬质合金材料技术世界顶尖。', website: 'https://home.sandvik' },
      { name: 'ABB', nameEn: 'ABB', category: '电气', desc: '全球工业机器人四大家族，电气化与运动控制技术巨头，协作机器人YuMi开创人机共融先河。', website: 'https://global.abb' },
      { name: '爱立信', nameEn: 'Ericsson', category: '计算机', desc: '全球5G设备三强，移动网络专利数行业第一，为170多个国家的运营商提供网络基础设施。', website: 'https://www.ericsson.com' },
    ],
  },
  {
    id: 'ch', mapName: 'Switzerland', name: '瑞士', nameEn: 'Switzerland', flag: '🇨🇭',
    lat: 46.8, lon: 8.2, labelX: 517, labelY: 133, labelAnchor: 'end',
    enterprises: [
      { name: 'ABB机器人', nameEn: 'ABB Robotics', category: '机械', desc: '总部苏黎世的机器人业务单元，全球装机超50万台，OmniCore控制器与AI视觉拣选技术领先。', website: 'https://new.abb.com/products/robotics' },
      { name: '布勒集团', nameEn: 'Bühler Group', category: '机械', desc: '全球粮食加工与压铸设备隐形冠军，全球约65%巧克力与30%面粉经布勒设备加工。', website: 'https://www.buhlergroup.com' },
      { name: '史陶比尔', nameEn: 'Stäubli', category: '机械', desc: '精密连接与机器人专家，快速接头、纺织机械与四轴SCARA机器人三大业务全球领先。', website: 'https://www.staubli.com' },
      { name: '欧瑞康', nameEn: 'OC Oerlikon', category: '电气', desc: '表面涂层与化学纤维设备全球领导者，PVD涂层刀具与增材制造服务航空航天高端客户。', website: 'https://www.oerlikon.com' },
      { name: '罗技', nameEn: 'Logitech', category: '计算机', desc: '全球PC外设市占率第一，MX系列键鼠与视频会议设备定义远程办公硬件标准。', website: 'https://www.logitech.com' },
      { name: '索菲亚基因', nameEn: 'SOPHiA GENETICS', category: 'AI', desc: 'AI驱动的基因组数据分析平台，云端算法服务全球780多家医院的精准医疗与临床研究。', website: 'https://www.sophiagenetics.com' },
    ],
  },
  {
    id: 'it', mapName: 'Italy', name: '意大利', nameEn: 'Italy', flag: '🇮🇹',
    lat: 42.8, lon: 12.8, labelX: 546, labelY: 141, labelAnchor: 'start',
    enterprises: [
      { name: '法拉利', nameEn: 'Ferrari', category: '汽车', desc: '超跑与F1传奇品牌，SF90混动超跑技术下放，Purosangue SUV创品牌销量纪录，单车利润全球最高。', website: 'https://www.ferrari.com' },
      { name: '兰博基尼', nameEn: 'Lamborghini', category: '汽车', desc: '大众旗下超跑品牌，Revuelto V12混动旗舰订单排至数年后，2028年将推首款纯电车型。', website: 'https://www.lamborghini.com' },
      { name: '依维柯集团', nameEn: 'Iveco Group', category: '汽车', desc: '欧洲商用车与巴士制造商，Nikola合作电动重卡与天然气卡车技术，防务车辆业务独立运营。', website: 'https://www.ivecogroup.com' },
      { name: '莱昂纳多', nameEn: 'Leonardo', category: '机械', desc: '意大利最大防务航空航天集团，AW系列直升机、M-346教练机与欧洲无人机项目核心成员。', website: 'https://www.leonardo.com' },
      { name: '意法半导体', nameEn: 'STMicroelectronics', category: '电气', desc: '欧洲最大半导体IDM，碳化硅功率器件全球第一，特斯拉与苹果的传感器核心供应商。', website: 'https://www.st.com' },
      { name: '倍耐力', nameEn: 'Pirelli', category: '机械', desc: '全球高端轮胎标杆，F1独家轮胎供应商，Cyber Tyre智能轮胎实时传输路面数据。', website: 'https://www.pirelli.com' },
    ],
  },
  {
    id: 'es', mapName: 'Spain', name: '西班牙', nameEn: 'Spain', flag: '🇪🇸',
    lat: 40.3, lon: -3.6, labelX: 489, labelY: 154,
    enterprises: [
      { name: '西雅特/CUPRA', nameEn: 'SEAT & CUPRA', category: '汽车', desc: '大众集团西班牙品牌，CUPRA高性能电动子品牌增长迅猛，巴塞罗那工厂转型电动车中心。', website: 'https://www.cupraofficial.com' },
      { name: 'ACS集团', nameEn: 'ACS Group', category: '机械', desc: '全球最大工程建设集团之一，控股德国Hochtief，承建全球高铁、机场与能源基础设施。', website: 'https://www.grupoacs.com' },
      { name: '西门子歌美飒', nameEn: 'Siemens Gamesa', category: '电气', desc: '全球海上风电整机龙头，14MW海上机组行业最大，西班牙巴斯克地区是其风电技术大本营。', website: 'https://www.siemensgamesa.com' },
      { name: 'CAF', nameEn: 'CAF', category: '机械', desc: '西班牙轨道车辆制造商，地铁、有轨电车与轻轨出口欧洲拉美，收购Solaris客车强化电动巴士。', website: 'https://www.caf.net' },
      { name: 'Indra', nameEn: 'Indra', category: '计算机', desc: '西班牙国防与空中交通管理巨头，全球空管雷达系统主要供应商，Minsait数字化咨询覆盖拉美。', website: 'https://www.indracompany.com' },
      { name: 'Multiverse', nameEn: 'Multiverse Computing', category: 'AI', desc: '欧洲量子计算软件独角兽，量子启发的AI模型压缩技术获博世投资，工业优化场景落地领先。', website: 'https://multiversecomputing.com' },
    ],
  },
  {
    id: 'nl', mapName: 'Netherlands', name: '荷兰', nameEn: 'Netherlands', flag: '🇳🇱',
    lat: 52.2, lon: 5.3, labelX: 522, labelY: 92, labelAnchor: 'start',
    enterprises: [
      { name: 'ASML', nameEn: 'ASML', category: '电气', desc: '全球唯一EUV光刻机制造商，High-NA EUV单台售价超3.5亿欧元，是先进芯片制造的"卡脖子"核心。', website: 'https://www.asml.com' },
      { name: '飞利浦', nameEn: 'Philips', category: '电气', desc: '百年电子巨头转型医疗科技，影像诊断、监护设备与AI辅助诊疗全球医院广泛部署。', website: 'https://www.philips.com' },
      { name: 'Stellantis', nameEn: 'Stellantis', category: '汽车', desc: '全球第四大汽车集团，整合标致雪铁龙与菲亚特克莱斯勒，Jeep、玛莎拉蒂等14品牌并驾齐驱。', website: 'https://www.stellantis.com' },
      { name: '恩智浦', nameEn: 'NXP Semiconductors', category: '计算机', desc: '全球最大汽车半导体供应商，车载雷达、NFC与UWB芯片市占率第一，智能座舱与自动驾驶核心。', website: 'https://www.nxp.com' },
      { name: 'DAF卡车', nameEn: 'DAF Trucks', category: '汽车', desc: '欧洲重卡主流品牌，PACCAR旗下，新一代XF/XG获国际年度卡车，电动重卡续航突破500公里。', website: 'https://www.daf.com' },
      { name: 'ASM国际', nameEn: 'ASM International', category: '计算机', desc: '原子层沉积（ALD）设备全球霸主，先进制程芯片沉积工艺核心设备商，与ASML并称荷兰半导体双雄。', website: 'https://www.asm.com' },
    ],
  },
  {
    id: 'us', mapName: 'United States of America', name: '美国', nameEn: 'USA', flag: '🇺🇸',
    lat: 39.5, lon: -98.0, labelX: 228, labelY: 128,
    enterprises: [
      { name: '特斯拉', nameEn: 'Tesla', category: '汽车', desc: '全球电动车与储能标杆，4680电池、一体化压铸与FSD自动驾驶引领行业，Optimus人形机器人量产在即。', website: 'https://www.tesla.com' },
      { name: '波音', nameEn: 'Boeing', category: '机械', desc: '全球最大航空航天公司之一，737/787客机与航天防务业务并重，正加速恢复质量体系与产能。', website: 'https://www.boeing.com' },
      { name: '卡特彼勒', nameEn: 'Caterpillar', category: '机械', desc: '全球工程机械与矿山设备霸主，无人驾驶矿卡车队规模全球最大，发动机与再制造业务构建护城河。', website: 'https://www.caterpillar.com' },
      { name: 'GE航空航天', nameEn: 'GE Aerospace', category: '电气', desc: '全球航空发动机市占率第一，LEAP发动机供不应求，GE分拆后聚焦航空主业。', website: 'https://www.geaerospace.com' },
      { name: '苹果', nameEn: 'Apple', category: '计算机', desc: '全球市值最高科技公司，M系列自研芯片与Vision Pro空间计算引领硬件创新，供应链管理能力行业典范。', website: 'https://www.apple.com' },
      { name: '英伟达', nameEn: 'NVIDIA', category: '计算机', desc: 'AI算力霸主，GPU市占率超90%，Blackwell架构与CUDA生态定义全球AI基础设施标准。', website: 'https://www.nvidia.com' },
      { name: 'IBM', nameEn: 'IBM', category: '计算机', desc: '百年科技巨头，量子计算机Condor破千量子比特，watsonx企业AI平台与混合云服务全球工业客户。', website: 'https://www.ibm.com' },
      { name: 'OpenAI', nameEn: 'OpenAI', category: 'AI', desc: 'ChatGPT与GPT系列大模型开创者，o系列推理模型与Sora视频生成引领AGI竞赛，微软深度战略绑定。', website: 'https://openai.com' },
    ],
  },
  {
    id: 'ca', mapName: 'Canada', name: '加拿大', nameEn: 'Canada', flag: '🇨🇦',
    lat: 56.0, lon: -106.0, labelX: 206, labelY: 82,
    enterprises: [
      { name: '麦格纳', nameEn: 'Magna International', category: '汽车', desc: '全球第三大汽车零部件供应商，整车代工能力业内独有，为奔驰G级、捷豹I-PACE代工整车。', website: 'https://www.magna.com' },
      { name: '庞巴迪', nameEn: 'Bombardier', category: '机械', desc: '全球公务机制造龙头，Global 7500航程创纪录，专注高端公务航空市场。', website: 'https://bombardier.com' },
      { name: 'CAE', nameEn: 'CAE', category: '机械', desc: '全球飞行模拟机霸主，民航飞行员培训市占率第一，防务模拟训练系统覆盖40多国军队。', website: 'https://www.cae.com' },
      { name: '黑莓', nameEn: 'BlackBerry', category: '计算机', desc: 'QNX实时操作系统驱动全球2.5亿辆汽车，汽车功能安全软件市占率第一，转型网络安全与IoT。', website: 'https://www.blackberry.com' },
      { name: 'Shopify', nameEn: 'Shopify', category: '计算机', desc: '全球独立站电商SaaS龙头，AI工具Sidekick与Shopify Magic赋能数百万商家数字化转型。', website: 'https://www.shopify.com' },
      { name: 'Element AI', nameEn: 'Waabi', category: 'AI', desc: '自动驾驶AI独角兽，Waabi World神经仿真器革新自动驾驶训练范式，获Uber Freight战略绑定。', website: 'https://waabi.ai' },
    ],
  },
  {
    id: 'mx', mapName: 'Mexico', name: '墨西哥', nameEn: 'Mexico', flag: '🇲🇽',
    lat: 23.6, lon: -102.5, labelX: 215, labelY: 200,
    enterprises: [
      { name: '西麦斯', nameEn: 'CEMEX', category: '机械', desc: '全球第三大水泥建材集团，低碳混凝土与再生骨料技术领先，业务遍及50多个国家的基建市场。', website: 'https://www.cemex.com' },
      { name: '墨西哥集团', nameEn: 'Grupo México', category: '机械', desc: '全球最大铜生产商之一，铜矿开采、铁路运输与基础设施三大板块，掌控秘鲁与墨西哥核心铜矿。', website: 'https://www.gmexico.com' },
      { name: 'Nemak', nameEn: 'Nemak', category: '汽车', desc: '全球铝制发动机缸体与结构件龙头，为特斯拉、宝马等供应轻量化底盘，电动化壳体业务快速增长。', website: 'https://www.nemak.com' },
      { name: 'Vitro', nameEn: 'Vitro', category: '机械', desc: '北美最大玻璃制造商，汽车玻璃与建筑玻璃服务整个北美市场，太阳能玻璃产能持续扩张。', website: 'https://www.vitro.com' },
      { name: 'FEMSA', nameEn: 'FEMSA', category: '电气', desc: '拉美最大饮料与零售集团，OXXO便利店超2万家，物流与冷链基础设施覆盖全墨西哥。', website: 'https://www.femsa.com' },
      { name: 'Kavak', nameEn: 'Kavak', category: 'AI', desc: '拉美最大二手车电商平台，AI定价与检测算法重塑拉美汽车流通，估值曾达87亿美元。', website: 'https://www.kavak.com' },
    ],
  },
  {
    id: 'br', mapName: 'Brazil', name: '巴西', nameEn: 'Brazil', flag: '🇧🇷',
    lat: -10.8, lon: -52.9, labelX: 358, labelY: 302,
    enterprises: [
      { name: '巴西航空工业', nameEn: 'Embraer', category: '机械', desc: '全球第三大飞机制造商，E2系列支线客机热销，Eve电动垂直起降飞行器领跑城市空中交通。', website: 'https://embraer.com' },
      { name: '淡水河谷', nameEn: 'Vale', category: '机械', desc: '全球最大铁矿石与镍生产商，为电动车电池供应关键镍材，无人驾驶矿卡与绿色压块技术降碳。', website: 'https://vale.com' },
      { name: 'WEG', nameEn: 'WEG', category: '电气', desc: '全球电机与工业自动化巨头，电动机产量全球前三，风电整机与光伏逆变器业务高速扩张。', website: 'https://www.weg.net' },
      { name: '巴西石油', nameEn: 'Petrobras', category: '电气', desc: '深海石油开采技术全球第一，盐下油田产量创纪录，FPSO浮式生产平台规模全球最大。', website: 'https://petrobras.com.br' },
      { name: 'Marcopolo', nameEn: 'Marcopolo', category: '汽车', desc: '全球最大客车车身制造商之一，电动巴士车身出口100多国，Volare微巴深耕城配市场。', website: 'https://www.marcopolo.com.br' },
      { name: 'TOTVS', nameEn: 'TOTVS', category: '计算机', desc: '拉美最大企业管理软件公司，ERP服务超7万家企业，Carol AI平台推动拉美制造业数字化。', website: 'https://www.totvs.com' },
    ],
  },
  {
    id: 'ae', mapName: 'United Arab Emirates', name: '阿联酋', nameEn: 'UAE', flag: '🇦🇪',
    lat: 24.4, lon: 54.4, labelX: 653, labelY: 198,
    enterprises: [
      { name: 'ADNOC', nameEn: 'ADNOC', category: '电气', desc: '阿布扎比国家石油公司，全球最低碳强度原油生产商，投资1500亿美元扩产并布局氢能与CCUS。', website: 'https://www.adnoc.ae' },
      { name: 'DP World', nameEn: 'DP World', category: '机械', desc: '全球第四大港口运营商，杰贝阿里港中东最大，自动化码头与智能物流平台覆盖78个国家。', website: 'https://www.dpworld.com' },
      { name: 'EDGE集团', nameEn: 'EDGE Group', category: '机械', desc: '中东最大防务集团，无人机、精确制导弹药与电子战系统出口全球，25家子公司覆盖全防务链。', website: 'https://edgegroup.ae' },
      { name: '穆巴达拉', nameEn: 'Mubadala', category: '电气', desc: '阿布扎比主权基金，控股格芯（GlobalFoundries）半导体，投资组合超3000亿美元覆盖全球工业。', website: 'https://www.mubadala.com' },
      { name: 'Strata', nameEn: 'Strata Manufacturing', category: '机械', desc: '阿联酋航空复材结构件制造商，为波音787与空客A380供应机翼部件，本土航空制造旗舰。', website: 'https://www.strata.ae' },
      { name: 'G42', nameEn: 'G42', category: 'AI', desc: '中东最大AI公司，与OpenAI、微软深度合作，Jais阿拉伯语大模型与AI算力基建辐射全球南方。', website: 'https://www.g42.ai' },
    ],
  },
  {
    id: 'il', mapName: 'Israel', name: '以色列', nameEn: 'Israel', flag: '🇮🇱',
    lat: 31.0, lon: 34.9, labelX: 589, labelY: 158, labelAnchor: 'end',
    enterprises: [
      { name: '以色列航空工业', nameEn: 'IAI', category: '机械', desc: '以色列最大航空航天企业，"苍鹭"无人机与"箭"式反导系统闻名，公务机改装技术世界领先。', website: 'https://www.iai.co.il' },
      { name: '埃尔比特系统', nameEn: 'Elbit Systems', category: '机械', desc: '全球防务电子巨头，无人机航电与头盔显示系统装备30多国军队，夜视与电光系统技术顶尖。', website: 'https://elbitsystems.com' },
      { name: '拉斐尔', nameEn: 'Rafael', category: '电气', desc: '"铁穹"拦截系统与"长钉"导弹研发商，定向能武器"铁束"开创激光防空新时代。', website: 'https://www.rafael.co.il' },
      { name: 'Mobileye', nameEn: 'Mobileye', category: 'AI', desc: '自动驾驶视觉芯片霸主，EyeQ芯片装车超1.7亿辆，SuperVision高阶智驾方案量产落地。', website: 'https://www.mobileye.com' },
      { name: 'Check Point', nameEn: 'Check Point', category: '计算机', desc: '全球网络安全先驱，防火墙技术发明者之一，Infinity平台保护全球10万家企业关键基础设施。', website: 'https://www.checkpoint.com' },
      { name: 'SolarEdge', nameEn: 'SolarEdge', category: '电气', desc: '全球光伏逆变器与功率优化器巨头，智能能源管理系统覆盖140多个国家的屋顶光伏。', website: 'https://www.solaredge.com' },
    ],
  },
  {
    id: 'za', mapName: 'South Africa', name: '南非', nameEn: 'South Africa', flag: '🇿🇦',
    lat: -29.0, lon: 25.0, labelX: 576, labelY: 334,
    enterprises: [
      { name: '英美资源', nameEn: 'Anglo American', category: '机械', desc: '全球多元化矿业巨头，铂族金属与钻石（戴比尔斯）产量世界第一，氢能矿卡试点引领绿色采矿。', website: 'https://www.angloamerican.com' },
      { name: '萨索尔', nameEn: 'Sasol', category: '电气', desc: '全球煤制油技术领导者，费托合成工艺工业化标杆，正转型绿氢与可持续航空燃料生产。', website: 'https://www.sasol.com' },
      { name: 'Barloworld', nameEn: 'Barloworld', category: '机械', desc: '南部非洲最大工业设备分销商，卡特彼勒代理商，物流与农业设备服务覆盖十余个非洲国家。', website: 'https://www.barloworld.com' },
      { name: 'Denel', nameEn: 'Denel', category: '机械', desc: '南非国有防务集团，"茶隼"武装直升机与RG系列防雷车闻名，火炮系统出口中东与亚洲。', website: 'https://www.denel.co.za' },
      { name: 'MTN集团', nameEn: 'MTN Group', category: '计算机', desc: '非洲最大电信运营商，2.9亿用户覆盖19国，5G与移动支付Momo推动非洲数字基础设施建设。', website: 'https://www.mtn.com' },
      { name: 'Aerobotics', nameEn: 'Aerobotics', category: 'AI', desc: '农业无人机AI独角兽，果树健康与产量预测算法服务全球农场主，精准农业数据平台领先非洲。', website: 'https://www.aerobotics.com' },
    ],
  },
  /* ---------- 中东 ---------- */
  {
    id: 'sa', mapName: 'Saudi Arabia', name: '沙特阿拉伯', nameEn: 'Saudi Arabia', flag: '🇸🇦',
    lat: 24.0, lon: 45.0, labelX: 622, labelY: 203,
    enterprises: [
      { name: '沙特阿美', nameEn: 'Saudi Aramco', category: '电气', desc: '全球最大石油公司，原油产能与低碳强度领先，投资氢能、CCUS与大型炼化一体化。', website: 'https://www.aramco.com' },
      { name: 'SABIC', nameEn: 'SABIC', category: '电气', desc: '全球顶级石化企业，聚烯烃与工程塑料技术领先，为汽车轻量化与电子电器提供材料方案。', website: 'https://www.sabic.com' },
      { name: 'Ma\'aden', nameEn: 'Ma\'aden', category: '机械', desc: '中东最大矿业公司，金、铜、磷酸盐与铝产业链一体化，正扩建锂与稀土项目。', website: 'https://www.maaden.com.sa' },
      { name: 'NEOM', nameEn: 'NEOM', category: '计算机', desc: '沙特未来新城项目，聚焦智慧城市、绿氢与先进制造，是中东最大工业投资平台之一。', website: 'https://www.neom.com' },
      { name: 'Alfanar', nameEn: 'Alfanar', category: '电气', desc: '中东电气设备与EPC巨头，变压器、开关柜与新能源电站总包服务覆盖30多国。', website: 'https://www.alfanar.com' },
      { name: '沙特铁路', nameEn: 'Saudi Arabia Railways', category: '机械', desc: '运营南北铁路与麦加高铁，连接利雅得、达曼与圣城，是海湾轨道交通骨干。', website: 'https://www.sar.com.sa' },
    ],
  },
  {
    id: 'ma', mapName: 'Morocco', name: '摩洛哥', nameEn: 'Morocco', flag: '🇲🇦',
    lat: 31.5, lon: -7.0, labelX: 468, labelY: 182, labelAnchor: 'end',
    enterprises: [
      { name: 'OCP集团', nameEn: 'OCP Group', category: '机械', desc: '全球最大磷酸盐与磷肥生产商，掌控全球约70%磷矿储量，正推进绿氢制氨。', website: 'https://www.ocpgroup.ma' },
      { name: 'Managem', nameEn: 'Managem', category: '机械', desc: '摩洛哥矿业集团，钴、铜、银与金矿开采，为电池产业链供应关键金属。', website: 'https://www.managemgroup.com' },
      { name: 'Maghreb Steel', nameEn: 'Maghreb Steel', category: '机械', desc: '摩洛哥最大冷轧与镀锌板材生产商，服务建筑与汽车制造。', website: 'https://www.maghrebsteel.com' },
      { name: 'SOMACA', nameEn: 'SOMACA', category: '汽车', desc: '摩洛哥整车组装厂，雷诺与Stellantis本地化生产基地，带动摩洛哥汽车出口位居非洲第一。', website: 'https://www.renaultgroup.com' },
      { name: 'MASEN', nameEn: 'MASEN', category: '电气', desc: '摩洛哥可再生能源机构，努尔光热电站群全球规模最大，支撑2030年绿电目标。', website: 'https://www.masen.ma' },
    ],
  },
  {
    id: 'eg', mapName: 'Egypt', name: '埃及', nameEn: 'Egypt', flag: '🇪🇬',
    lat: 26.0, lon: 30.0, labelX: 583, labelY: 196,
    enterprises: [
      { name: 'Elsewedy Electric', nameEn: 'Elsewedy Electric', category: '电气', desc: '中东非电气设备与EPC龙头，电缆、变压器与新能源电站总包服务覆盖非洲。', website: 'https://www.elsewedy.com' },
      { name: 'Egyptian Natural Gas', nameEn: 'EGAS', category: '电气', desc: '东地中海天然气开发与液化出口核心，Zohr大气田改变区域能源格局。', website: 'https://www.egas.com.eg' },
      { name: 'Alexandria Shipyard', nameEn: 'Alexandria Shipyard', category: '机械', desc: '埃及最大船厂，商船建造与修船服务地中海航运。', website: 'https://www.alexshipyard.gov.eg' },
      { name: 'El Nasr Automotive', nameEn: 'El Nasr Automotive', category: '汽车', desc: '埃及国有汽车制造企业，乘用车与商用车本地组装，配套本地供应链。', website: 'https://www.nasr.com.eg' },
      { name: 'Hassan Allam', nameEn: 'Hassan Allam Holding', category: '机械', desc: '埃及最大工程总承包集团，承建电站、交通与新城基础设施。', website: 'https://www.hassanallam.com' },
    ],
  },
  {
    id: 'tr', mapName: 'Turkey', name: '土耳其', nameEn: 'Türkiye', flag: '🇹🇷',
    lat: 39.0, lon: 35.0, labelX: 612, labelY: 158, labelAnchor: 'start',
    enterprises: [
      { name: 'Koç控股', nameEn: 'Koç Holding', category: '汽车', desc: '土耳其最大工业集团，Arçelik家电、Ford Otosan与Tofaş汽车合资布局全球。', website: 'https://www.koc.com.tr' },
      { name: '土耳其航空航天', nameEn: 'Turkish Aerospace', category: '机械', desc: 'KAAN五代机、Hürjet教练机与直升机项目主承包商，无人机与航电快速突破。', website: 'https://www.tusas.com' },
      { name: 'ASELSAN', nameEn: 'ASELSAN', category: '电气', desc: '土耳其最大防务电子企业，雷达、电子战与无人机航电系统出口多国。', website: 'https://www.aselsan.com' },
      { name: 'Arçelik', nameEn: 'Arçelik', category: '电气', desc: '欧洲家电巨头Beko母公司，全球白电产能与能效技术领先。', website: 'https://www.arcelikglobal.com' },
      { name: 'Ford Otosan', nameEn: 'Ford Otosan', category: '汽车', desc: '福特与Koç合资，土耳其最大汽车出口企业，电动商用车与电池包本地化。', website: 'https://www.fordotosan.com.tr' },
      { name: 'Tofaş', nameEn: 'Tofaş', category: '汽车', desc: 'Stellantis与Koç合资，菲亚特与标致车型土耳其生产基地。', website: 'https://www.tofas.com.tr' },
    ],
  },
  {
    id: 'ir', mapName: 'Iran', name: '伊朗', nameEn: 'Iran', flag: '🇮🇷',
    lat: 32.0, lon: 53.0, labelX: 652, labelY: 144, labelAnchor: 'start',
    enterprises: [
      { name: 'Iran Khodro', nameEn: 'Iran Khodro', category: '汽车', desc: '伊朗最大汽车制造商，轿车与商用车本地化生产，区域市场保有量领先。', website: 'https://www.ikco.ir' },
      { name: 'SAIPA', nameEn: 'SAIPA', category: '汽车', desc: '伊朗第二大汽车集团，乘用车与零部件制造，覆盖中东与周边市场。', website: 'https://www.saipa.ir' },
      { name: 'MAPNA', nameEn: 'MAPNA Group', category: '电气', desc: '伊朗能源装备集团，燃气轮机、汽轮机与电站EPC，区域电力建设主力。', website: 'https://www.mapnagroup.com' },
      { name: '伊朗航空', nameEn: 'Iran Air', category: '机械', desc: '伊朗国家航空，区域航线与机队维护，承担国际客货运。', website: 'https://www.iranair.com' },
    ],
  },
  {
    id: 'qa', mapName: 'Qatar', name: '卡塔尔', nameEn: 'Qatar', flag: '🇶🇦',
    lat: 25.3, lon: 51.2, hideLabel: true,
    enterprises: [
      { name: 'QatarEnergy', nameEn: 'QatarEnergy', category: '电气', desc: '卡塔尔国家能源公司，全球最大LNG出口商之一，North Field扩产项目规模空前。', website: 'https://www.qatarenergy.qa' },
      { name: '卡塔尔航空', nameEn: 'Qatar Airways', category: '机械', desc: '全球航线网络与航空货运巨头，机队现代化与服务品质行业领先。', website: 'https://www.qatarairways.com' },
      { name: 'Ooredoo', nameEn: 'Ooredoo', category: '计算机', desc: '卡塔尔电信集团，5G与数据中心服务中东、东南亚多国。', website: 'https://www.ooredoo.com' },
      { name: 'Qatar Steel', nameEn: 'Qatar Steel', category: '机械', desc: '卡塔尔钢铁企业，螺纹钢与直接还原铁生产，供应海湾基建市场。', website: 'https://www.qatarsteel.com.qa' },
    ],
  },
  {
    id: 'kw', mapName: 'Kuwait', name: '科威特', nameEn: 'Kuwait', flag: '🇰🇼',
    lat: 29.5, lon: 47.5, hideLabel: true,
    enterprises: [
      { name: 'KPC', nameEn: 'Kuwait Petroleum Corporation', category: '电气', desc: '科威特国家石油公司，上游勘探与全球炼化销售网络一体化。', website: 'https://www.kpc.com.kw' },
      { name: 'Zain', nameEn: 'Zain Group', category: '计算机', desc: '科威特电信集团，5G网络覆盖中东与非洲多国，数字服务持续扩张。', website: 'https://www.zain.com' },
      { name: '科威特航空', nameEn: 'Kuwait Airways', category: '机械', desc: '科威特国家航空，区域与国际航线运营，机队更新推进。', website: 'https://www.kuwaitairways.com' },
    ],
  },
  {
    id: 'om', mapName: 'Oman', name: '阿曼', nameEn: 'Oman', flag: '🇴🇲',
    lat: 21.0, lon: 57.0, hideLabel: true,
    enterprises: [
      { name: 'OQ', nameEn: 'OQ', category: '电气', desc: '阿曼国家能源集团，油气、炼化与新能源一体化布局。', website: 'https://www.oq.com' },
      { name: 'Oman LNG', nameEn: 'Oman LNG', category: '电气', desc: '阿曼LNG出口公司，长期供应亚洲与欧洲市场，是海湾液化天然气重要来源。', website: 'https://www.omanlng.com' },
      { name: 'Asyad', nameEn: 'Asyad Group', category: '机械', desc: '阿曼物流与港口集团，码头、航运与供应链服务辐射印度洋航线。', website: 'https://www.asyad.com' },
    ],
  },
  {
    id: 'dz', mapName: 'Algeria', name: '阿尔及利亚', nameEn: 'Algeria', flag: '🇩🇿',
    lat: 28.0, lon: 2.5, labelX: 487, labelY: 192, labelAnchor: 'end',
    enterprises: [
      { name: 'Sonatrach', nameEn: 'Sonatrach', category: '电气', desc: '阿尔及利亚国家石油公司，天然气出口与炼化一体化，非洲最大能源企业。', website: 'https://www.sonatrach.com' },
      { name: 'Sonelgaz', nameEn: 'Sonelgaz', category: '电气', desc: '阿尔及利亚电力与燃气集团，发电、输配电与可再生能源项目建设。', website: 'https://www.sonelgaz.dz' },
      { name: 'Cevital', nameEn: 'Cevital', category: '机械', desc: '阿尔及利亚最大私营工业集团，食品加工、家电与汽车制造多元布局。', website: 'https://www.cevital.com' },
    ],
  },
  {
    id: 'ng', mapName: 'Nigeria', name: '尼日利亚', nameEn: 'Nigeria', flag: '🇳🇬',
    lat: 10.0, lon: 8.0, labelX: 522, labelY: 241,
    enterprises: [
      { name: 'Dangote Cement', nameEn: 'Dangote Cement', category: '机械', desc: '非洲最大水泥生产商，泛非工厂网络与物流体系，支撑非洲基建。', website: 'https://www.dangotecement.com' },
      { name: 'NNPC', nameEn: 'NNPC Group', category: '电气', desc: '尼日利亚国家石油公司，油气勘探、炼化与LNG出口核心。', website: 'https://www.nnpcgroup.com' },
      { name: 'Bua Group', nameEn: 'Bua Group', category: '机械', desc: '尼日利亚建材与食品集团，水泥、糖业与港口物流一体化。', website: 'https://www.buagroup.com' },
      { name: 'MainOne', nameEn: 'MainOne', category: '计算机', desc: '西非海底光缆与数据中心运营商，企业云与网络服务覆盖西非。', website: 'https://www.mainone.net' },
    ],
  },
  {
    id: 'ke', mapName: 'Kenya', name: '肯尼亚', nameEn: 'Kenya', flag: '🇰🇪',
    lat: 0.0, lon: 38.0, labelX: 606, labelY: 269,
    enterprises: [
      { name: 'Safaricom', nameEn: 'Safaricom', category: '计算机', desc: '肯尼亚最大电信运营商，M-Pesa移动支付全球标杆，5G网络加速覆盖。', website: 'https://www.safaricom.co.ke' },
      { name: 'KenGen', nameEn: 'KenGen', category: '电气', desc: '肯尼亚最大发电企业，地热与水电装机领先非洲，清洁能源占比高。', website: 'https://www.kengen.co.ke' },
      { name: 'Bamburi Cement', nameEn: 'Holcim Kenya', category: '机械', desc: '肯尼亚水泥龙头，基建材料供应东非，低碳水泥技术推进。', website: 'https://www.holcim.com' },
      { name: 'Kenya Railways', nameEn: 'Kenya Railways', category: '机械', desc: '肯尼亚铁路公司，蒙内铁路运营与东非物流枢纽建设。', website: 'https://www.krc.co.ke' },
    ],
  },
  /* ---------- 欧洲 ---------- */
  {
    id: 'ru', mapName: 'Russia', name: '俄罗斯', nameEn: 'Russia', flag: '🇷🇺',
    lat: 58.0, lon: 40.0, labelX: 630, labelY: 82, labelAnchor: 'start',
    enterprises: [
      { name: '俄罗斯国家原子能', nameEn: 'Rosatom', category: '电气', desc: '全球核电建设订单最多，VVER技术与小型模块化反应堆出口领先。', website: 'https://www.rosatom.ru' },
      { name: 'Rostec', nameEn: 'Rostec', category: '机械', desc: '俄罗斯最大工业与防务集团，航空发动机、直升机与电子战装备整合平台。', website: 'https://rostec.ru' },
      { name: 'Gazprom', nameEn: 'Gazprom', category: '电气', desc: '全球最大天然气生产商之一，管道与LNG出口网络覆盖欧亚。', website: 'https://www.gazprom.com' },
      { name: 'Yandex', nameEn: 'Yandex', category: '计算机', desc: '俄罗斯最大互联网与AI公司，搜索、自动驾驶与云服务技术自主。', website: 'https://yandex.com' },
      { name: 'Kaspersky', nameEn: 'Kaspersky', category: '计算机', desc: '全球网络安全厂商，工业控制系统防护与威胁情报服务覆盖200多国。', website: 'https://www.kaspersky.com' },
      { name: '联合发动机', nameEn: 'United Engine Corporation', category: '机械', desc: '俄罗斯航空发动机整合企业，PD-14与军用发动机核心供应商。', website: 'https://www.uec.ru' },
    ],
  },
  {
    id: 'kz', mapName: 'Kazakhstan', name: '哈萨克斯坦', nameEn: 'Kazakhstan', flag: '🇰🇿',
    lat: 48.0, lon: 68.0, labelX: 689, labelY: 136,
    enterprises: [
      { name: 'KazMunayGas', nameEn: 'KazMunayGas', category: '电气', desc: '哈萨克斯坦国家油气公司，里海油田开发与炼化一体化。', website: 'https://www.kmg.kz' },
      { name: 'Kazatomprom', nameEn: 'Kazatomprom', category: '电气', desc: '全球最大铀生产商，占全球天然铀产量约20%，核燃料循环布局完整。', website: 'https://www.kazatomprom.kz' },
      { name: 'ERG', nameEn: 'Eurasian Resources Group', category: '机械', desc: '铬、铁合金与铝土矿开采，全球铬铁龙头，产业链覆盖欧亚。', website: 'https://www.erg.kz' },
      { name: 'Kazzinc', nameEn: 'Kazzinc', category: '机械', desc: '哈萨克斯坦锌铜铅生产企业，贵金属回收与精炼技术领先。', website: 'https://www.kazzinc.com' },
    ],
  },
  {
    id: 'uz', mapName: 'Uzbekistan', name: '乌兹别克斯坦', nameEn: 'Uzbekistan', flag: '🇺🇿',
    lat: 41.0, lon: 64.0, hideLabel: true,
    enterprises: [
      { name: 'UzAuto Motors', nameEn: 'UzAuto Motors', category: '汽车', desc: '乌兹别克斯坦最大汽车制造商，雪佛兰本地化生产与出口。', website: 'https://www.uzautomotors.com' },
      { name: 'Navoi Mining', nameEn: 'Navoi Mining', category: '机械', desc: '乌兹别克斯坦最大黄金矿业公司，Muruntau金矿单体规模全球领先。', website: 'https://www.ngmk.uz' },
      { name: '乌兹别克航空技术', nameEn: 'Uzbekistan Airways Technics', category: '机械', desc: '乌兹别克斯坦航空维修企业，波音与空客机队MRO。', website: 'https://www.uzairways.com' },
    ],
  },
  {
    id: 'az', mapName: 'Azerbaijan', name: '阿塞拜疆', nameEn: 'Azerbaijan', flag: '🇦🇿',
    lat: 40.5, lon: 47.5, hideLabel: true,
    enterprises: [
      { name: 'SOCAR', nameEn: 'SOCAR', category: '电气', desc: '阿塞拜疆国家石油公司，里海油气开发与炼化，跨安纳托利亚管道股东。', website: 'https://www.socar.az' },
      { name: '阿塞拜疆航空', nameEn: 'Azerbaijan Airlines', category: '机械', desc: '阿塞拜疆国家航空，区域航线与货运连接欧亚。', website: 'https://www.azal.az' },
    ],
  },
  {
    id: 'ua', mapName: 'Ukraine', name: '乌克兰', nameEn: 'Ukraine', flag: '🇺🇦',
    lat: 49.0, lon: 31.0, hideLabel: true,
    enterprises: [
      { name: '安东诺夫', nameEn: 'Antonov', category: '机械', desc: '安托诺夫设计局，安-124等重型运输机研制者，航空货运与特种机型领先。', website: 'https://www.antonov.com' },
      { name: '马达西奇', nameEn: 'Motor Sich', category: '机械', desc: '乌克兰航空发动机与直升机发动机制造商，中小推力涡桨/涡扇技术积累深厚。', website: 'https://www.motorsich.com' },
      { name: 'Metinvest', nameEn: 'Metinvest', category: '机械', desc: '乌克兰最大钢铁与矿业集团，铁矿石与钢材出口全球。', website: 'https://metinvestholding.com' },
      { name: 'Ajax Systems', nameEn: 'Ajax Systems', category: '计算机', desc: '乌克兰智能安防硬件企业，无线报警与工业安防系统出口120多国。', website: 'https://ajax.systems' },
    ],
  },
  {
    id: 'pl', mapName: 'Poland', name: '波兰', nameEn: 'Poland', flag: '🇵🇱',
    lat: 52.0, lon: 19.0, hideLabel: true,
    enterprises: [
      { name: 'Solaris Bus', nameEn: 'Solaris Bus & Coach', category: '汽车', desc: '欧洲电动巴士龙头，纯电与氢燃料巴士交付欧洲数十城市。', website: 'https://www.solarisbus.com' },
      { name: 'Pesa', nameEn: 'Pesa Bydgoszcz', category: '机械', desc: '波兰轨道车辆制造商，电车、区域列车与高速列车出口欧洲。', website: 'https://www.pesa.pl' },
      { name: 'Grupa Azoty', nameEn: 'Grupa Azoty', category: '电气', desc: '波兰最大化工集团，化肥、工程塑料与氢能项目布局。', website: 'https://grupaazoty.com' },
      { name: 'WB Group', nameEn: 'WB Group', category: '计算机', desc: '波兰防务电子与无人机集团，FlyEye无人机与指挥系统装备北约。', website: 'https://www.wbgroup.pl' },
    ],
  },
  {
    id: 'pt', mapName: 'Portugal', name: '葡萄牙', nameEn: 'Portugal', flag: '🇵🇹',
    lat: 39.5, lon: -8.0, hideLabel: true,
    enterprises: [
      { name: 'EDP', nameEn: 'EDP', category: '电气', desc: '葡萄牙能源巨头，风电、光伏与电网资产覆盖欧美，全球可再生能源开发商前列。', website: 'https://www.edp.com' },
      { name: 'Galp', nameEn: 'Galp', category: '电气', desc: '葡萄牙油气与新能源企业，深水油田与绿氢、锂电材料项目并进。', website: 'https://www.galp.com' },
      { name: 'Amorim', nameEn: 'Corticeira Amorim', category: '机械', desc: '全球软木材料龙头，软木塞、隔音与复合材料出口100多国。', website: 'https://www.amorim.com' },
    ],
  },
  {
    id: 'at', mapName: 'Austria', name: '奥地利', nameEn: 'Austria', flag: '🇦🇹',
    lat: 47.5, lon: 14.5, hideLabel: true,
    enterprises: [
      { name: '安德里茨', nameEn: 'Andritz', category: '机械', desc: '全球水电、制浆造纸与金属加工设备龙头，氢电解与环保装备技术领先。', website: 'https://www.andritz.com' },
      { name: '奥钢联', nameEn: 'voestalpine', category: '机械', desc: '奥地利钢铁技术集团，汽车用高强钢、轨道与特种型材全球供应。', website: 'https://www.voestalpine.com' },
      { name: 'KTM', nameEn: 'KTM', category: '汽车', desc: '奥地利高性能摩托车品牌，越野与街车产品线，电动化平台推进。', website: 'https://www.ktm.com' },
      { name: 'AVL', nameEn: 'AVL List', category: '汽车', desc: '全球动力总成开发与测试服务商，电驱、电池与氢燃料系统研发工具链领先。', website: 'https://www.avl.com' },
    ],
  },
  {
    id: 'be', mapName: 'Belgium', name: '比利时', nameEn: 'Belgium', flag: '🇧🇪',
    lat: 50.5, lon: 4.5, hideLabel: true,
    enterprises: [
      { name: '优美科', nameEn: 'Umicore', category: '电气', desc: '全球电池正极材料与贵金属回收龙头，闭环材料技术支撑欧洲电池产业链。', website: 'https://www.umicore.com' },
      { name: '索尔维', nameEn: 'Solvay', category: '电气', desc: '比利时化工集团，特种聚合物、稀土与电池材料服务航空与新能源。', website: 'https://www.solvay.com' },
      { name: '贝卡尔特', nameEn: 'Bekaert', category: '机械', desc: '全球钢帘线与钢丝技术龙头，轮胎增强材料与光伏切割丝市占率领先。', website: 'https://www.bekaert.com' },
      { name: 'Agfa', nameEn: 'Agfa-Gevaert', category: '计算机', desc: '影像与工业喷墨材料企业，医疗影像与印刷电子技术积累深厚。', website: 'https://www.agfa.com' },
    ],
  },
  {
    id: 'cz', mapName: 'Czechia', name: '捷克', nameEn: 'Czechia', flag: '🇨🇿',
    lat: 49.8, lon: 15.5, hideLabel: true,
    enterprises: [
      { name: '斯柯达', nameEn: 'Škoda Auto', category: '汽车', desc: '捷克最大汽车制造商，大众集团旗下，电动车型与全球出口网络完善。', website: 'https://www.skoda-auto.com' },
      { name: '太脱拉', nameEn: 'Tatra Trucks', category: '汽车', desc: '捷克重型越野卡车制造商，太脱拉底盘技术用于矿山与军用领域。', website: 'https://www.tatratrucks.com' },
      { name: 'Doosan Škoda Power', nameEn: 'Doosan Škoda Power', category: '电气', desc: '捷克汽轮机与电站设备制造商，核电与工业驱动设备出口全球。', website: 'https://www.doosanskodapower.com' },
      { name: 'Vítkovice Steel', nameEn: 'Vítkovice Steel', category: '机械', desc: '捷克厚板与特种钢材生产商，风电与工程机械用钢。', website: 'https://www.vitkovicesteel.com' },
    ],
  },
  {
    id: 'dk', mapName: 'Denmark', name: '丹麦', nameEn: 'Denmark', flag: '🇩🇰',
    lat: 56.0, lon: 10.0, hideLabel: true,
    enterprises: [
      { name: '维斯塔斯', nameEn: 'Vestas', category: '电气', desc: '全球风电整机龙头，陆上与海上风机装机量世界第一，服务网络覆盖80多国。', website: 'https://www.vestas.com' },
      { name: 'Ørsted', nameEn: 'Ørsted', category: '电气', desc: '全球海上风电开发商龙头，从油气转型可再生能源的标杆企业。', website: 'https://orsted.com' },
      { name: '丹佛斯', nameEn: 'Danfoss', category: '电气', desc: '丹麦工业自动化与制冷空调部件巨头，变频器与热泵技术全球领先。', website: 'https://www.danfoss.com' },
      { name: '格兰富', nameEn: 'Grundfos', category: '机械', desc: '全球水泵龙头，智能水泵与水务系统节能方案覆盖工业与建筑。', website: 'https://www.grundfos.com' },
    ],
  },
  {
    id: 'fi', mapName: 'Finland', name: '芬兰', nameEn: 'Finland', flag: '🇫🇮',
    lat: 64.0, lon: 26.0, hideLabel: true,
    enterprises: [
      { name: '诺基亚', nameEn: 'Nokia', category: '计算机', desc: '全球通信设备三强，5G/6G基站与光网络，工业专网与专利授权业务领先。', website: 'https://www.nokia.com' },
      { name: '通力', nameEn: 'Kone', category: '机械', desc: '全球电梯与自动扶梯巨头，智慧楼宇客流系统与维保服务全球领先。', website: 'https://www.kone.com' },
      { name: '瓦锡兰', nameEn: 'Wärtsilä', category: '机械', desc: '全球船舶动力与能源设备商，双燃料发动机与储能系统推动航运脱碳。', website: 'https://www.wartsila.com' },
      { name: '美卓', nameEn: 'Metso', category: '机械', desc: '全球矿山破碎筛分与冶金设备龙头，服务全球矿业与骨料客户。', website: 'https://www.metso.com' },
      { name: '维美德', nameEn: 'Valmet', category: '机械', desc: '制浆造纸与能源设备供应商，自动化系统覆盖全球纸厂。', website: 'https://www.valmet.com' },
    ],
  },
  {
    id: 'no', mapName: 'Norway', name: '挪威', nameEn: 'Norway', flag: '🇳🇴',
    lat: 62.0, lon: 9.0, labelX: 505, labelY: 60, labelAnchor: 'end',
    enterprises: [
      { name: 'Equinor', nameEn: 'Equinor', category: '电气', desc: '挪威国家能源公司，北海油气与海上风电并重，CCS与氢能项目领先。', website: 'https://www.equinor.com' },
      { name: '康斯伯格', nameEn: 'Kongsberg Gruppen', category: '机械', desc: '挪威防务与海事技术集团，无人舰艇、海事自动化与卫星导航系统全球领先。', website: 'https://www.kongsberg.com' },
      { name: '海德鲁', nameEn: 'Norsk Hydro', category: '机械', desc: '全球铝业巨头，水电铝一体化与低碳铝品牌，汽车与建筑型材供应。', website: 'https://www.hydro.com' },
      { name: 'Yara', nameEn: 'Yara', category: '电气', desc: '全球氮肥与工业气体龙头，绿色氨与精准农业方案推动农业脱碳。', website: 'https://www.yara.com' },
      { name: 'Aker Solutions', nameEn: 'Aker Solutions', category: '机械', desc: '挪威海工装备与海底生产系统供应商，深水油气与海上风电基础。', website: 'https://www.akersolutions.com' },
    ],
  },
  {
    id: 'ie', mapName: 'Ireland', name: '爱尔兰', nameEn: 'Ireland', flag: '🇮🇪',
    lat: 53.0, lon: -8.0, hideLabel: true,
    enterprises: [
      { name: 'Kingspan', nameEn: 'Kingspan', category: '机械', desc: '全球建筑保温材料龙头，绝热板与冷库系统服务低碳建筑。', website: 'https://www.kingspan.com' },
      { name: 'Dublin Aerospace', nameEn: 'Dublin Aerospace', category: '机械', desc: '爱尔兰航空维修MRO企业，空客与波音机队维修改装。', website: 'https://www.dublinaerospace.com' },
      { name: 'Mainstream', nameEn: 'Mainstream Renewable Power', category: '电气', desc: '爱尔兰全球可再生能源开发商，风电与光伏项目遍布新兴市场。', website: 'https://www.mainstreamrp.com' },
      { name: 'Kerry Group', nameEn: 'Kerry Group', category: '电气', desc: '全球食品配料与乳制品企业，工业发酵与植物基蛋白技术。', website: 'https://www.kerrygroup.com' },
    ],
  },
  {
    id: 'ro', mapName: 'Romania', name: '罗马尼亚', nameEn: 'Romania', flag: '🇷🇴',
    lat: 46.0, lon: 25.0, hideLabel: true,
    enterprises: [
      { name: '达契亚', nameEn: 'Dacia', category: '汽车', desc: '雷诺集团罗马尼亚品牌，欧洲高性价比汽车，Mioveni工厂电动化改造。', website: 'https://www.dacia.com' },
      { name: 'Bitdefender', nameEn: 'Bitdefender', category: '计算机', desc: '罗马尼亚网络安全企业，终端防护与云安全服务覆盖全球。', website: 'https://www.bitdefender.com' },
      { name: 'Romaero', nameEn: 'Romaero', category: '机械', desc: '罗马尼亚航空制造与MRO企业，机体结构件与军机维修。', website: 'https://www.romaero.com' },
      { name: 'Electrica', nameEn: 'Electrica', category: '电气', desc: '罗马尼亚国有电力集团，配电与新能源投资覆盖全国。', website: 'https://www.electrica.ro' },
    ],
  },
  {
    id: 'hu', mapName: 'Hungary', name: '匈牙利', nameEn: 'Hungary', flag: '🇭🇺',
    lat: 47.0, lon: 19.5, hideLabel: true,
    enterprises: [
      { name: '奥迪匈牙利', nameEn: 'Audi Hungaria', category: '汽车', desc: '奥迪全球最大发动机工厂，匈牙利整车与电驱生产中心。', website: 'https://www.audi.com' },
      { name: 'Rába', nameEn: 'Rába', category: '汽车', desc: '匈牙利商用车与车桥制造商，重型卡车零部件供应欧洲。', website: 'https://www.raba.com' },
      { name: 'Graphisoft', nameEn: 'Graphisoft', category: '计算机', desc: '匈牙利建筑BIM软件企业，ARCHICAD全球建筑设计与协同平台。', website: 'https://www.graphisoft.com' },
      { name: 'MOL集团', nameEn: 'MOL Group', category: '电气', desc: '中东欧能源集团，炼化与石化一体化，区域加油站网络密集。', website: 'https://www.molgroup.info' },
    ],
  },
  {
    id: 'gr', mapName: 'Greece', name: '希腊', nameEn: 'Greece', flag: '🇬🇷',
    lat: 39.0, lon: 22.0, hideLabel: true,
    enterprises: [
      { name: '希腊航空航天', nameEn: 'Hellenic Aerospace Industry', category: '机械', desc: '希腊航空航天制造与MRO企业，军机部件与无人机维修。', website: 'https://www.haicorp.com' },
      { name: 'PPC', nameEn: 'Public Power Corporation', category: '电气', desc: '希腊最大电力公司，褐电转型光伏与风电，配电网络覆盖全国。', website: 'https://www.dei.gr' },
      { name: 'Motor Oil', nameEn: 'Motor Oil Hellas', category: '电气', desc: '希腊炼化与润滑油企业，地中海燃料出口与新能源投资。', website: 'https://www.moh.gr' },
    ],
  },
  /* ---------- 亚太 ---------- */
  {
    id: 'au', mapName: 'Australia', name: '澳大利亚', nameEn: 'Australia', flag: '🇦🇺',
    lat: -25.0, lon: 133.0, labelX: 884, labelY: 333, labelAnchor: 'start',
    enterprises: [
      { name: '必和必拓', nameEn: 'BHP', category: '机械', desc: '全球最大矿业集团，铁矿石、铜与煤炭资产，无人矿卡车队规模领先。', website: 'https://www.bhp.com' },
      { name: '力拓', nameEn: 'Rio Tinto', category: '机械', desc: '全球矿业巨头，铁矿石与铝、铜业务，自动驾驶运输与绿钢项目推进。', website: 'https://www.riotinto.com' },
      { name: 'Fortescue', nameEn: 'Fortescue', category: '机械', desc: '全球铁矿石巨头，绿色氢与绿铁项目大规模投资，重卡电动化试点。', website: 'https://www.fortescue.com' },
      { name: 'Woodside', nameEn: 'Woodside Energy', category: '电气', desc: '澳大利亚液化天然气出口龙头，氢能与CCS项目布局。', website: 'https://www.woodside.com' },
      { name: 'Cochlear', nameEn: 'Cochlear', category: '电气', desc: '全球植入式听力设备龙头，人工耳蜗技术覆盖100多国。', website: 'https://www.cochlear.com' },
      { name: 'Atlassian', nameEn: 'Atlassian', category: '计算机', desc: '澳大利亚协作软件巨头，Jira与Confluence服务全球软件研发团队。', website: 'https://www.atlassian.com' },
    ],
  },
  {
    id: 'nz', mapName: 'New Zealand', name: '新西兰', nameEn: 'New Zealand', flag: '🇳🇿',
    lat: -41.0, lon: 174.0, labelX: 965, labelY: 380, labelAnchor: 'end',
    enterprises: [
      { name: '恒天然', nameEn: 'Fonterra', category: '电气', desc: '全球最大乳制品出口商，乳蛋白与工业配料供应链覆盖全球。', website: 'https://www.fonterra.com' },
      { name: 'Rocket Lab', nameEn: 'Rocket Lab', category: '机械', desc: '小型运载火箭与卫星制造企业，Electron火箭高频发射与空间系统服务。', website: 'https://www.rocketlabusa.com' },
      { name: 'Fisher & Paykel', nameEn: 'Fisher & Paykel Healthcare', category: '电气', desc: '呼吸与重症监护设备制造商，全球医院呼吸治疗设备供应商。', website: 'https://www.fphcare.com' },
      { name: 'Gallagher', nameEn: 'Gallagher', category: '机械', desc: '新西兰农业科技与安防企业，智能围栏与动物管理硬件出口全球。', website: 'https://www.gallagher.com' },
    ],
  },
  {
    id: 'id', mapName: 'Indonesia', name: '印度尼西亚', nameEn: 'Indonesia', flag: '🇮🇩',
    lat: -2.0, lon: 118.0, labelX: 828, labelY: 275,
    enterprises: [
      { name: 'Astra International', nameEn: 'Astra International', category: '汽车', desc: '印尼最大多元化集团，汽车与摩托车制造、重机与能源业务。', website: 'https://www.astra.co.id' },
      { name: 'Pertamina', nameEn: 'Pertamina', category: '电气', desc: '印尼国家石油公司，油气炼化与地热新能源一体化。', website: 'https://www.pertamina.com' },
      { name: 'PLN', nameEn: 'PLN', category: '电气', desc: '印尼国家电力公司，发电与电网建设，可再生能源装机快速扩张。', website: 'https://www.pln.co.id' },
      { name: 'GoTo', nameEn: 'GoTo Group', category: '计算机', desc: '印尼最大互联网平台，出行、电商与金融科技，AI调度服务东南亚。', website: 'https://www.gotocompany.com' },
    ],
  },
  {
    id: 'th', mapName: 'Thailand', name: '泰国', nameEn: 'Thailand', flag: '🇹🇭',
    lat: 15.0, lon: 101.0, labelX: 775, labelY: 226,
    enterprises: [
      { name: 'PTT', nameEn: 'PTT Group', category: '电气', desc: '泰国国家石油集团，油气炼化与LNG进口，石化与新能源投资。', website: 'https://www.pttplc.com' },
      { name: 'SCG', nameEn: 'SCG', category: '机械', desc: '泰国最大建材与化工集团，水泥、包装与绿色聚合物技术领先。', website: 'https://www.scg.com' },
      { name: 'CP集团', nameEn: 'CP Group', category: '电气', desc: '泰国正大集团，农业食品与工业制造，饲料与水产产业链全球布局。', website: 'https://www.cpgroupglobal.com' },
      { name: '台达泰国', nameEn: 'Delta Electronics Thailand', category: '电气', desc: '台达泰国子公司，电源与散热器件制造基地，服务全球服务器与汽车客户。', website: 'https://www.deltathailand.com' },
      { name: 'Thai Summit', nameEn: 'Thai Summit', category: '汽车', desc: '泰国汽车零部件集团，车身冲压与塑料件供应日系车企。', website: 'https://www.thaisummit.co.th' },
    ],
  },
  {
    id: 'vn', mapName: 'Vietnam', name: '越南', nameEn: 'Vietnam', flag: '🇻🇳',
    lat: 21.0, lon: 106.0, labelX: 812, labelY: 190, labelAnchor: 'start',
    enterprises: [
      { name: 'VinFast', nameEn: 'VinFast', category: '汽车', desc: '越南电动车制造商，VF系列出口北美与东南亚，本土电池与充电网络布局。', website: 'https://vinfastauto.com' },
      { name: 'Viettel', nameEn: 'Viettel', category: '计算机', desc: '越南最大电信与科技集团，5G网络、数据中心与电子政务系统。', website: 'https://viettel.com.vn' },
      { name: 'Hoa Phat', nameEn: 'Hoa Phat', category: '机械', desc: '越南最大钢铁集团，热轧卷板与建筑钢材，汽车用钢产能扩张。', website: 'https://www.hoaphat.com.vn' },
      { name: 'THACO', nameEn: 'THACO', category: '汽车', desc: '越南最大汽车组装商，马自达、起亚等品牌本地化生产与商用车制造。', website: 'https://www.thaco.com.vn' },
      { name: 'FPT', nameEn: 'FPT', category: '计算机', desc: '越南IT服务与软件出口巨头，AI与半导体设计服务全球客户。', website: 'https://fpt.com.vn' },
    ],
  },
  {
    id: 'my', mapName: 'Malaysia', name: '马来西亚', nameEn: 'Malaysia', flag: '🇲🇾',
    lat: 2.0, lon: 102.0, labelX: 766, labelY: 246, labelAnchor: 'end',
    enterprises: [
      { name: 'Petronas', nameEn: 'Petronas', category: '电气', desc: '马来西亚国家石油公司，油气勘探与LNG出口，石化与新能源业务。', website: 'https://www.petronas.com' },
      { name: 'Sime Darby', nameEn: 'Sime Darby', category: '机械', desc: '马来西亚工业与汽车集团，重型设备、港口与能源服务。', website: 'https://www.simeddarby.com' },
      { name: 'Proton', nameEn: 'Proton', category: '汽车', desc: '马来西亚自主汽车品牌，吉利持股后电动化与出口加速。', website: 'https://www.proton.com' },
      { name: 'Maxis', nameEn: 'Maxis', category: '计算机', desc: '马来西亚电信运营商，5G与云服务企业客户覆盖全国。', website: 'https://www.maxis.com.my' },
    ],
  },
  {
    id: 'ph', mapName: 'Philippines', name: '菲律宾', nameEn: 'Philippines', flag: '🇵🇭',
    lat: 12.0, lon: 122.0, labelX: 854, labelY: 235, labelAnchor: 'start',
    enterprises: [
      { name: 'San Miguel', nameEn: 'San Miguel', category: '电气', desc: '菲律宾最大综合企业，食品饮料、能源与基建，石化与电力资产。', website: 'https://www.sanmiguel.com.ph' },
      { name: 'Globe Telecom', nameEn: 'Globe Telecom', category: '计算机', desc: '菲律宾电信运营商，5G与数字金融平台覆盖全国。', website: 'https://www.globe.com.ph' },
      { name: 'Petron', nameEn: 'Petron', category: '电气', desc: '菲律宾炼油与燃油零售龙头，炼化一体化与航空燃油供应。', website: 'https://www.petron.com' },
    ],
  },
  {
    id: 'pk', mapName: 'Pakistan', name: '巴基斯坦', nameEn: 'Pakistan', flag: '🇵🇰',
    lat: 30.0, lon: 69.0, labelX: 692, labelY: 187,
    enterprises: [
      { name: 'PSO', nameEn: 'Pakistan State Oil', category: '电气', desc: '巴基斯坦最大燃油营销公司，全国加油站网络与炼化供应。', website: 'https://www.psopk.com' },
      { name: '巴基斯坦航空综合', nameEn: 'Pakistan Aeronautical Complex', category: '机械', desc: '巴基斯坦航空综合企业，JF-17战机与无人机维修制造。', website: 'https://www.pac.org.pk' },
      { name: 'Engro', nameEn: 'Engro', category: '电气', desc: '巴基斯坦化肥与化工集团，尿素与聚合物生产，新能源投资。', website: 'https://www.engro.com' },
      { name: 'Millat Tractors', nameEn: 'Millat Tractors', category: '汽车', desc: '巴基斯坦拖拉机龙头，农业机械制造与出口。', website: 'https://www.millat.com.pk' },
    ],
  },
  {
    id: 'bd', mapName: 'Bangladesh', name: '孟加拉国', nameEn: 'Bangladesh', flag: '🇧🇩',
    lat: 24.0, lon: 90.0, labelX: 750, labelY: 203,
    enterprises: [
      { name: 'Walton', nameEn: 'Walton', category: '电气', desc: '孟加拉电子与家电制造龙头，冰箱、空调与摩托车本地化生产。', website: 'https://www.waltonbd.com' },
      { name: 'Grameenphone', nameEn: 'Grameenphone', category: '计算机', desc: '孟加拉最大电信运营商，5G与数字服务覆盖全国。', website: 'https://www.grameenphone.com' },
      { name: 'BEXIMCO', nameEn: 'BEXIMCO', category: '机械', desc: '孟加拉最大工业集团，纺织、制药与建材多元制造。', website: 'https://www.beximco.com' },
    ],
  },
  /* ---------- 美洲 ---------- */
  {
    id: 'ar', mapName: 'Argentina', name: '阿根廷', nameEn: 'Argentina', flag: '🇦🇷',
    lat: -35.0, lon: -64.0, labelX: 322, labelY: 366,
    enterprises: [
      { name: 'Tenaris', nameEn: 'Techint / Tenaris', category: '机械', desc: '全球无缝钢管龙头，能源管材与工程总包服务油气行业。', website: 'https://www.tenaris.com' },
      { name: 'YPF', nameEn: 'YPF', category: '电气', desc: '阿根廷国家石油公司，Vaca Muerta页岩油气开发与LNG出口规划。', website: 'https://www.ypf.com' },
      { name: 'INVAP', nameEn: 'INVAP', category: '机械', desc: '阿根廷核能与航天技术企业，研究堆出口与卫星研制。', website: 'https://www.invap.com.ar' },
      { name: 'Ternium', nameEn: 'Ternium', category: '机械', desc: '拉美钢铁巨头，阿根廷与墨西哥板材生产基地。', website: 'https://www.ternium.com' },
    ],
  },
  {
    id: 'cl', mapName: 'Chile', name: '智利', nameEn: 'Chile', flag: '🇨🇱',
    lat: -33.0, lon: -71.0, labelX: 285, labelY: 360, labelAnchor: 'end',
    enterprises: [
      { name: 'Codelco', nameEn: 'Codelco', category: '机械', desc: '全球最大铜生产商，国家控股，铜矿开采与精炼技术领先。', website: 'https://www.codelco.com' },
      { name: 'SQM', nameEn: 'SQM', category: '电气', desc: '全球锂盐与碘、钾肥龙头，阿塔卡马盐湖锂资源开发核心。', website: 'https://www.sqm.com' },
      { name: 'Antofagasta', nameEn: 'Antofagasta Minerals', category: '机械', desc: '智利铜矿集团，Los Pelambres等矿山运营，海水淡化与脱碳采矿。', website: 'https://www.antofagasta.co.uk' },
    ],
  },
  {
    id: 'co', mapName: 'Colombia', name: '哥伦比亚', nameEn: 'Colombia', flag: '🇨🇴',
    lat: 4.0, lon: -74.0, labelX: 294, labelY: 258,
    enterprises: [
      { name: 'Ecopetrol', nameEn: 'Ecopetrol', category: '电气', desc: '哥伦比亚国家石油公司，炼化与油气勘探，新能源与氢能试点。', website: 'https://www.ecopetrol.com.co' },
      { name: 'Cementos Argos', nameEn: 'Cementos Argos', category: '机械', desc: '拉美水泥与混凝土巨头，基建材料供应覆盖美洲。', website: 'https://www.argosco.com' },
      { name: 'Grupo Energía Bogotá', nameEn: 'Grupo Energía Bogotá', category: '电气', desc: '哥伦比亚电力集团，水电与输配电资产覆盖全国。', website: 'https://www.grupoenergiabogota.com' },
    ],
  },
  {
    id: 'pe', mapName: 'Peru', name: '秘鲁', nameEn: 'Peru', flag: '🇵🇪',
    lat: -10.0, lon: -75.0, labelX: 272, labelY: 296, labelAnchor: 'end',
    enterprises: [
      { name: 'Buenaventura', nameEn: 'Buenaventura', category: '机械', desc: '秘鲁最大贵金属矿业公司，金、银、铜多矿运营。', website: 'https://www.buenaventura.com' },
      { name: 'Cerro Verde', nameEn: 'Cerro Verde', category: '机械', desc: '秘鲁大型铜矿，自由港麦克莫兰运营，全球铜精矿供应主力。', website: 'https://www.fcx.com' },
      { name: 'Petroperú', nameEn: 'Petroperú', category: '电气', desc: '秘鲁国家石油公司，炼化与管道运输，Talara炼厂现代化改造。', website: 'https://www.petroperu.com.pe' },
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/* Natural Earth 名称 -> SVG path，用于高亮国家级轮廓 */
const PATH_BY_NAME = new Map(WORLD_COUNTRY_PATHS.map(c => [c.name, c.d]))

/** 注册 / 资料编辑时的国家下拉选项（与地图节点保持一致） */
export const COUNTRY_OPTIONS = COUNTRIES.map(c => ({ id: c.id, name: c.name, flag: c.flag }))

export default function WorldMap({ onClose, users }: WorldMapProps) {
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

  const dotOf = (c: Country) => ({ x: px(c.lon), y: py(c.lat) })

  // Group enterprises by category for the detail panel
  const grouped = useMemo(() => {
    if (!selected) return [] as { category: EnterpriseCategory; items: Enterprise[] }[]
    return CATEGORY_ORDER.map(category => ({
      category,
      items: selected.enterprises.filter(e => e.category === category),
    })).filter(g => g.items.length > 0)
  }, [selected])

  const totalEnterprises = COUNTRIES.reduce((n, c) => n + c.enterprises.length, 0)

  // 当前选中国家的本站注册用户数
  const registeredCount = useMemo(() => {
    if (!selected) return 0
    return (users || []).filter(u => u.country === selected.id).length
  }, [selected, users])

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
            <span className="wm-node-count">{COUNTRIES.length} 节点 · {totalEnterprises} 企业</span>
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
              {/* Standard world map — Natural Earth country outlines */}
              {WORLD_COUNTRY_PATHS.map(c => (
                <path key={c.name} d={c.d} className="wm-continent" />
              ))}

              {/* Network links */}
              {LINKS.map(([a, b], i) => {
                const ca = COUNTRIES.find(c => c.id === a)
                const cb = COUNTRIES.find(c => c.id === b)
                if (!ca || !cb) return null
                const pa = dotOf(ca)
                const pb = dotOf(cb)
                return (
                  <line
                    key={`link-${i}`}
                    x1={pa.x}
                    y1={pa.y}
                    x2={pb.x}
                    y2={pb.y}
                    className="wm-link"
                  />
                )
              })}

              {/* Highlighted (clickable) countries */}
              {COUNTRIES.map(c => {
                const d = PATH_BY_NAME.get(c.mapName)
                if (!d) return null
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
                    d={d}
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
                const p = dotOf(c)
                return (
                  <g key={`dot-${c.id}`} className="wm-node-group" style={{ animationDelay: `${(i % 5) * 0.4}s` }}>
                    <circle cx={p.x} cy={p.y} r="6" className={`wm-dot-ring ${isSel ? 'wm-dot-ring-sel' : ''}`} />
                    <circle
                      cx={p.x} cy={p.y} r="2.4"
                      className={`wm-dot-core ${isSel ? 'wm-dot-core-sel' : ''}`}
                      onClick={() => setSelectedId(c.id)}
                      style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                    >
                      <title>{c.name}</title>
                    </circle>
                    {!c.hideLabel && (
                      <text
                        x={c.labelX ?? 0}
                        y={c.labelY ?? 0}
                        textAnchor={c.labelAnchor ?? 'middle'}
                        className={`wm-country-label ${isSel ? 'wm-country-label-sel' : ''}`}
                      >
                        {c.name}
                      </text>
                    )}
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
              <span className="wm-legend-coord">EQUIRECTANGULAR · NATURAL EARTH 1:50m</span>
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
                  <div className="wm-detail-stats">
                    <span className="wm-detail-count">{selected.enterprises.length} 企业</span>
                    <span className="wm-detail-count wm-detail-count-user">注册用户 {registeredCount} 人</span>
                  </div>
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
                          <a
                            className="wm-enterprise-link"
                            href={e.website}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            访问官网 ↗
                          </a>
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
