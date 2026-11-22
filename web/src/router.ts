import { createRouter, createWebHistory } from 'vue-router';
import { useAppStore } from './stores/app';

const routes = [
  { path: '/setup', name: 'setup', component: () => import('./views/SetupView.vue'), meta: { public: true } },
  { path: '/login', name: 'login', component: () => import('./views/LoginView.vue'), meta: { public: true } },
  { path: '/', name: 'overview', component: () => import('./views/OverviewView.vue') },
  { path: '/store', name: 'store', component: () => import('./views/StoreView.vue') },
  { path: '/reconcile', name: 'reconcile', component: () => import('./views/ReconcileView.vue') },
  { path: '/storefile', name: 'storefile', component: () => import('./views/StoreFileView.vue') },
  { path: '/ads', name: 'ads', component: () => import('./views/AdsView.vue') },
  { path: '/service', name: 'service', component: () => import('./views/ServiceView.vue') },
  { path: '/adsaccount', name: 'adsaccount', component: () => import('./views/AdsAccountView.vue') },
  { path: '/social', name: 'social', component: () => import('./views/SocialView.vue') },
  { path: '/material', name: 'material', component: () => import('./views/MaterialView.vue') },
  { path: '/permission', name: 'permission', component: () => import('./views/PermissionView.vue') },
  { path: '/aiconfig', name: 'aiconfig', component: () => import('./views/AIConfigView.vue') },
  { path: '/miniapp', name: 'miniapp', component: () => import('./views/MiniAppView.vue') },
  { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') },
];

const router = createRouter({ history: createWebHistory(), routes });
router.beforeEach((to) => {
  const app = useAppStore();
  if (!to.meta.public && !app.user) return { name: 'login' };
  if ((to.name === 'login' || to.name === 'setup') && app.user) return { name: 'overview' };
  return true;
});
export default router;
