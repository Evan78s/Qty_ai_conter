/** API 封装：access token 存内存，refresh 走 HttpOnly Cookie 自动续期。 */
let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => { accessToken = t; };
export const getAccessToken = () => accessToken;

/**
 * 本地演示模式：仅当构建/运行时设置 VITE_DEMO=true 时开启。
 * 开启后所有接口走内置演示数据，不连后端——用于本地预览，服务器上不会开启。
 */
export const DEMO = (import.meta.env as any).VITE_DEMO === 'true';

export const DEMO_USER = {
  id: 'demo-admin', username: 'admin', displayName: '演示管理员', roleCode: 'super_admin',
  permissions: { overview: 1, store: 1, reconcile: 1, ads: 1, service: 1, social: 1, system: 1 },
};
export const DEMO_STORES = [
  { id: 's1', name: '鵲太醫·总店' },
  { id: 's2', name: '鵲太醫·静安店' },
  { id: 's3', name: '鵲太醫·浦东店' },
];
export const DEMO_SETTINGS = {
  integrations: [{ id: 'int1', scope: 'platform', appId: 'cli_demo123456', credentialsMasked: '••••••••abcd', status: 'active' }],
  bindings: [
    { id: 'b1', storeId: 's1', storeName: '鵲太醫·总店', appToken: 'bascnDEMO0001', baseUrl: 'https://feishu.cn/base/demo1', tableIds: { performance: 'tbl_perf', dsp: 'tbl_dsp', kb: 'tbl_kb', replies: 'tbl_rep' }, credentialId: 'int1', ownerName: '演示管理员', status: 'active' },
    { id: 'b2', storeId: 's2', storeName: '鵲太醫·静安店', appToken: 'bascnDEMO0002', baseUrl: 'https://feishu.cn/base/demo2', tableIds: { performance: 'tbl_perf2', dsp: 'tbl_dsp2' }, credentialId: 'int1', ownerName: '演示管理员', status: 'active' },
  ],
  brand: { platformName: '鵲太醫', logoUrl: '/logo.ico', logoText: '鵲', subtitle: 'AI OPERATION HUB' },
  database: { installed: true, reachable: true, config: { host: '127.0.0.1', port: 3306, name: 'yangyuanhui', user: 'yyh' }, tableCount: 13, systemTables: 13 },
};

function demoResponse(path: string, method: string): any {
  const isGet = method === 'GET';
  if (path === '/auth/login') return { accessToken: 'demo-token', user: DEMO_USER, mustChangePassword: false };
  if (path === '/auth/me') return { user: DEMO_USER, stores: DEMO_STORES };
  if (path === '/auth/refresh') return { accessToken: 'demo-token' };
  if (path === '/stores') return DEMO_STORES;
  if (path.includes('/setup/status')) return { installed: true, configPath: '/opt/yangyuanhui/api/data/install.json', db: DEMO_SETTINGS.database.config };
  if (path.includes('/setup/test-db')) return { ok: true, server: '8.0.36 (demo)', database: 'yangyuanhui', user: 'yyh', canWrite: true };
  if (path.includes('/settings/integrations/feishu')) return isGet ? DEMO_SETTINGS.integrations : { ok: true, id: 'int1' };
  if (path.includes('/settings/bindings')) return isGet ? DEMO_SETTINGS.bindings : { ok: true, id: 'b1' };
  if (path.includes('/settings/stores')) return DEMO_STORES;
  if (path.includes('/settings/brand')) return isGet ? DEMO_SETTINGS.brand : { ok: true };
  if (path.includes('/settings/database')) return DEMO_SETTINGS.database;
  if (path.includes('/biz/capabilities/status')) {
    return { ok: true, capabilities: { feishu: { enabled: true }, ai: { enabled: false }, metaAds: { enabled: false }, googleAds: { enabled: false }, xiaohongshu: { enabled: false } } };
  }
  if (path.includes('/users/roles')) return [
    { id: 'r1', code: 'super_admin', name: '公司总管理员', permissions: { overview: 4, store: 4, reconcile: 4, ads: 4, service: 4, social: 4, system: 4 } },
    { id: 'r2', code: 'store_manager', name: '分店店长', permissions: { overview: 3, store: 3, reconcile: 3, ads: 1, service: 3, social: 3, system: 0 } },
    { id: 'r3', code: 'staff', name: '员工', permissions: { overview: 1, store: 1, reconcile: 2, ads: 0, service: 2, social: 2, system: 0 } },
    { id: 'r4', code: 'auditor', name: '只读审计', permissions: { overview: 1, store: 1, reconcile: 1, ads: 1, service: 1, social: 1, system: 1 } },
  ];
  if (path.includes('/users')) return [];
  if (path.includes('/audit')) return [];
  if (path.includes('/biz/')) return isGet ? [] : { ok: true, id: 'demo' };
  return { ok: true };
}

/**
 * 刷新 access token。后端 refresh 采用「轮转」：旧 refresh 用一次即吊销。
 * 页面刷新时可能有多个请求同时收到 401，若各自调一次 /auth/refresh，
 * 后到的那次会拿到已吊销的 token，导致整个会话家族被注销、被踢回登录页。
 * 因此这里做单飞（single-flight）：同一时刻只允许一个刷新请求。
 */
const REFRESH_FALLBACK_KEY = 'qty_refresh_fallback';
function saveRefreshToken(t?: string | null) {
  try {
    if (t) localStorage.setItem(REFRESH_FALLBACK_KEY, t);
    else localStorage.removeItem(REFRESH_FALLBACK_KEY);
  } catch { /* 隐私模式下忽略 */ }
}
function loadRefreshToken(): string {
  try { return localStorage.getItem(REFRESH_FALLBACK_KEY) || ''; } catch { return ''; }
}

let refreshing: Promise<string | null> | null = null;
export function refreshAccess(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    // 关键：finally 必须包住整个流程，覆盖「本地 token 成功直接 return」这条分支。
    // 只放在 Cookie 分支的 finally 里会导致单飞标志永久停留在这次成功的 Promise 上，
    // 之后每次 401 都拿到旧的 access token，重试再 401 → 被踢回登录页、写操作全部失败。
    try {
      const apply = async (r: Response): Promise<string | null> => {
        if (!r.ok) return null;
        const data = await r.json().catch(() => ({}));
        if (!data?.accessToken) return null;
        setAccessToken(data.accessToken);
        if (data.refreshToken) saveRefreshToken(data.refreshToken);
        return data.accessToken as string;
      };
      // 优先用 localStorage 里的最新 token（多标签更可靠），失败再走 HttpOnly Cookie。
      const local = loadRefreshToken();
      if (local) {
        try {
          const t = await apply(await fetch('/api/auth/refresh', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: local }),
          }));
          if (t) return t;
        } catch { /* ignore */ }
      }
      try {
        return await apply(await fetch('/api/auth/refresh', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' }, body: '{}',
        }));
      } catch {
        return null;
      }
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function raw(path: string, options: RequestInit = {}, retry = true): Promise<any> {
  const method = (options.method || 'GET').toUpperCase();
  if (DEMO) {
    await new Promise((r) => setTimeout(r, 80)); // 轻微延迟，贴近真实交互
    return demoResponse(path, method);
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as any || {}) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`/api${path}`, { ...options, headers, credentials: 'include' });
  if (res.status === 401 && retry && !path.includes('/auth/')) {
    const token = await refreshAccess();
    if (token) return raw(path, options, false);
    setAccessToken(null);
    throw new Error('登录已过期');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `请求失败(${res.status})`);
  return data;
}

export const api = {
  get: (p: string) => raw(p),
  post: (p: string, body?: any) => raw(p, { method: 'POST', body: JSON.stringify(body || {}) }),
  patch: (p: string, body?: any) => raw(p, { method: 'PATCH', body: JSON.stringify(body || {}) }),
  del: (p: string) => raw(p, { method: 'DELETE' }),
  login: async (username: string, password: string) => {
    const data = await raw('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    if (data?.refreshToken) saveRefreshToken(data.refreshToken);
    return data;
  },
  logout: async () => {
    try { return await raw('/auth/logout', { method: 'POST', body: '{}' }); }
    finally { saveRefreshToken(null); }
  },
  me: () => raw('/auth/me'),
  changePassword: async (oldPassword: string, newPassword: string) => {
    // 改密会吊销全部会话，本地兜底 token 必须一起清掉，否则刷新时会用失效 token 触发家族注销。
    const data = await raw('/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) });
    saveRefreshToken(null);
    return data;
  },
  // 安装向导（公开）
  setupStatus: () => raw('/setup/status'),
  testDb: (body: any) => raw('/setup/test-db', { method: 'POST', body: JSON.stringify(body) }),
  install: (body: any) => raw('/setup/install', { method: 'POST', body: JSON.stringify(body) }),
  // 系统设置
  feishuCredentials: () => raw('/settings/integrations/feishu'),
  saveFeishuCredential: (body: any) => raw('/settings/integrations/feishu', { method: 'POST', body: JSON.stringify(body) }),
  deleteCredential: (id: string) => raw(`/settings/integrations/feishu/${id}`, { method: 'DELETE' }),
  bindings: () => raw('/settings/bindings'),
  settingStores: () => raw('/settings/stores'),
  saveBinding: (body: any) => raw('/settings/bindings', { method: 'POST', body: JSON.stringify(body) }),
  deleteBinding: (id: string) => raw(`/settings/bindings/${id}`, { method: 'DELETE' }),
  brand: () => raw('/settings/brand'),
  saveBrand: (body: any) => raw('/settings/brand', { method: 'POST', body: JSON.stringify(body) }),
  dbStatus: () => raw('/settings/database'),
  // 系统升级（仅超管可触发）
  upgradeStatus: () => raw('/upgrade/status'),
  upgradeLog: () => raw('/upgrade/log'),
  upgradeTrigger: () => raw('/upgrade/trigger', { method: 'POST', body: '{}' }),
  // 用户与权限
  updateUser: (id: string, body: any) => raw(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteUser: (id: string) => raw(`/users/${id}`, { method: 'DELETE' }),
  updateRole: (code: string, permissions: Record<string, number>) => raw(`/users/roles/${code}`, { method: 'PATCH', body: JSON.stringify({ permissions }) }),
  // 通用业务数据（各模块真实落库）
  bizList: (type: string, storeId = 'all') => raw(`/biz/${type}?storeId=${encodeURIComponent(storeId)}`),
  bizCreate: (type: string, body: any) => raw(`/biz/${type}`, { method: 'POST', body: JSON.stringify(body) }),
  bizUpdate: (type: string, id: string, body: any) => raw(`/biz/${type}/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  bizDelete: (type: string, id: string) => raw(`/biz/${type}/${id}`, { method: 'DELETE' }),
  capabilities: () => raw('/biz/capabilities/status'),
  // AI 配置
  aiConfig: () => raw('/ai-config'),
  saveAiGlobal: (body: any) => raw('/ai-config/global', { method: 'POST', body: JSON.stringify(body) }),
  saveAiPersonal: (body: any) => raw('/ai-config/personal', { method: 'POST', body: JSON.stringify(body) }),
  updateAiScene: (code: string, body: { model?: string; temperature?: string; enabled?: boolean; systemPrompt?: string }) => raw(`/ai-config/scene/${code}`, { method: 'PATCH', body: JSON.stringify(body) }),
  defaultSkill: (scene = 'reconcile') => raw(`/ai-config/default-skill?scene=${encodeURIComponent(scene)}`),
  testAi: (which: 'global' | 'personal') => raw('/ai-config/test', { method: 'POST', body: JSON.stringify({ which }) }),
  aiChat: (body: {
    prompt?: string; system?: string; scene?: string; preferGlobal?: boolean;
    messages?: { role: 'user' | 'assistant'; content: string }[];
  }) => raw('/ai-config/chat', { method: 'POST', body: JSON.stringify(body) }),
  // Meta 投流：Graph API 同步 + CSV 导入
  metaConfig: () => raw('/meta/config'),
  saveMetaConfig: (body: any) => raw('/meta/config', { method: 'POST', body: JSON.stringify(body) }),
  metaTest: () => raw('/meta/test', { method: 'POST', body: '{}' }),
  metaSync: (body: { since?: string; until?: string } = {}) => raw('/meta/sync', { method: 'POST', body: JSON.stringify(body) }),
  metaImportCsv: (body: { csv: string; exchangeRate?: number }) => raw('/meta/import', { method: 'POST', body: JSON.stringify(body) }),
  // 每日对账：飞书「门店每日台账」+ Agent 核对
  reconcileTables: (storeId = 'all') => raw(`/reconcile/tables?storeId=${encodeURIComponent(storeId)}`),
  reconcileRemote: (storeId = 'all') => raw(`/reconcile/remote?storeId=${encodeURIComponent(storeId)}`),
  reconcileAgent: (body: { storeId?: string; messages?: { role: 'user' | 'assistant'; content: string }[]; text?: string }) => raw('/reconcile/agent', { method: 'POST', body: JSON.stringify(body) }),
  reconcileSync: (body: any) => raw('/reconcile/sync', { method: 'POST', body: JSON.stringify(body) }),
};
