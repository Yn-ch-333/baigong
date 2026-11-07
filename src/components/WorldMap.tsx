import { useState, useEffect, useMemo } from 'react'
import type { User } from '../types'
import { IconClose } from '../icons'
import { WORLD_COUNTRY_PATHS } from '../data/worldMapPaths'
import GlobeCanvas from './GlobeCanvas'
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
  /* 扩充后补充的全球连线 */
  ['cn', 'vn'],
  ['cn', 'th'],
  ['cn', 'id'],
  ['cn', 'my'],
  ['cn', 'ru'],
  ['cn', 'kz'],
  ['cn', 'sa'],
  ['cn', 'za'],
  ['cn', 'br'],
  ['us', 'jp'],
  ['us', 'de'],
  ['us', 'in'],
  ['us', 'au'],
  ['us', 'kr'],
  ['de', 'pl'],
  ['de', 'cz'],
  ['de', 'at'],
  ['de', 'dk'],
  ['fr', 'be'],
  ['uk', 'ie'],
  ['es', 'pt'],
  ['it', 'gr'],
  ['ru', 'by'],
  ['ru', 'kz'],
  ['in', 'bd'],
  ['in', 'lk'],
  ['in', 'np'],
  ['ir', 'tr'],
  ['tr', 'ge'],
  ['eg', 'za'],
  ['br', 'ar'],
  ['br', 'cl'],
  ['mx', 'co'],
  ['mx', 'pe'],
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
  /* ---------- 欧洲（扩充） ---------- */
  {
    id: 'rs', mapName: 'Serbia', name: '塞尔维亚', nameEn: 'Serbia', flag: '🇷🇸',
    lat: 44.0, lon: 20.9,
    enterprises: [
      { name: '塞尔维亚电力', nameEn: 'EPS', category: '电气', desc: '塞尔维亚国家电力公司，燃煤与水电装机覆盖全国，主导电网调度与供电。', website: 'https://www.eps.rs' },
      { name: '扎斯塔瓦武器', nameEn: 'Zastava Arms', category: '机械', desc: '塞尔维亚老牌军工机械企业，枪械与精密机械制造，产品出口多国。', website: 'https://www.zastava-arms.rs' },
      { name: '塞尔维亚电信', nameEn: 'Telekom Srbija', category: '计算机', desc: '塞尔维亚最大电信运营商，移动、宽带与数据中心业务覆盖巴尔干。', website: 'https://www.telekom.rs' },
    ],
  },
  {
    id: 'hr', mapName: 'Croatia', name: '克罗地亚', nameEn: 'Croatia', flag: '🇭🇷',
    lat: 45.3, lon: 15.9,
    enterprises: [
      { name: 'Rimac', nameEn: 'Rimac Automobili', category: '汽车', desc: '电动超跑与高性能电驱系统制造商，与保时捷合资运营布加迪 Rimac。', website: 'https://www.rimac-automobili.com' },
      { name: '康查尔', nameEn: 'Končar', category: '电气', desc: '克罗地亚电气装备集团，变压器、牵引电机与可再生能源并网设备。', website: 'https://www.koncar.hr' },
      { name: 'Infobip', nameEn: 'Infobip', category: '计算机', desc: '全球通信平台服务商，短信、邮件与全渠道客户互动 API 覆盖 190 多国。', website: 'https://www.infobip.com' },
    ],
  },
  {
    id: 'sk', mapName: 'Slovakia', name: '斯洛伐克', nameEn: 'Slovakia', flag: '🇸🇰',
    lat: 48.7, lon: 19.5,
    enterprises: [
      { name: '大众斯洛伐克', nameEn: 'Volkswagen Slovakia', category: '汽车', desc: '大众集团布拉迪斯拉发工厂，生产途锐、Q7 等高端 SUV 与保时捷车身。', website: 'https://www.volkswagen.sk' },
      { name: '起亚斯洛伐克', nameEn: 'Kia Slovakia', category: '汽车', desc: '起亚日利纳工厂，生产 Sportage 等车型，是斯洛伐克汽车出口主力。', website: 'https://www.kia.sk' },
      { name: 'ESET', nameEn: 'ESET', category: '计算机', desc: '斯洛伐克网络安全企业，端点防护与威胁情报产品服务全球企业与个人。', website: 'https://www.eset.com' },
    ],
  },
  {
    id: 'si', mapName: 'Slovenia', name: '斯洛文尼亚', nameEn: 'Slovenia', flag: '🇸🇮',
    lat: 46.1, lon: 14.8, hideLabel: true,
    enterprises: [
      { name: 'Revoz', nameEn: 'Revoz', category: '汽车', desc: '雷诺斯洛文尼亚工厂，生产 Clio 等小型车，是当地最大出口企业之一。', website: 'https://www.revoz.si' },
      { name: 'Gorenje', nameEn: 'Gorenje', category: '电气', desc: '斯洛文尼亚家电集团（海信控股），白电产品销往欧洲与全球市场。', website: 'https://www.gorenje.com' },
      { name: 'Trimo', nameEn: 'Trimo', category: '机械', desc: '钢结构建筑围护系统制造商，夹芯板与模块化建筑技术出口 50 多国。', website: 'https://www.trimo-group.com' },
    ],
  },
  {
    id: 'bg', mapName: 'Bulgaria', name: '保加利亚', nameEn: 'Bulgaria', flag: '🇧🇬',
    lat: 42.7, lon: 25.4,
    enterprises: [
      { name: 'Telerik', nameEn: 'Telerik', category: '计算机', desc: '保加利亚软件企业，.NET 控件与企业级开发工具被 Progress 收购后仍为研发重镇。', website: 'https://www.telerik.com' },
      { name: 'Arsenal', nameEn: 'Arsenal AD', category: '机械', desc: '保加利亚机械与军工制造企业，精密加工与特种装备生产历史悠久。', website: 'https://www.arsenal-bg.com' },
      { name: 'Vivacom', nameEn: 'Vivacom', category: '计算机', desc: '保加利亚电信运营商，移动、固网与 ICT 集成服务覆盖全国。', website: 'https://www.vivacom.bg' },
    ],
  },
  {
    id: 'lt', mapName: 'Lithuania', name: '立陶宛', nameEn: 'Lithuania', flag: '🇱🇹',
    lat: 55.2, lon: 23.9,
    enterprises: [
      { name: 'Teltonika', nameEn: 'Teltonika Networks', category: '电气', desc: '立陶宛物联网设备制造商，工业路由器与车载远程信息终端全球出货。', website: 'https://teltonika-networks.com' },
      { name: 'Ignitis', nameEn: 'Ignitis Group', category: '电气', desc: '立陶宛国有能源集团，发电、配电与可再生能源项目覆盖波罗的海。', website: 'https://www.ignitisgrupe.lt' },
      { name: '立陶宛铁路', nameEn: 'LTG', category: '机械', desc: '立陶宛国家铁路集团，货运与客运网络连接波罗的海与欧洲内陆。', website: 'https://www.litrail.lt' },
    ],
  },
  {
    id: 'lv', mapName: 'Latvia', name: '拉脱维亚', nameEn: 'Latvia', flag: '🇱🇻',
    lat: 56.9, lon: 24.6,
    enterprises: [
      { name: 'MikroTik', nameEn: 'MikroTik', category: '计算机', desc: '拉脱维亚网络设备厂商，RouterOS 与低成本路由器广泛应用于全球 ISP。', website: 'https://mikrotik.com' },
      { name: '拉脱维亚电力', nameEn: 'Latvenergo', category: '电气', desc: '拉脱维亚国有电力集团，水电、热电与售电业务覆盖全国。', website: 'https://www.latvenergo.lv' },
      { name: '拉脱维亚铁路', nameEn: 'Latvijas dzelzceļš', category: '机械', desc: '拉脱维亚国家铁路公司，承担波罗的海货运枢纽与过境物流。', website: 'https://www.ldz.lv' },
    ],
  },
  {
    id: 'ee', mapName: 'Estonia', name: '爱沙尼亚', nameEn: 'Estonia', flag: '🇪🇪',
    lat: 58.6, lon: 25.0,
    enterprises: [
      { name: 'Bolt', nameEn: 'Bolt', category: '计算机', desc: '爱沙尼亚出行平台，网约车、电动滑板车与外卖业务覆盖欧洲与非洲多城。', website: 'https://bolt.eu' },
      { name: 'Wise', nameEn: 'Wise', category: '计算机', desc: '爱沙尼亚创立的跨境支付平台，多币种账户与低成本汇款服务全球用户。', website: 'https://wise.com' },
      { name: '爱沙尼亚能源', nameEn: 'Eesti Energia', category: '电气', desc: '爱沙尼亚国有能源集团，油页岩发电与再生能源转型并行推进。', website: 'https://www.energia.ee' },
    ],
  },
  {
    id: 'is', mapName: 'Iceland', name: '冰岛', nameEn: 'Iceland', flag: '🇮🇸',
    lat: 64.9, lon: -19.0,
    enterprises: [
      { name: 'Landsvirkjun', nameEn: 'Landsvirkjun', category: '电气', desc: '冰岛国家电力公司，地热与水电站为数据中心与铝冶炼提供低碳电力。', website: 'https://www.landsvirkjun.com' },
      { name: 'Alcoa Fjarðaál', nameEn: 'Alcoa Fjarðaál', category: '机械', desc: '冰岛东部的铝冶炼厂，利用地热电力生产低碳铝，供应欧洲工业市场。', website: 'https://www.alcoa.com' },
      { name: 'CCP Games', nameEn: 'CCP Games', category: '计算机', desc: '冰岛游戏开发商，EVE Online 大型太空沙盒运营二十余年，绑定工业经济系统。', website: 'https://www.ccpgames.com' },
    ],
  },
  {
    id: 'lu', mapName: 'Luxembourg', name: '卢森堡', nameEn: 'Luxembourg', flag: '🇱🇺',
    lat: 49.8, lon: 6.1, hideLabel: true,
    enterprises: [
      { name: '安赛乐米塔尔', nameEn: 'ArcelorMittal', category: '机械', desc: '全球最大钢铁集团，总部位于卢森堡，汽车板与高强钢技术全球领先。', website: 'https://corporate.arcelormittal.com' },
      { name: 'SES', nameEn: 'SES', category: '计算机', desc: '卢森堡卫星运营商，地球同步与中轨卫星星座提供全球广播与数据连接。', website: 'https://www.ses.com' },
      { name: '卢森堡航空', nameEn: 'Luxair', category: '机械', desc: '卢森堡国家航空公司，运营欧洲区域航线与货运包机业务。', website: 'https://www.luxair.lu' },
    ],
  },
  {
    id: 'by', mapName: 'Belarus', name: '白俄罗斯', nameEn: 'Belarus', flag: '🇧🇾',
    lat: 53.7, lon: 27.9,
    enterprises: [
      { name: 'BelAZ', nameEn: 'BelAZ', category: '机械', desc: '白俄罗斯矿用自卸车制造商，220 吨级超大型矿卡出口全球矿区。', website: 'https://www.belaz.by' },
      { name: 'MAZ', nameEn: 'MAZ', category: '机械', desc: '白俄罗斯卡车与客车制造商，重卡、底盘与专用车出口独联体与亚非。', website: 'https://www.maz.by' },
      { name: '明斯克拖拉机', nameEn: 'MTZ', category: '机械', desc: '白俄罗斯拖拉机龙头，BELARUS 品牌农机覆盖全球中小农场作业。', website: 'https://www.belarus-tractor.com' },
    ],
  },
  {
    id: 'md', mapName: 'Moldova', name: '摩尔多瓦', nameEn: 'Moldova', flag: '🇲🇩',
    lat: 47.0, lon: 28.4, hideLabel: true,
    enterprises: [
      { name: 'Moldtelecom', nameEn: 'Moldtelecom', category: '计算机', desc: '摩尔多瓦国有电信运营商，固网宽带、移动与数据中心业务覆盖全国。', website: 'https://www.moldtelecom.md' },
      { name: 'Moldelectrica', nameEn: 'Moldelectrica', category: '电气', desc: '摩尔多瓦输电运营商，负责电网调度与与欧洲电网互联工程。', website: 'https://www.moldelectrica.md' },
      { name: 'Moldcell', nameEn: 'Moldcell', category: '计算机', desc: '摩尔多瓦移动运营商，4G/5G 网络与数字服务覆盖城乡。', website: 'https://www.moldcell.md' },
    ],
  },
  {
    id: 'ba', mapName: 'Bosnia and Herz.', name: '波黑', nameEn: 'Bosnia and Herzegovina', flag: '🇧🇦',
    lat: 43.9, lon: 17.5, hideLabel: true,
    enterprises: [
      { name: '安赛乐米塔尔泽尼察', nameEn: 'ArcelorMittal Zenica', category: '机械', desc: '波黑最大钢铁企业，长材与线材供应巴尔干建筑与制造市场。', website: 'https://corporate.arcelormittal.com' },
      { name: '波黑电力', nameEn: 'Elektroprivreda BiH', category: '电气', desc: '波黑联邦电力公司，燃煤与水电资产支撑全国供电与出口。', website: 'https://www.epbih.ba' },
      { name: 'BH Telecom', nameEn: 'BH Telecom', category: '计算机', desc: '波黑电信运营商，移动、固网与政企 ICT 服务覆盖全国。', website: 'https://www.bhtelecom.ba' },
    ],
  },
  {
    id: 'al', mapName: 'Albania', name: '阿尔巴尼亚', nameEn: 'Albania', flag: '🇦🇱',
    lat: 41.3, lon: 20.0, hideLabel: true,
    enterprises: [
      { name: 'KESH', nameEn: 'KESH', category: '电气', desc: '阿尔巴尼亚国家电力公司，以德里纳河梯级水电站为主体供电。', website: 'https://www.kesh.al' },
      { name: 'Albpetrol', nameEn: 'Albpetrol', category: '电气', desc: '阿尔巴尼亚国有油气公司，油田运营与炼化产品销售。', website: 'https://www.albpetrol.al' },
      { name: 'One Albania', nameEn: 'One Albania', category: '计算机', desc: '阿尔巴尼亚电信运营商，移动与光纤宽带网络覆盖全国。', website: 'https://www.one.al' },
    ],
  },
  {
    id: 'mk', mapName: 'Macedonia', name: '北马其顿', nameEn: 'North Macedonia', flag: '🇲🇰',
    lat: 41.6, lon: 21.7, hideLabel: true,
    enterprises: [
      { name: '马其顿电信', nameEn: 'Makedonski Telekom', category: '计算机', desc: '北马其顿最大电信运营商，移动、宽带与数字化服务覆盖全国。', website: 'https://www.telekom.mk' },
      { name: 'ELEM', nameEn: 'ELEM', category: '电气', desc: '北马其顿国有电力公司，水电与燃煤电站承担主力发电。', website: 'https://www.elem.com.mk' },
      { name: 'Makstil', nameEn: 'Makstil', category: '机械', desc: '北马其顿钢铁企业，热轧板材与钢管产品供应欧洲市场。', website: 'https://www.makstil.com.mk' },
    ],
  },
  {
    id: 'me', mapName: 'Montenegro', name: '黑山', nameEn: 'Montenegro', flag: '🇲🇪',
    lat: 42.7, lon: 19.2, hideLabel: true,
    enterprises: [
      { name: '黑山电力', nameEn: 'EPCG', category: '电气', desc: '黑山国家电力公司，水电与燃煤发电并推进风电与光伏项目。', website: 'https://www.epcg.com' },
      { name: '黑山电信', nameEn: 'Crnogorski Telekom', category: '计算机', desc: '黑山电信运营商，移动、固网与数字化服务覆盖全国。', website: 'https://www.telekom.me' },
      { name: '巴尔港', nameEn: 'Luka Bar', category: '机械', desc: '黑山亚得里亚海最大港口运营方，承担散货与集装箱转运。', website: 'https://www.lukabar.com' },
    ],
  },
  {
    id: 'xk', mapName: 'Kosovo', name: '科索沃', nameEn: 'Kosovo', flag: '🇽🇰',
    lat: 42.6, lon: 21.0, hideLabel: true,
    enterprises: [
      { name: 'KOSTT', nameEn: 'KOSTT', category: '电气', desc: '科索沃输配电系统运营商，负责电网调度与区域互联。', website: 'https://www.kostt.com' },
      { name: 'Ipko', nameEn: 'Ipko', category: '计算机', desc: '科索沃电信运营商，移动、宽带与数字电视服务覆盖全国。', website: 'https://www.ipko.com' },
      { name: 'Trepça', nameEn: 'Trepça', category: '机械', desc: '科索沃历史悠久的矿业与金属冶炼联合企业，铅锌矿与机械加工。', website: 'https://www.trepca.com' },
    ],
  },
  {
    id: 'mt', mapName: 'Malta', name: '马耳他', nameEn: 'Malta', flag: '🇲🇹',
    lat: 35.9, lon: 14.4, hideLabel: true,
    enterprises: [
      { name: '意法半导体马耳他', nameEn: 'STMicroelectronics Malta', category: '计算机', desc: '意法半导体马耳他工厂，功率器件与模拟芯片封装测试基地。', website: 'https://www.st.com' },
      { name: 'Enemalta', nameEn: 'Enemalta', category: '电气', desc: '马耳他国有电力公司，发电、配电与海底电缆互联保障岛国供电。', website: 'https://www.enemalta.com.mt' },
      { name: '马耳他自由港', nameEn: 'Malta Freeport Terminals', category: '机械', desc: '地中海重要中转港运营方，集装箱与滚装货物转运枢纽。', website: 'https://www.maltafreeport.com.mt' },
    ],
  },
  {
    id: 'cy', mapName: 'Cyprus', name: '塞浦路斯', nameEn: 'Cyprus', flag: '🇨🇾',
    lat: 35.0, lon: 33.2, hideLabel: true,
    enterprises: [
      { name: 'Cyta', nameEn: 'Cyta', category: '计算机', desc: '塞浦路斯国有电信运营商，移动、宽带与海底光缆业务覆盖全国。', website: 'https://www.cyta.com.cy' },
      { name: '塞浦路斯电力局', nameEn: 'Electricity Authority of Cyprus', category: '电气', desc: '塞浦路斯电力公司，发电与输配电一体化运营岛国电网。', website: 'https://www.eac.com.cy' },
      { name: 'Vassiliko', nameEn: 'Vassiliko Cement Works', category: '机械', desc: '塞浦路斯水泥与混凝土龙头，供应全岛基建与建材市场。', website: 'https://www.vassiliko.com' },
    ],
  },
  /* ---------- 亚洲（扩充） ---------- */
  {
    id: 'ge', mapName: 'Georgia', name: '格鲁吉亚', nameEn: 'Georgia', flag: '🇬🇪',
    lat: 42.0, lon: 43.5,
    enterprises: [
      { name: 'Telasi', nameEn: 'Telasi', category: '电气', desc: '格鲁吉亚配电公司，负责第比利斯及周边地区电网运营。', website: 'https://www.telasi.ge' },
      { name: '格鲁吉亚铁路', nameEn: 'Georgian Railway', category: '机械', desc: '格鲁吉亚国家铁路，承担黑海港口与高加索过境货运。', website: 'https://www.railway.ge' },
      { name: 'Wissol', nameEn: 'Wissol Group', category: '电气', desc: '格鲁吉亚燃油零售与能源集团，加油站网络覆盖全国。', website: 'https://wissol.ge' },
    ],
  },
  {
    id: 'am', mapName: 'Armenia', name: '亚美尼亚', nameEn: 'Armenia', flag: '🇦🇲',
    lat: 40.1, lon: 44.5,
    enterprises: [
      { name: '赞格祖尔铜钼联合', nameEn: 'ZCMC', category: '机械', desc: '亚美尼亚最大矿业与冶金企业，铜钼精矿出口与金属加工。', website: 'https://www.zcmc.am' },
      { name: '亚美尼亚电网', nameEn: 'Electric Networks of Armenia', category: '电气', desc: '亚美尼亚配电运营商，覆盖全国城乡电力供应与电网改造。', website: 'https://www.ena.am' },
      { name: 'Beeline 亚美尼亚', nameEn: 'ArmenTel', category: '计算机', desc: '亚美尼亚电信运营商，移动、固网与互联网服务覆盖全国。', website: 'https://www.beeline.am' },
    ],
  },
  {
    id: 'jo', mapName: 'Jordan', name: '约旦', nameEn: 'Jordan', flag: '🇯🇴',
    lat: 31.0, lon: 36.0,
    enterprises: [
      { name: '阿拉伯钾盐', nameEn: 'Arab Potash', category: '机械', desc: '约旦死海钾盐生产商，钾肥与工业盐出口全球农业市场。', website: 'https://www.arabpotash.com' },
      { name: '约旦磷矿', nameEn: 'Jordan Phosphate Mines', category: '机械', desc: '约旦磷矿石与磷肥龙头，储量与出口量居全球前列。', website: 'https://www.jpmc.com.jo' },
      { name: 'Orange 约旦', nameEn: 'Orange Jordan', category: '计算机', desc: '约旦电信运营商，移动、宽带与数字化服务覆盖全国。', website: 'https://www.orange.jo' },
    ],
  },
  {
    id: 'lb', mapName: 'Lebanon', name: '黎巴嫩', nameEn: 'Lebanon', flag: '🇱🇧',
    lat: 33.9, lon: 35.8, hideLabel: true,
    enterprises: [
      { name: 'CCC', nameEn: 'Consolidated Contractors Company', category: '机械', desc: '黎巴嫩起家的国际工程总包集团，承建中东与全球大型基建项目。', website: 'https://www.ccc.net' },
      { name: 'Touch', nameEn: 'Touch', category: '计算机', desc: '黎巴嫩移动运营商，4G 网络与数字服务覆盖全国。', website: 'https://www.touch.com.lb' },
      { name: '黎巴嫩电力', nameEn: 'Electricité du Liban', category: '电气', desc: '黎巴嫩国有电力公司，发电与输配电运营，推进电网重建。', website: 'https://www.edl.gov.lb' },
    ],
  },
  {
    id: 'sy', mapName: 'Syria', name: '叙利亚', nameEn: 'Syria', flag: '🇸🇾',
    lat: 35.0, lon: 38.0,
    enterprises: [
      { name: 'Syriatel', nameEn: 'Syriatel', category: '计算机', desc: '叙利亚主要移动运营商，通信网络与数字服务覆盖全国。', website: 'https://www.syriatel.com' },
      { name: '叙利亚石油公司', nameEn: 'Syrian Petroleum Company', category: '电气', desc: '叙利亚国有油气企业，油田勘探开发与原油生产。', website: 'https://www.spc.gov.sy' },
      { name: '叙利亚航空', nameEn: 'Syrian Air', category: '机械', desc: '叙利亚国家航空公司，运营区域客运与货运航线。', website: 'https://www.syriaair.com' },
    ],
  },
  {
    id: 'iq', mapName: 'Iraq', name: '伊拉克', nameEn: 'Iraq', flag: '🇮🇶',
    lat: 33.0, lon: 43.7,
    enterprises: [
      { name: '巴士拉石油', nameEn: 'Basra Oil Company', category: '电气', desc: '伊拉克最大油田运营方，鲁迈拉与西古尔纳原油产能核心。', website: 'https://www.boc.gov.iq' },
      { name: 'Asiacell', nameEn: 'Asiacell', category: '计算机', desc: '伊拉克移动运营商，全国网络覆盖与数字金融业务。', website: 'https://www.asiacell.com' },
      { name: 'Zain 伊拉克', nameEn: 'Zain Iraq', category: '计算机', desc: '伊拉克主要电信运营商，移动网络与政企 ICT 服务。', website: 'https://www.iq.zain.com' },
    ],
  },
  {
    id: 'af', mapName: 'Afghanistan', name: '阿富汗', nameEn: 'Afghanistan', flag: '🇦🇫',
    lat: 34.0, lon: 66.0,
    enterprises: [
      { name: 'DABS', nameEn: 'Da Afghanistan Breshna Sherkat', category: '电气', desc: '阿富汗国家电力公司，发电、输配电与进口电力调度。', website: 'https://www.dabs.af' },
      { name: 'Roshan', nameEn: 'Roshan', category: '计算机', desc: '阿富汗电信运营商，移动通信与移动支付服务覆盖全国。', website: 'https://www.roshan.af' },
      { name: 'Ghazanfar 集团', nameEn: 'Ghazanfar Group', category: '机械', desc: '阿富汗工业集团，水泥、建材与能源项目投资运营。', website: 'https://www.ghazanfargroup.com' },
    ],
  },
  {
    id: 'lk', mapName: 'Sri Lanka', name: '斯里兰卡', nameEn: 'Sri Lanka', flag: '🇱🇰',
    lat: 7.5, lon: 80.8,
    enterprises: [
      { name: '锡兰电力局', nameEn: 'Ceylon Electricity Board', category: '电气', desc: '斯里兰卡国有电力公司，发电、输电与配电一体化运营。', website: 'https://www.ceb.lk' },
      { name: 'Dialog', nameEn: 'Dialog Axiata', category: '计算机', desc: '斯里兰卡最大移动运营商，4G/5G 与数字支付业务领先。', website: 'https://www.dialog.lk' },
      { name: 'MAS Holdings', nameEn: 'MAS Holdings', category: '机械', desc: '斯里兰卡服装与功能性面料制造巨头，全球运动品牌核心供应商。', website: 'https://www.masholdings.com' },
    ],
  },
  {
    id: 'np', mapName: 'Nepal', name: '尼泊尔', nameEn: 'Nepal', flag: '🇳🇵',
    lat: 28.2, lon: 84.0,
    enterprises: [
      { name: '尼泊尔电力局', nameEn: 'Nepal Electricity Authority', category: '电气', desc: '尼泊尔国家电力公司，水电开发、输电与配电网运营。', website: 'https://www.nea.gov.np' },
      { name: 'Ncell', nameEn: 'Ncell', category: '计算机', desc: '尼泊尔移动运营商，网络覆盖与数字服务覆盖全国。', website: 'https://www.ncell.com.np' },
      { name: '尼泊尔电信', nameEn: 'Nepal Telecom', category: '计算机', desc: '尼泊尔国有电信运营商，固网、宽带与移动业务覆盖城乡。', website: 'https://www.ntc.com.np' },
    ],
  },
  {
    id: 'mm', mapName: 'Myanmar', name: '缅甸', nameEn: 'Myanmar', flag: '🇲🇲',
    lat: 21.0, lon: 96.0,
    enterprises: [
      { name: '缅甸油气', nameEn: 'MOGE', category: '电气', desc: '缅甸国有油气企业，油气勘探开发与管道天然气供应。', website: 'https://www.moge.gov.mm' },
      { name: 'Mytel', nameEn: 'Mytel', category: '计算机', desc: '缅甸移动运营商，4G 网络与光纤骨干网建设运营。', website: 'https://www.mytel.com.mm' },
      { name: '缅甸铁路', nameEn: 'Myanmar Railways', category: '机械', desc: '缅甸国家铁路，货运与客运网络连接主要城市与港口。', website: 'https://www.myanmarrailway.com' },
    ],
  },
  {
    id: 'kh', mapName: 'Cambodia', name: '柬埔寨', nameEn: 'Cambodia', flag: '🇰🇭',
    lat: 12.6, lon: 105.0,
    enterprises: [
      { name: '柬埔寨电力', nameEn: 'Electricité du Cambodge', category: '电气', desc: '柬埔寨国家电力公司，发电、输电与配电网络运营。', website: 'https://www.edc.com.kh' },
      { name: 'Cellcard', nameEn: 'Cellcard', category: '计算机', desc: '柬埔寨移动运营商，网络覆盖与数字金融业务。', website: 'https://www.cellcard.com.kh' },
      { name: '吴哥航空', nameEn: 'Cambodia Angkor Air', category: '机械', desc: '柬埔寨国家航空公司，运营区域客运与旅游航线。', website: 'https://www.cambodiaangkorair.com' },
    ],
  },
  {
    id: 'la', mapName: 'Laos', name: '老挝', nameEn: 'Laos', flag: '🇱🇦',
    lat: 19.5, lon: 103.0,
    enterprises: [
      { name: '老挝电力', nameEn: 'EDL', category: '电气', desc: '老挝国家电力公司，水电开发与“东南亚蓄电池”输电出口。', website: 'https://www.edl.com.la' },
      { name: 'Lao Telecom', nameEn: 'Lao Telecom', category: '计算机', desc: '老挝电信运营商，移动、宽带与数据中心服务。', website: 'https://www.laotel.com' },
      { name: 'Phu Bia Mining', nameEn: 'Phu Bia Mining', category: '机械', desc: '老挝大型铜金矿运营方，采矿与选冶一体化生产。', website: 'https://www.panaust.com.au' },
    ],
  },
  {
    id: 'mn', mapName: 'Mongolia', name: '蒙古', nameEn: 'Mongolia', flag: '🇲🇳',
    lat: 46.9, lon: 103.8,
    enterprises: [
      { name: '额尔登特矿', nameEn: 'Erdenet Mining', category: '机械', desc: '蒙古最大铜钼矿之一，采矿与精矿生产支撑国家出口。', website: 'https://www.erdenetmc.mn' },
      { name: '奥尤陶勒盖', nameEn: 'Oyu Tolgoi', category: '机械', desc: '蒙古大型铜金矿，力拓参与运营，地下采矿工程持续扩产。', website: 'https://www.oyutolgoi.com' },
      { name: 'Mobicom', nameEn: 'Mobicom', category: '计算机', desc: '蒙古移动运营商，通信网络与数字服务覆盖全国。', website: 'https://www.mobicom.mn' },
    ],
  },
  {
    id: 'tm', mapName: 'Turkmenistan', name: '土库曼斯坦', nameEn: 'Turkmenistan', flag: '🇹🇲',
    lat: 39.0, lon: 59.5,
    enterprises: [
      { name: '土库曼石油', nameEn: 'Türkmennebit', category: '电气', desc: '土库曼斯坦国有油气公司，天然气与原油勘探开发。', website: 'https://www.turkmennebit.gov.tm' },
      { name: '土库曼航空', nameEn: 'Turkmenistan Airlines', category: '机械', desc: '土库曼斯坦国家航空公司，运营区域与国际航线。', website: 'https://www.turkmenistanairlines.gov.tm' },
      { name: '土库曼电信', nameEn: 'Turkmentelecom', category: '计算机', desc: '土库曼斯坦国有电信运营商，固网、移动与互联网服务。', website: 'https://www.turkmentelecom.gov.tm' },
    ],
  },
  {
    id: 'kg', mapName: 'Kyrgyzstan', name: '吉尔吉斯斯坦', nameEn: 'Kyrgyzstan', flag: '🇰🇬',
    lat: 41.2, lon: 74.6,
    enterprises: [
      { name: 'Kyrgyztelecom', nameEn: 'Kyrgyztelecom', category: '计算机', desc: '吉尔吉斯斯坦国有电信运营商，固网与宽带服务覆盖全国。', website: 'https://www.kt.kg' },
      { name: '库姆托尔金矿', nameEn: 'Kumtor Gold', category: '机械', desc: '吉尔吉斯斯坦最大金矿，露天开采与选矿生产。', website: 'https://www.centerragold.com' },
      { name: '国家电力', nameEn: 'Electric Stations', category: '电气', desc: '吉尔吉斯斯坦国有发电公司，水电为主体的电力系统。', website: 'https://www.energo.kg' },
    ],
  },
  {
    id: 'tj', mapName: 'Tajikistan', name: '塔吉克斯坦', nameEn: 'Tajikistan', flag: '🇹🇯',
    lat: 38.5, lon: 71.0,
    enterprises: [
      { name: 'TALCO', nameEn: 'Tajik Aluminum Company', category: '机械', desc: '塔吉克斯坦铝冶炼企业，依托水电生产原铝并出口。', website: 'https://www.talco.tj' },
      { name: 'Barqi Tojik', nameEn: 'Barqi Tojik', category: '电气', desc: '塔吉克斯坦国家电力公司，水电开发与输配电运营。', website: 'https://www.barqitojik.tj' },
      { name: 'Tcell', nameEn: 'Tcell', category: '计算机', desc: '塔吉克斯坦移动运营商，4G 网络与数字服务覆盖全国。', website: 'https://www.tcell.tj' },
    ],
  },
  {
    id: 'ye', mapName: 'Yemen', name: '也门', nameEn: 'Yemen', flag: '🇾🇪',
    lat: 15.5, lon: 47.5,
    enterprises: [
      { name: '也门石油', nameEn: 'Yemen Petroleum Company', category: '电气', desc: '也门国有油气企业，炼油与成品油供应。', website: 'https://www.ypc.com.ye' },
      { name: '也门电信', nameEn: 'Public Telecommunications Corporation', category: '计算机', desc: '也门国有电信运营商，固网与移动通信服务。', website: 'https://www.ptc.gov.ye' },
      { name: '也门航空', nameEn: 'Yemenia', category: '机械', desc: '也门国家航空公司，运营区域客运航线。', website: 'https://www.yemenia.com' },
    ],
  },
  {
    id: 'bh', mapName: 'Bahrain', name: '巴林', nameEn: 'Bahrain', flag: '🇧🇭',
    lat: 26.0, lon: 50.5, hideLabel: true,
    enterprises: [
      { name: 'Alba', nameEn: 'Aluminium Bahrain', category: '机械', desc: '巴林铝业，全球最大单体铝冶炼厂之一，原铝出口全球。', website: 'https://www.alba.com.bh' },
      { name: 'Batelco', nameEn: 'Batelco', category: '计算机', desc: '巴林电信运营商，移动、宽带与政企 ICT 服务。', website: 'https://www.batelco.com' },
      { name: 'Bapco', nameEn: 'Bahrain Petroleum Company', category: '电气', desc: '巴林国家石油公司，炼油与油气生产，现代化炼厂扩建推进。', website: 'https://www.bapco.com.bh' },
    ],
  },
  {
    id: 'ps', mapName: 'Palestine', name: '巴勒斯坦', nameEn: 'Palestine', flag: '🇵🇸',
    lat: 31.9, lon: 35.2, hideLabel: true,
    enterprises: [
      { name: 'Paltel', nameEn: 'Paltel', category: '计算机', desc: '巴勒斯坦电信集团，固网、移动与互联网服务覆盖约旦河西岸与加沙。', website: 'https://www.paltel.ps' },
      { name: 'JDECO', nameEn: 'Jerusalem District Electricity Company', category: '电气', desc: '巴勒斯坦配电公司，负责耶路撒冷东部与周边地区供电。', website: 'https://www.jdeco.net' },
      { name: '巴勒斯坦电力', nameEn: 'Palestine Electric Company', category: '电气', desc: '巴勒斯坦发电与配电企业，参与本地电站与电网建设。', website: 'https://www.pec.ps' },
    ],
  },
  {
    id: 'tl', mapName: 'Timor-Leste', name: '东帝汶', nameEn: 'Timor-Leste', flag: '🇹🇱',
    lat: -8.8, lon: 125.9, hideLabel: true,
    enterprises: [
      { name: '东帝汶电力', nameEn: 'EDTL', category: '电气', desc: '东帝汶国家电力公司，发电、配电与农村电气化工程。', website: 'https://www.edtl.gov.tl' },
      { name: 'Telkomcel', nameEn: 'Telkomcel', category: '计算机', desc: '东帝汶移动运营商，通信网络与数字服务覆盖全国。', website: 'https://www.telkomcel.tl' },
      { name: '帝力港', nameEn: 'Timor Port', category: '机械', desc: '东帝汶帝力港运营方，承担集装箱与散货进出口。', website: 'https://www.timorport.com' },
    ],
  },
  {
    id: 'bt', mapName: 'Bhutan', name: '不丹', nameEn: 'Bhutan', flag: '🇧🇹',
    lat: 27.5, lon: 90.5,
    enterprises: [
      { name: 'Druk Green Power', nameEn: 'Druk Green Power', category: '电气', desc: '不丹国有水电集团，梯级水电站与对印度电力出口。', website: 'https://www.drukgreen.bt' },
      { name: '不丹电信', nameEn: 'Bhutan Telecom', category: '计算机', desc: '不丹国有电信运营商，固网、移动与宽带服务覆盖全国。', website: 'https://www.bt.bt' },
      { name: 'Dungsam 水泥', nameEn: 'Dungsam Cement', category: '机械', desc: '不丹水泥制造企业，供应国内基建与水电工程。', website: 'https://www.dungsamcement.com' },
    ],
  },
  {
    id: 'bn', mapName: 'Brunei', name: '文莱', nameEn: 'Brunei', flag: '🇧🇳',
    lat: 4.5, lon: 114.7, hideLabel: true,
    enterprises: [
      { name: '文莱壳牌石油', nameEn: 'Brunei Shell Petroleum', category: '电气', desc: '文莱油气生产主力，海上油田与天然气供应一体化运营。', website: 'https://www.bsp.com.bn' },
      { name: 'DST', nameEn: 'DST', category: '计算机', desc: '文莱电信运营商，移动、宽带与数字服务覆盖全国。', website: 'https://www.dst.com.bn' },
      { name: '文莱液化天然气', nameEn: 'Brunei LNG', category: '电气', desc: '文莱液化天然气公司，LNG 生产与出口长期供应日本韩国。', website: 'https://www.bruneilng.com' },
    ],
  },
  {
    id: 'kp', mapName: 'North Korea', name: '朝鲜', nameEn: 'North Korea', flag: '🇰🇵',
    lat: 40.0, lon: 127.0, hideLabel: true,
    enterprises: [
      { name: '朝鲜电力工业省', nameEn: 'DPRK Power Industry', category: '电气', desc: '朝鲜电力主管部门，统筹水电站与火电厂运行及电网调度。', website: 'https://www.korea-dpr.com' },
      { name: '朝鲜机械工业省', nameEn: 'DPRK Machine Industry', category: '机械', desc: '朝鲜机械制造主管部门，机床、矿山设备与运输机械生产。', website: 'https://www.korea-dpr.com' },
      { name: '朝鲜计算机中心', nameEn: 'Korea Computer Center', category: '计算机', desc: '朝鲜软件研发机构，操作系统、办公软件与网络技术开发。', website: 'https://www.korea-dpr.com' },
    ],
  },
  /* ---------- 非洲（扩充） ---------- */
  {
    id: 'et', mapName: 'Ethiopia', name: '埃塞俄比亚', nameEn: 'Ethiopia', flag: '🇪🇹',
    lat: 9.0, lon: 39.0,
    enterprises: [
      { name: '埃塞俄比亚航空', nameEn: 'Ethiopian Airlines', category: '机械', desc: '非洲最大航空公司，机队规模与航线网络领先，并运营航空维修基地。', website: 'https://www.ethiopianairlines.com' },
      { name: 'Ethio Telecom', nameEn: 'Ethio Telecom', category: '计算机', desc: '埃塞俄比亚国有电信运营商，移动、宽带与数字支付覆盖全国。', website: 'https://www.ethiotelecom.et' },
      { name: '埃塞俄比亚电力', nameEn: 'Ethiopian Electric Power', category: '电气', desc: '埃塞俄比亚国家发电企业，复兴大坝等水电项目支撑区域电力出口。', website: 'https://www.eep.com.et' },
    ],
  },
  {
    id: 'gh', mapName: 'Ghana', name: '加纳', nameEn: 'Ghana', flag: '🇬🇭',
    lat: 7.9, lon: -1.0,
    enterprises: [
      { name: '沃尔特河管理局', nameEn: 'Volta River Authority', category: '电气', desc: '加纳国有发电企业，阿科松博水电站与火电资产支撑全国供电。', website: 'https://www.vra.com' },
      { name: 'MTN 加纳', nameEn: 'MTN Ghana', category: '计算机', desc: '加纳最大移动运营商，4G/5G 与移动支付服务覆盖全国。', website: 'https://www.mtn.com.gh' },
      { name: '纽蒙特加纳', nameEn: 'Newmont Ghana', category: '机械', desc: '加纳大型金矿运营方，Ahafo 与 Akyem 矿山机械化开采。', website: 'https://www.newmont.com' },
    ],
  },
  {
    id: 'ci', mapName: "Côte d'Ivoire", name: '科特迪瓦', nameEn: "Côte d'Ivoire", flag: '🇨🇮',
    lat: 7.5, lon: -5.5,
    enterprises: [
      { name: '科特迪瓦电力', nameEn: 'CIE', category: '电气', desc: '科特迪瓦电力公司，发电、输电与配电运营覆盖全国。', website: 'https://www.cie.ci' },
      { name: 'Orange 科特迪瓦', nameEn: 'Orange Côte d\'Ivoire', category: '计算机', desc: '科特迪瓦最大电信运营商，移动与宽带网络覆盖全国。', website: 'https://www.orange.ci' },
      { name: 'SIFCA', nameEn: 'SIFCA', category: '机械', desc: '西非农工集团，棕榈油、橡胶与糖业加工设备与工厂运营。', website: 'https://www.sifca.com' },
    ],
  },
  {
    id: 'cm', mapName: 'Cameroon', name: '喀麦隆', nameEn: 'Cameroon', flag: '🇨🇲',
    lat: 5.5, lon: 12.5,
    enterprises: [
      { name: '喀麦隆电力', nameEn: 'SONEL', category: '电气', desc: '喀麦隆国家电力公司，水电与火电发电及输配电运营。', website: 'https://www.sonel.cm' },
      { name: 'CAMTEL', nameEn: 'CAMTEL', category: '计算机', desc: '喀麦隆国有电信运营商，固网、宽带与移动业务覆盖全国。', website: 'https://www.camtel.cm' },
      { name: 'Alucam', nameEn: 'Alucam', category: '机械', desc: '喀麦隆铝冶炼企业，依托水电生产原铝并供应西非市场。', website: 'https://www.alucam.com' },
    ],
  },
  {
    id: 'sn', mapName: 'Senegal', name: '塞内加尔', nameEn: 'Senegal', flag: '🇸🇳',
    lat: 14.5, lon: -14.5,
    enterprises: [
      { name: 'SENELEC', nameEn: 'SENELEC', category: '电气', desc: '塞内加尔国家电力公司，发电与输配电网络覆盖全国。', website: 'https://www.senelec.sn' },
      { name: 'Sonatel', nameEn: 'Sonatel', category: '计算机', desc: '塞内加尔电信集团，移动、宽带与数字金融服务西非多国。', website: 'https://www.sonatel.com' },
      { name: 'Suneor', nameEn: 'Suneor', category: '机械', desc: '塞内加尔花生油与农产品加工企业，压榨与精炼设备一体化。', website: 'https://www.suneor.sn' },
    ],
  },
  {
    id: 'tn', mapName: 'Tunisia', name: '突尼斯', nameEn: 'Tunisia', flag: '🇹🇳',
    lat: 34.0, lon: 9.5,
    enterprises: [
      { name: 'STEG', nameEn: 'STEG', category: '电气', desc: '突尼斯国家电力与燃气公司，发电、输配电与天然气供应。', website: 'https://www.steg.com.tn' },
      { name: '突尼斯电信', nameEn: 'Tunisie Telecom', category: '计算机', desc: '突尼斯国有电信运营商，固网、移动与宽带服务覆盖全国。', website: 'https://www.tunisietelecom.tn' },
      { name: '突尼斯航空', nameEn: 'Tunisair', category: '机械', desc: '突尼斯国家航空公司，运营欧洲、非洲与中东航线。', website: 'https://www.tunisair.com' },
    ],
  },
  {
    id: 'ly', mapName: 'Libya', name: '利比亚', nameEn: 'Libya', flag: '🇱🇾',
    lat: 27.0, lon: 17.0,
    enterprises: [
      { name: '利比亚国家石油', nameEn: 'National Oil Corporation', category: '电气', desc: '利比亚国家石油公司，油田运营与原油出口，产能恢复推进。', website: 'https://www.noc.ly' },
      { name: '利比亚电信', nameEn: 'Libya Telecom', category: '计算机', desc: '利比亚电信运营商，固网、移动与互联网服务覆盖全国。', website: 'https://www.ltt.ly' },
      { name: '利比亚航空', nameEn: 'Libyan Airlines', category: '机械', desc: '利比亚国家航空公司，运营区域客运航线。', website: 'https://www.libyanairlines.com' },
    ],
  },
  {
    id: 'sd', mapName: 'Sudan', name: '苏丹', nameEn: 'Sudan', flag: '🇸🇩',
    lat: 15.5, lon: 32.5,
    enterprises: [
      { name: 'Sudatel', nameEn: 'Sudatel', category: '计算机', desc: '苏丹电信集团，固网、移动与宽带业务覆盖苏丹及西非多国。', website: 'https://www.sudatel.sd' },
      { name: '苏丹石油公司', nameEn: 'Sudanese Petroleum Corporation', category: '电气', desc: '苏丹国有油气企业，炼油与成品油供应。', website: 'https://www.spc.gov.sd' },
      { name: '苏丹航空', nameEn: 'Sudan Airways', category: '机械', desc: '苏丹国家航空公司，运营区域客运与货运航线。', website: 'https://www.sudanairways.com' },
    ],
  },
  {
    id: 'ss', mapName: 'S. Sudan', name: '南苏丹', nameEn: 'South Sudan', flag: '🇸🇸',
    lat: 7.0, lon: 30.0, hideLabel: true,
    enterprises: [
      { name: 'Nilepet', nameEn: 'Nilepet', category: '电气', desc: '南苏丹国家石油公司，油田运营与原油出口管道管理。', website: 'https://www.nilepet.gov.ss' },
      { name: 'MTN 南苏丹', nameEn: 'MTN South Sudan', category: '计算机', desc: '南苏丹移动运营商，通信网络与数字服务覆盖主要城市。', website: 'https://www.mtn.ss' },
    ],
  },
  {
    id: 'tz', mapName: 'Tanzania', name: '坦桑尼亚', nameEn: 'Tanzania', flag: '🇹🇿',
    lat: -6.5, lon: 35.0,
    enterprises: [
      { name: 'TANESCO', nameEn: 'TANESCO', category: '电气', desc: '坦桑尼亚国家电力公司，水电、天然气发电与输配电运营。', website: 'https://www.tanesco.co.tz' },
      { name: 'Vodacom 坦桑尼亚', nameEn: 'Vodacom Tanzania', category: '计算机', desc: '坦桑尼亚主要移动运营商，4G 网络与移动支付服务。', website: 'https://www.vodacom.co.tz' },
      { name: '坦桑尼亚航空', nameEn: 'Air Tanzania', category: '机械', desc: '坦桑尼亚国家航空公司，机队更新与区域航线扩张。', website: 'https://www.airtanzania.co.tz' },
    ],
  },
  {
    id: 'ug', mapName: 'Uganda', name: '乌干达', nameEn: 'Uganda', flag: '🇺🇬',
    lat: 1.0, lon: 32.0,
    enterprises: [
      { name: '乌干达发电', nameEn: 'UEGCL', category: '电气', desc: '乌干达国有发电公司，尼罗河水电项目开发与运营。', website: 'https://www.uegcl.com' },
      { name: 'MTN 乌干达', nameEn: 'MTN Uganda', category: '计算机', desc: '乌干达最大移动运营商，移动支付与数字服务覆盖全国。', website: 'https://www.mtn.co.ug' },
      { name: '乌干达航空', nameEn: 'Uganda Airlines', category: '机械', desc: '乌干达国家航空公司，运营区域与国际航线。', website: 'https://www.ugandairlines.com' },
    ],
  },
  {
    id: 'zw', mapName: 'Zimbabwe', name: '津巴布韦', nameEn: 'Zimbabwe', flag: '🇿🇼',
    lat: -19.0, lon: 29.0,
    enterprises: [
      { name: 'ZESA', nameEn: 'ZESA', category: '电气', desc: '津巴布韦国家电力公司，发电、输电与配电运营，推进光伏项目。', website: 'https://www.zesa.co.zw' },
      { name: 'Econet', nameEn: 'Econet Wireless', category: '计算机', desc: '津巴布韦最大移动运营商，通信与移动支付生态覆盖全国。', website: 'https://www.econet.co.zw' },
      { name: 'ZMDC', nameEn: 'Zimbabwe Mining Development Corporation', category: '机械', desc: '津巴布韦国有矿业公司，金、铂与锂矿资源开发。', website: 'https://www.zmdc.co.zw' },
    ],
  },
  {
    id: 'ao', mapName: 'Angola', name: '安哥拉', nameEn: 'Angola', flag: '🇦🇴',
    lat: -12.5, lon: 17.5,
    enterprises: [
      { name: 'Sonangol', nameEn: 'Sonangol', category: '电气', desc: '安哥拉国家石油公司，海上油田运营与炼化业务。', website: 'https://www.sonangol.co.ao' },
      { name: 'Unitel', nameEn: 'Unitel', category: '计算机', desc: '安哥拉最大移动运营商，4G/5G 与数字服务覆盖全国。', website: 'https://www.unitel.ao' },
      { name: 'TAAG', nameEn: 'TAAG Angola Airlines', category: '机械', desc: '安哥拉国家航空公司，运营非洲、欧洲与南美航线。', website: 'https://www.taag.com' },
    ],
  },
  {
    id: 'mz', mapName: 'Mozambique', name: '莫桑比克', nameEn: 'Mozambique', flag: '🇲🇿',
    lat: -18.0, lon: 35.0,
    enterprises: [
      { name: 'EDM', nameEn: 'Electricidade de Moçambique', category: '电气', desc: '莫桑比克国家电力公司，发电、输电与配电运营。', website: 'https://www.edm.co.mz' },
      { name: 'Tmcel', nameEn: 'Tmcel', category: '计算机', desc: '莫桑比克国有电信运营商，固网、移动与宽带服务。', website: 'https://www.tmcel.co.mz' },
      { name: 'Mozal', nameEn: 'Mozal Aluminium', category: '机械', desc: '莫桑比克大型铝冶炼厂，依托水电生产原铝出口全球。', website: 'https://www.mozal.com' },
    ],
  },
  {
    id: 'bw', mapName: 'Botswana', name: '博茨瓦纳', nameEn: 'Botswana', flag: '🇧🇼',
    lat: -22.0, lon: 24.0,
    enterprises: [
      { name: '博茨瓦纳电力', nameEn: 'Botswana Power Corporation', category: '电气', desc: '博茨瓦纳国有电力公司，燃煤发电与电网运营。', website: 'https://www.bpc.co.bw' },
      { name: 'Mascom', nameEn: 'Mascom', category: '计算机', desc: '博茨瓦纳最大移动运营商，网络覆盖与数字服务。', website: 'https://www.mascom.bw' },
      { name: 'Debswana', nameEn: 'Debswana', category: '机械', desc: '博茨瓦纳与戴比尔斯合资钻石企业，露天矿开采与选矿。', website: 'https://www.debswana.com' },
    ],
  },
  {
    id: 'na', mapName: 'Namibia', name: '纳米比亚', nameEn: 'Namibia', flag: '🇳🇦',
    lat: -22.5, lon: 17.0,
    enterprises: [
      { name: 'NamPower', nameEn: 'NamPower', category: '电气', desc: '纳米比亚国家电力公司，发电、输电与区域电力交易。', website: 'https://www.nampower.com.na' },
      { name: 'MTC 纳米比亚', nameEn: 'MTC Namibia', category: '计算机', desc: '纳米比亚最大移动运营商，网络覆盖与数字服务。', website: 'https://www.mtc.com.na' },
      { name: 'Namdeb', nameEn: 'Namdeb', category: '机械', desc: '纳米比亚钻石开采企业，海岸与海上钻石矿运营。', website: 'https://www.namdeb.com' },
    ],
  },
  {
    id: 'cd', mapName: 'Dem. Rep. Congo', name: '刚果（金）', nameEn: 'DR Congo', flag: '🇨🇩',
    lat: -2.5, lon: 23.0,
    enterprises: [
      { name: 'SNEL', nameEn: 'SNEL', category: '电气', desc: '刚果（金）国家电力公司，英加水电基地与全国输配电运营。', website: 'https://www.snel.cd' },
      { name: 'Vodacom 刚果', nameEn: 'Vodacom Congo', category: '计算机', desc: '刚果（金）移动运营商，通信网络与移动支付服务。', website: 'https://www.vodacom.cd' },
      { name: 'Gécamines', nameEn: 'Gécamines', category: '机械', desc: '刚果（金）国有矿业公司，铜钴矿资源开发与冶炼合作。', website: 'https://www.gecamines.cd' },
    ],
  },
  {
    id: 'cg', mapName: 'Congo', name: '刚果（布）', nameEn: 'Republic of the Congo', flag: '🇨🇬',
    lat: -1.0, lon: 15.0, hideLabel: true,
    enterprises: [
      { name: 'SNPC', nameEn: 'SNPC', category: '电气', desc: '刚果（布）国家石油公司，海上油田运营与油气出口。', website: 'https://www.snpc-congo.com' },
      { name: 'Airtel 刚果', nameEn: 'Airtel Congo', category: '计算机', desc: '刚果（布）移动运营商，网络覆盖与数字服务。', website: 'https://www.airtel.cg' },
      { name: 'Congo Terminal', nameEn: 'Congo Terminal', category: '机械', desc: '黑角港集装箱码头运营方，承担中非区域转运枢纽功能。', website: 'https://www.congoterminal.com' },
    ],
  },
  {
    id: 'zm', mapName: 'Zambia', name: '赞比亚', nameEn: 'Zambia', flag: '🇿🇲',
    lat: -15.0, lon: 27.0,
    enterprises: [
      { name: 'ZESCO', nameEn: 'ZESCO', category: '电气', desc: '赞比亚国家电力公司，水电为主体的发电与输配电运营。', website: 'https://www.zesco.co.zm' },
      { name: 'MTN 赞比亚', nameEn: 'MTN Zambia', category: '计算机', desc: '赞比亚主要移动运营商，4G 网络与移动支付服务。', website: 'https://www.mtn.co.zm' },
      { name: 'KCM', nameEn: 'Konkola Copper Mines', category: '机械', desc: '赞比亚大型铜矿企业，采矿、选矿与铜冶炼一体化。', website: 'https://www.kcm.co.zm' },
    ],
  },
  {
    id: 'rw', mapName: 'Rwanda', name: '卢旺达', nameEn: 'Rwanda', flag: '🇷🇼',
    lat: -2.0, lon: 30.0, hideLabel: true,
    enterprises: [
      { name: '卢旺达能源', nameEn: 'Rwanda Energy Group', category: '电气', desc: '卢旺达国有能源集团，发电、配电与农村电气化。', website: 'https://www.reg.rw' },
      { name: 'MTN 卢旺达', nameEn: 'MTN Rwanda', category: '计算机', desc: '卢旺达移动运营商，4G 网络与数字服务覆盖全国。', website: 'https://www.mtn.co.rw' },
      { name: '卢旺达航空', nameEn: 'RwandAir', category: '机械', desc: '卢旺达国家航空公司，运营非洲与欧洲区域航线。', website: 'https://www.rwandair.com' },
    ],
  },
  {
    id: 'mg', mapName: 'Madagascar', name: '马达加斯加', nameEn: 'Madagascar', flag: '🇲🇬',
    lat: -19.0, lon: 47.0,
    enterprises: [
      { name: 'Jirama', nameEn: 'Jirama', category: '电气', desc: '马达加斯加国家水电公司，发电、输配电与供水服务。', website: 'https://www.jirama.mg' },
      { name: 'Telma', nameEn: 'Telma', category: '计算机', desc: '马达加斯加最大电信运营商，移动、宽带与数字化服务。', website: 'https://www.telma.mg' },
      { name: '马达加斯加航空', nameEn: 'Madagascar Airlines', category: '机械', desc: '马达加斯加国家航空公司，运营区域与国际航线。', website: 'https://www.madagascar-airlines.com' },
    ],
  },
  {
    id: 'ml', mapName: 'Mali', name: '马里', nameEn: 'Mali', flag: '🇲🇱',
    lat: 17.0, lon: -4.0,
    enterprises: [
      { name: '马里能源', nameEn: 'EDM', category: '电气', desc: '马里国家电力公司，水电与柴油发电及输配电运营。', website: 'https://www.edm.ml' },
      { name: 'Orange 马里', nameEn: 'Orange Mali', category: '计算机', desc: '马里最大电信运营商，移动网络与移动支付服务。', website: 'https://www.orange.ml' },
      { name: 'Syama 金矿', nameEn: 'Resolute Mining', category: '机械', desc: '马里 Syama 金矿运营方，地下与露天开采结合。', website: 'https://www.resolutemining.com' },
    ],
  },
  {
    id: 'bf', mapName: 'Burkina Faso', name: '布基纳法索', nameEn: 'Burkina Faso', flag: '🇧🇫',
    lat: 12.5, lon: -1.5,
    enterprises: [
      { name: 'SONABEL', nameEn: 'SONABEL', category: '电气', desc: '布基纳法索国家电力公司，发电、输配电与光伏项目开发。', website: 'https://www.sonabel.bf' },
      { name: 'Orange 布基纳法索', nameEn: 'Orange Burkina Faso', category: '计算机', desc: '布基纳法索主要电信运营商，移动与宽带网络覆盖全国。', website: 'https://www.orange.bf' },
      { name: 'Essakane 金矿', nameEn: 'IAMGOLD', category: '机械', desc: '布基纳法索大型金矿运营方，露天开采与堆浸工艺。', website: 'https://www.iamgold.com' },
    ],
  },
  {
    id: 'so', mapName: 'Somalia', name: '索马里', nameEn: 'Somalia', flag: '🇸🇴',
    lat: 6.0, lon: 46.0,
    enterprises: [
      { name: 'Hormuud', nameEn: 'Hormuud Telecom', category: '计算机', desc: '索马里最大电信运营商，移动通信与移动支付覆盖全国。', website: 'https://www.hormuud.com' },
      { name: 'Golis', nameEn: 'Golis Telecom', category: '计算机', desc: '索马里邦特兰地区电信运营商，移动与宽带网络服务。', website: 'https://www.golis.net' },
      { name: '索马里航空', nameEn: 'Somali Airlines', category: '机械', desc: '索马里国家航空公司，运营区域客运航线。', website: 'https://www.somaliaairlines.com' },
    ],
  },
  {
    id: 'ga', mapName: 'Gabon', name: '加蓬', nameEn: 'Gabon', flag: '🇬🇦',
    lat: -0.8, lon: 11.5, hideLabel: true,
    enterprises: [
      { name: '加蓬石油', nameEn: 'Gabon Oil Company', category: '电气', desc: '加蓬国家石油公司，油田运营与原油出口业务。', website: 'https://www.goc.ga' },
      { name: 'Airtel 加蓬', nameEn: 'Airtel Gabon', category: '计算机', desc: '加蓬移动运营商，通信网络与数字服务覆盖全国。', website: 'https://www.airtel.ga' },
      { name: 'Comilog', nameEn: 'Comilog', category: '机械', desc: '加蓬锰矿开采与冶炼企业，全球高品位锰矿主要供应方。', website: 'https://www.comilog.com' },
    ],
  },
  {
    id: 'mw', mapName: 'Malawi', name: '马拉维', nameEn: 'Malawi', flag: '🇲🇼',
    lat: -13.5, lon: 34.0,
    enterprises: [
      { name: 'ESCOM', nameEn: 'ESCOM', category: '电气', desc: '马拉维国家电力公司，水电与输配电网络运营。', website: 'https://www.escom.co.mw' },
      { name: 'TNM', nameEn: 'TNM', category: '计算机', desc: '马拉维移动运营商，通信网络与移动支付服务。', website: 'https://www.tnm.co.mw' },
      { name: '马拉维航空', nameEn: 'Malawi Airlines', category: '机械', desc: '马拉维国家航空公司，运营区域客运航线。', website: 'https://www.malawianairlines.com' },
    ],
  },
  {
    id: 'ne', mapName: 'Niger', name: '尼日尔', nameEn: 'Niger', flag: '🇳🇪',
    lat: 17.0, lon: 9.0,
    enterprises: [
      { name: 'NIGELEC', nameEn: 'NIGELEC', category: '电气', desc: '尼日尔国家电力公司，发电、输配电与太阳能项目开发。', website: 'https://www.nigelec.ne' },
      { name: 'Orange 尼日尔', nameEn: 'Orange Niger', category: '计算机', desc: '尼日尔主要电信运营商，移动与宽带网络服务。', website: 'https://www.orange.ne' },
      { name: 'Somaïr', nameEn: 'Somaïr', category: '机械', desc: '尼日尔铀矿开采企业，欧安诺参与运营，露天矿与选矿厂。', website: 'https://www.ourano.com' },
    ],
  },
  {
    id: 'td', mapName: 'Chad', name: '乍得', nameEn: 'Chad', flag: '🇹🇩',
    lat: 15.0, lon: 19.0,
    enterprises: [
      { name: '乍得电力', nameEn: 'SNE', category: '电气', desc: '乍得国家电力公司，发电与输配电网络运营。', website: 'https://www.sne.td' },
      { name: 'Airtel 乍得', nameEn: 'Airtel Chad', category: '计算机', desc: '乍得移动运营商，通信网络与数字服务覆盖主要城市。', website: 'https://www.airtel.td' },
      { name: '多巴油田', nameEn: 'Doba Oil Project', category: '电气', desc: '乍得南部油田项目，原油开采与管道外输。', website: 'https://www.exxonmobil.com' },
    ],
  },
  {
    id: 'mr', mapName: 'Mauritania', name: '毛里塔尼亚', nameEn: 'Mauritania', flag: '🇲🇷',
    lat: 20.0, lon: -10.0,
    enterprises: [
      { name: 'Somelec', nameEn: 'Somelec', category: '电气', desc: '毛里塔尼亚国家电力公司，发电、输配电与可再生能源项目。', website: 'https://www.somelec.mr' },
      { name: 'Mauritel', nameEn: 'Mauritel', category: '计算机', desc: '毛里塔尼亚电信运营商，移动与宽带网络覆盖全国。', website: 'https://www.mauritel.mr' },
      { name: 'SNIM', nameEn: 'SNIM', category: '机械', desc: '毛里塔尼亚国有铁矿企业，铁矿石开采、铁路运输与港口装船。', website: 'https://www.snim.com' },
    ],
  },
  /* ---------- 美洲与大洋洲（扩充） ---------- */
  {
    id: 've', mapName: 'Venezuela', name: '委内瑞拉', nameEn: 'Venezuela', flag: '🇻🇪',
    lat: 8.0, lon: -66.0,
    enterprises: [
      { name: 'PDVSA', nameEn: 'PDVSA', category: '电气', desc: '委内瑞拉国家石油公司，奥里诺科重油带开发与炼化一体化。', website: 'https://www.pdvsa.com' },
      { name: 'CANTV', nameEn: 'CANTV', category: '计算机', desc: '委内瑞拉国有电信运营商，固网、宽带与移动服务。', website: 'https://www.cantv.com.ve' },
      { name: 'Sidor', nameEn: 'Sidor', category: '机械', desc: '委内瑞拉国有钢铁企业，板材与型材生产供应国内工业。', website: 'https://www.sidor.com.ve' },
    ],
  },
  {
    id: 'ec', mapName: 'Ecuador', name: '厄瓜多尔', nameEn: 'Ecuador', flag: '🇪🇨',
    lat: -1.5, lon: -78.0,
    enterprises: [
      { name: 'Petroecuador', nameEn: 'Petroecuador', category: '电气', desc: '厄瓜多尔国家石油公司，亚马逊油田开采与炼油业务。', website: 'https://www.eppetroecuador.ec' },
      { name: 'CELEC', nameEn: 'CELEC', category: '电气', desc: '厄瓜多尔国有发电集团，水电与地热项目运营。', website: 'https://www.celec.gob.ec' },
      { name: 'CNT', nameEn: 'CNT', category: '计算机', desc: '厄瓜多尔国有电信运营商，固网、宽带与移动服务覆盖全国。', website: 'https://www.cnt.gob.ec' },
    ],
  },
  {
    id: 'uy', mapName: 'Uruguay', name: '乌拉圭', nameEn: 'Uruguay', flag: '🇺🇾',
    lat: -33.0, lon: -56.0,
    enterprises: [
      { name: 'UTE', nameEn: 'UTE', category: '电气', desc: '乌拉圭国家电力公司，风电与水电占比高，输配电运营。', website: 'https://www.ute.com.uy' },
      { name: 'Antel', nameEn: 'Antel', category: '计算机', desc: '乌拉圭国有电信运营商，光纤到户与5G网络覆盖全国。', website: 'https://www.antel.com.uy' },
      { name: 'Montes del Plata', nameEn: 'Montes del Plata', category: '机械', desc: '乌拉圭纸浆与林业企业，桉树种植、制浆与港口物流一体化。', website: 'https://www.montesdelplata.com' },
    ],
  },
  {
    id: 'py', mapName: 'Paraguay', name: '巴拉圭', nameEn: 'Paraguay', flag: '🇵🇾',
    lat: -23.5, lon: -58.0,
    enterprises: [
      { name: 'ANDE', nameEn: 'ANDE', category: '电气', desc: '巴拉圭国家电力公司，伊泰普水电份额与全国输配电运营。', website: 'https://www.ande.gov.py' },
      { name: 'Tigo 巴拉圭', nameEn: 'Tigo Paraguay', category: '计算机', desc: '巴拉圭最大移动运营商，4G 网络与数字金融服务。', website: 'https://www.tigo.com.py' },
      { name: '伊泰普', nameEn: 'Itaipú Binacional', category: '电气', desc: '巴西与巴拉圭共建的大型水电站，装机容量全球领先。', website: 'https://www.itaipu.gov.br' },
    ],
  },
  {
    id: 'bo', mapName: 'Bolivia', name: '玻利维亚', nameEn: 'Bolivia', flag: '🇧🇴',
    lat: -16.5, lon: -64.0,
    enterprises: [
      { name: 'YPFB', nameEn: 'YPFB', category: '电气', desc: '玻利维亚国家石油公司，天然气开采、液化与管道出口。', website: 'https://www.ypfb.gob.bo' },
      { name: 'Entel', nameEn: 'Entel Bolivia', category: '计算机', desc: '玻利维亚国有电信运营商，移动、宽带与卫星通信服务。', website: 'https://www.entel.bo' },
      { name: 'COMIBOL', nameEn: 'COMIBOL', category: '机械', desc: '玻利维亚国有矿业公司，锡、锌与银矿开采冶炼。', website: 'https://www.comibol.gob.bo' },
    ],
  },
  {
    id: 'gt', mapName: 'Guatemala', name: '危地马拉', nameEn: 'Guatemala', flag: '🇬🇹',
    lat: 15.5, lon: -90.0,
    enterprises: [
      { name: 'INDE', nameEn: 'INDE', category: '电气', desc: '危地马拉国家电力公司，水电与地热发电及电网运营。', website: 'https://www.inde.gob.gt' },
      { name: 'Tigo 危地马拉', nameEn: 'Tigo Guatemala', category: '计算机', desc: '危地马拉最大移动运营商，网络覆盖与数字服务。', website: 'https://www.tigo.com.gt' },
      { name: 'Cementos Progreso', nameEn: 'Cementos Progreso', category: '机械', desc: '危地马拉水泥龙头，水泥、混凝土与建材供应中美洲。', website: 'https://www.cementosprogreso.com' },
    ],
  },
  {
    id: 'cu', mapName: 'Cuba', name: '古巴', nameEn: 'Cuba', flag: '🇨🇺',
    lat: 21.5, lon: -79.5,
    enterprises: [
      { name: '古巴电力联盟', nameEn: 'Unión Eléctrica', category: '电气', desc: '古巴国家电力公司，发电、输配电与电网改造运营。', website: 'https://www.une.cu' },
      { name: 'ETECSA', nameEn: 'ETECSA', category: '计算机', desc: '古巴国有电信运营商，移动、固网与互联网服务。', website: 'https://www.etecsa.cu' },
      { name: 'Cubaníquel', nameEn: 'Cubaníquel', category: '机械', desc: '古巴镍钴矿开采与冶炼企业，镍产品出口国际市场。', website: 'https://www.cubaniquel.cu' },
    ],
  },
  {
    id: 'do', mapName: 'Dominican Rep.', name: '多米尼加', nameEn: 'Dominican Republic', flag: '🇩🇴',
    lat: 19.0, lon: -70.0,
    enterprises: [
      { name: 'EGEHID', nameEn: 'EGEHID', category: '电气', desc: '多米尼加水力发电公司，水电站运营与电网支撑。', website: 'https://www.egehid.gob.do' },
      { name: 'Claro 多米尼加', nameEn: 'Claro Dominicana', category: '计算机', desc: '多米尼加主要电信运营商，移动、宽带与电视服务。', website: 'https://www.claro.com.do' },
      { name: 'Cementos Cibao', nameEn: 'Cementos Cibao', category: '机械', desc: '多米尼加水泥制造企业，供应加勒比地区基建市场。', website: 'https://www.cementoscibao.com' },
    ],
  },
  {
    id: 'hn', mapName: 'Honduras', name: '洪都拉斯', nameEn: 'Honduras', flag: '🇭🇳',
    lat: 15.0, lon: -86.5,
    enterprises: [
      { name: 'ENEE', nameEn: 'ENEE', category: '电气', desc: '洪都拉斯国家电力公司，发电、输电与配电运营。', website: 'https://www.enee.hn' },
      { name: 'Tigo 洪都拉斯', nameEn: 'Tigo Honduras', category: '计算机', desc: '洪都拉斯主要移动运营商，通信网络与数字服务。', website: 'https://www.tigo.com.hn' },
      { name: 'Cementos del Norte', nameEn: 'Cementos del Norte', category: '机械', desc: '洪都拉斯水泥制造企业，供应国内建筑与基建项目。', website: 'https://www.cementosdelnorte.com' },
    ],
  },
  {
    id: 'cr', mapName: 'Costa Rica', name: '哥斯达黎加', nameEn: 'Costa Rica', flag: '🇨🇷',
    lat: 9.7, lon: -84.0,
    enterprises: [
      { name: 'ICE', nameEn: 'Grupo ICE', category: '电气', desc: '哥斯达黎加国家电力与电信集团，可再生能源发电占比极高。', website: 'https://www.grupoice.com' },
      { name: '英特尔哥斯达黎加', nameEn: 'Intel Costa Rica', category: '计算机', desc: '英特尔哥斯达黎加工厂，芯片封装测试与工程研发中心。', website: 'https://www.intel.com' },
      { name: 'Ad Astra', nameEn: 'Ad Astra Rocket Company', category: '机械', desc: '哥斯达黎加航天推进技术公司，研发等离子体火箭发动机。', website: 'https://www.adastrarocket.com' },
    ],
  },
  {
    id: 'pa', mapName: 'Panama', name: '巴拿马', nameEn: 'Panama', flag: '🇵🇦',
    lat: 8.5, lon: -80.0,
    enterprises: [
      { name: '巴拿马运河管理局', nameEn: 'Panama Canal Authority', category: '机械', desc: '巴拿马运河运营方，船闸、航道与水资源管理系统工程。', website: 'https://www.pancanal.com' },
      { name: 'Copa 航空', nameEn: 'Copa Airlines', category: '机械', desc: '巴拿马国际航空公司，美洲枢纽航线网络覆盖广泛。', website: 'https://www.copaair.com' },
      { name: 'ETESA', nameEn: 'ETESA', category: '电气', desc: '巴拿马输电与电力交易公司，国家电网调度运营。', website: 'https://www.etesa.com.pa' },
    ],
  },
  {
    id: 'ni', mapName: 'Nicaragua', name: '尼加拉瓜', nameEn: 'Nicaragua', flag: '🇳🇮',
    lat: 12.8, lon: -85.0,
    enterprises: [
      { name: 'ENEL 尼加拉瓜', nameEn: 'ENEL Nicaragua', category: '电气', desc: '尼加拉瓜发电与配电企业，地热、风电与水电资产组合。', website: 'https://www.enel.com' },
      { name: 'Claro 尼加拉瓜', nameEn: 'Claro Nicaragua', category: '计算机', desc: '尼加拉瓜主要电信运营商，移动与宽带网络服务。', website: 'https://www.claro.com.ni' },
      { name: 'Holcim 尼加拉瓜', nameEn: 'Holcim Nicaragua', category: '机械', desc: '尼加拉瓜水泥制造企业，供应国内基建与住宅市场。', website: 'https://www.holcim.com.ni' },
    ],
  },
  {
    id: 'jm', mapName: 'Jamaica', name: '牙买加', nameEn: 'Jamaica', flag: '🇯🇲',
    lat: 18.0, lon: -77.3, hideLabel: true,
    enterprises: [
      { name: 'JPS', nameEn: 'Jamaica Public Service', category: '电气', desc: '牙买加电力公司，发电、输电与配电一体化运营。', website: 'https://www.jpsco.com' },
      { name: 'Digicel 牙买加', nameEn: 'Digicel Jamaica', category: '计算机', desc: '牙买加最大移动运营商，通信网络与数字金融服务。', website: 'https://www.digicelgroup.com' },
      { name: 'Noranda 铝土矿', nameEn: 'Noranda Bauxite', category: '机械', desc: '牙买加铝土矿开采与氧化铝生产企业，出口全球市场。', website: 'https://www.norandabauxite.com' },
    ],
  },
  {
    id: 'sv', mapName: 'El Salvador', name: '萨尔瓦多', nameEn: 'El Salvador', flag: '🇸🇻',
    lat: 13.8, lon: -88.9,
    enterprises: [
      { name: 'CEL', nameEn: 'CEL', category: '电气', desc: '萨尔瓦多国有水电公司，水电站与地热发电运营。', website: 'https://www.cel.gob.sv' },
      { name: 'Tigo 萨尔瓦多', nameEn: 'Tigo El Salvador', category: '计算机', desc: '萨尔瓦多最大移动运营商，网络覆盖与数字服务。', website: 'https://www.tigo.com.sv' },
      { name: 'Holcim 萨尔瓦多', nameEn: 'Holcim El Salvador', category: '机械', desc: '萨尔瓦多水泥制造企业，供应中美洲建筑市场。', website: 'https://www.holcim.com.sv' },
    ],
  },
  {
    id: 'fj', mapName: 'Fiji', name: '斐济', nameEn: 'Fiji', flag: '🇫🇯',
    lat: -17.8, lon: 178.0,
    enterprises: [
      { name: 'Energy Fiji', nameEn: 'Energy Fiji Limited', category: '电气', desc: '斐济国家电力公司，水电、柴油与太阳能发电及配电运营。', website: 'https://www.efl.com.fj' },
      { name: 'Vodafone 斐济', nameEn: 'Vodafone Fiji', category: '计算机', desc: '斐济最大移动运营商，通信网络与数字金融服务。', website: 'https://www.vodafone.com.fj' },
      { name: '斐济航空', nameEn: 'Fiji Airways', category: '机械', desc: '斐济国家航空公司，运营太平洋岛国与远程航线。', website: 'https://www.fijiairways.com' },
    ],
  },
  {
    id: 'pg', mapName: 'Papua New Guinea', name: '巴布亚新几内亚', nameEn: 'Papua New Guinea', flag: '🇵🇬',
    lat: -6.0, lon: 145.0,
    enterprises: [
      { name: 'PNG Power', nameEn: 'PNG Power', category: '电气', desc: '巴布亚新几内亚国有电力公司，发电、输电与配电运营。', website: 'https://www.pngpower.com.pg' },
      { name: 'Digicel 巴新', nameEn: 'Digicel PNG', category: '计算机', desc: '巴布亚新几内亚主要移动运营商，通信网络覆盖城乡。', website: 'https://www.digicelgroup.com' },
      { name: 'Lihir 金矿', nameEn: 'Newcrest Lihir', category: '机械', desc: '巴新 Lihir 大型金矿运营方，露天开采与高压氧化选冶。', website: 'https://www.newcrest.com' },
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

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

            <GlobeCanvas
              countries={COUNTRIES}
              paths={WORLD_COUNTRY_PATHS}
              links={LINKS}
              selectedId={selectedId}
              hoverId={hoverId}
              onSelect={setSelectedId}
              onHover={setHoverId}
            />

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
              <span className="wm-legend-coord">3D HOLOGRAM · NATURAL EARTH 1:50m</span>
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
