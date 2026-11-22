/** 阶段 1 页面 mock 数据（后端真实数据接口在阶段 2+ 逐步接入）。 */
export const STORES = {
  s1: { name: '鵲太醫·总店', short: '总店', revenue: 18620, card: 6340, recharge: 9800, customers: 96, newC: 22, member: 1280 },
  s2: { name: '鵲太醫·静安店', short: '静安店', revenue: 12450, card: 4820, recharge: 6300, customers: 71, newC: 15, member: 860 },
  s3: { name: '鵲太醫·浦东店', short: '浦东店', revenue: 14880, card: 5210, recharge: 7400, customers: 83, newC: 18, member: 1030 },
};
export const ALL = Object.values(STORES);
export function agg(key: string, store: string) {
  const list = store === 'all' ? ALL : [(STORES as any)[store]].filter(Boolean);
  return list.reduce((s: number, x: any) => s + (x[key] || 0), 0);
}
export const SOURCES = ['美团/点评', '抖音团购', '老客推荐', '自然到店', '小红书', '会员转介'];
export const fmt = (n: number) => Number(n).toLocaleString('zh-CN');

export function trend(n = 7, mult = 1) {
  const a: number[] = [], b: number[] = [], x: string[] = [];
  let seed = n === 7 ? 7 : 11;
  for (let i = 0; i < n; i++) {
    seed = (seed * 13 + 7) % 97;
    a.push(Math.round((8000 + seed * 130 + Math.sin(i / 2) * 1200) * mult));
    b.push(Math.round((3000 + (seed * 7) % 60 * 80) * mult));
    x.push(n === 7 ? `11/${15 + i}` : `${10 + Math.floor(i / 3)}/${i % 3 * 10 + 1}`);
  }
  return { x, a, b };
}

export const ADS = {
  meta: { spend: 4820, imp: 286400, clicks: 9840, conv: 186, countries: [['美国', 4.2], ['加拿大', 3.6], ['澳大利亚', 3.1], ['英国', 2.8], ['新加坡', 2.4]] },
  google: { spend: 3650, imp: 198600, clicks: 7210, conv: 142, countries: [['美国', 3.9], ['加拿大', 3.2], ['澳大利亚', 2.9], ['新西兰', 2.6], ['马来西亚', 2.1]] },
};
export const QUEUE = [
  { name: '林女士', q: '咨询肩颈理疗套餐价格和预约时间', src: '小红书私信', conf: 62, wait: '12 分钟' },
  { name: 'Anonymous', q: 'What are your opening hours? Do you have English speaking staff?', src: 'Messenger', conf: 48, wait: '28 分钟' },
  { name: '陈先生', q: '会员卡可以转让给别人使用吗？', src: '微信公众号', conf: 71, wait: '8 分钟' },
  { name: 'Ms. Wang', q: 'I want to book a couples massage for this weekend', src: 'Google Business', conf: 55, wait: '41 分钟' },
];
export const KB = [
  { q: '营业时间是什么时候？', a: '每日 10:00–22:00，节假日正常营业', tag: '门店信息', hit: 328, on: true },
  { q: '肩颈理疗套餐多少钱？', a: '单次 ¥298，10 次卡 ¥2580，含 60 分钟专业理疗', tag: '价格套餐', hit: 256, on: true },
  { q: '会员卡可以转让吗？', a: '会员卡实名制，仅限本人使用，不可转让', tag: '会员政策', hit: 184, on: true },
  { q: '如何预约？', a: '支持电话、公众号、小程序在线预约，到店无需排队', tag: '预约', hit: 412, on: true },
];
