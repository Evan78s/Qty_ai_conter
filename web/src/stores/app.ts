import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api, setAccessToken } from '../api';

export interface User {
  id: string; username: string; displayName: string; roleCode: string; roleName?: string;
  permissions: Record<string, number>;
  mustChangePassword?: boolean;
}
export interface StoreItem { id: string; name: string }

export const useAppStore = defineStore('app', () => {
  const user = ref<User | null>(null);
  const stores = ref<StoreItem[]>([]);
  const currentStore = ref<string>('all');
  const mustChangePassword = ref(false);
  const ready = ref(false);
  const isSuper = computed(() => user.value?.roleCode === 'super_admin');

  async function login(username: string, password: string) {
    const data = await api.login(username, password);
    setAccessToken(data.accessToken);
    user.value = data.user;
    mustChangePassword.value = data.mustChangePassword;
    await loadMe();
    return data;
  }
  async function loadMe() {
    try {
      const data = await api.me();
      user.value = data.user;
      stores.value = data.stores;
      if (typeof data.mustChangePassword === 'boolean') mustChangePassword.value = data.mustChangePassword;
      ready.value = true;
    } catch { ready.value = false; }
  }
  async function init() {
    // 本地演示模式：不连后端，显示登录页即可（任意账号密码可进入）
    if ((import.meta.env as any).VITE_DEMO === 'true') { ready.value = false; return; }
    // 页面刷新后 access 丢失，尝试用 refresh 恢复
    try {
      const r = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (r.ok) {
        const data = await r.json();
        setAccessToken(data.accessToken);
        await loadMe();
      }
    } catch { /* ignore */ }
  }
  async function logout() {
    await api.logout().catch(() => {});
    setAccessToken(null);
    user.value = null; stores.value = []; currentStore.value = 'all'; ready.value = false;
  }
  function can(module: string, perm: number) {
    if (isSuper.value) return true;
    return ((user.value?.permissions[module] || 0) & perm) === perm;
  }
  return {
    user, stores, currentStore, mustChangePassword, ready, isSuper,
    login, loadMe, init, logout, can,
  };
});
