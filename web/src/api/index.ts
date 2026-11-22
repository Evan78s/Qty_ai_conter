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
  return { ok: true };
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
    // 尝试刷新
    try {
      const r = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (r.ok) {
        const data = await r.json();
        setAccessToken(data.accessToken);
        return raw(path, options, false);
      }
    } catch { /* ignore */ }
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
  login: (username: string, password: string) => raw('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => raw('/auth/logout', { method: 'POST', body: '{}' }),
  me: () => raw('/auth/me'),
  changePassword: (oldPassword: string, newPassword: string) => raw('/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) }),
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
};
