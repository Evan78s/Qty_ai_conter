/** 系统默认品牌配置。换品牌时改这里即可（后端数据库默认值在 seed.ts / migrate.ts / schema.ts）。 */
export const BRAND = {
  name: '鵲太醫',
  subtitle: 'AI OPERATION HUB',
  logo: '/logo.ico',
  slogan: '养生馆 AI 增效 · 多媒体推广运营管理工作台',
  slogan2: '让每一家门店的经营，都被数据看得见',
} as const;
