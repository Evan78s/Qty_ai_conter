<template>
  <div v-if="route.name === 'login' || route.name === 'setup'"><router-view /></div>
  <div v-else-if="app.ready" class="layout">
    <div v-if="sideOpen" class="sb-backdrop" @click="sideOpen = false"></div>
    <aside class="sidebar" :class="{ open: sideOpen }">
      <div class="sb-logo">
        <img class="m logo-img" :src="BRAND.logo" alt="logo" />
        <div><b>{{ BRAND.name }}</b><small>{{ BRAND.subtitle }}</small></div>
      </div>
      <div class="sb-store">
        <div class="lbl">当前门店范围</div>
        <el-select v-model="app.currentStore" size="small" style="width:100%;margin-top:4px" @change="onStoreChange">
          <el-option label="全部门店" value="all" />
          <el-option v-for="s in app.stores" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
      </div>
      <nav class="sb-nav">
        <div v-for="g in navGroups" :key="g.title" class="nav-group">
          <div class="gt">{{ g.title }}</div>
          <div v-for="it in g.items" :key="it.path" class="nav-item"
               :class="{ on: route.path === it.path }"
               @click="go(it.path)" v-show="canShow(it)">
            <el-icon><component :is="it.icon" /></el-icon>{{ it.label }}
          </div>
        </div>
      </nav>
      <div class="sb-foot">
        <div class="sb-user">
          <div class="av">{{ roleShort }}</div>
          <div>
            <div style="font-weight:600;color:#fff">{{ app.user?.displayName }}</div>
            <div style="font-size:10px">{{ roleName }}</div>
          </div>
          <el-button link style="margin-left:auto;color:#8FB3A6" @click="onLogout">退出</el-button>
        </div>
        <div class="sb-meta">
          <span>{{ APP_VERSION }}</span>
          <span class="sep">·</span>
          <span>{{ APP_EDITION }}</span>
          <span class="sep">·</span>
          <span>{{ APP_AUTHOR }}</span>
        </div>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <el-button class="hamburger" text @click="sideOpen = !sideOpen"><el-icon><Menu /></el-icon></el-button>
        <div class="crumb">工作台 / <b>{{ currentTitle }}</b></div>
        <div class="top-right">
          <el-select v-model="app.currentStore" size="default" style="width:150px" @change="onStoreChange">
            <el-option label="全部门店" value="all" />
            <el-option v-for="s in app.stores" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
          <el-badge :value="4" :hidden="!app.can('service',1)"><el-button circle text><el-icon><Bell /></el-icon></el-button></el-badge>
          <div class="top-avatar">{{ roleShort }}</div>
        </div>
      </header>
      <main class="content">
        <router-view />
      </main>
    </div>

    <!-- 首次登录强制改密 -->
    <el-dialog v-model="showPwd" title="首次登录 · 请修改密码" width="420px" :close-on-click-modal="false" :show-close="false">
      <p style="color:var(--ink2);font-size:13px;margin-bottom:16px">为保障账号安全，首次登录需设置新密码（至少 8 位）。</p>
      <el-form label-position="top">
        <el-form-item label="原密码"><el-input v-model="oldPwd" type="password" show-password /></el-form-item>
        <el-form-item label="新密码"><el-input v-model="newPwd" type="password" show-password /></el-form-item>
        <el-form-item label="确认新密码"><el-input v-model="confirmPwd" type="password" show-password /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="submitPwd" :loading="pwdLoading">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
  <div v-else style="height:100vh;display:flex;align-items:center;justify-content:center;color:var(--ink2)">加载中…</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Menu, Bell, Grid, Shop, Document, DataAnalysis, Headset, VideoCamera, MagicStick, Lock, Setting, Connection, Phone, Files } from '@element-plus/icons-vue';
import { useAppStore } from './stores/app';
import { api } from './api';
import { APP_VERSION, APP_EDITION, APP_AUTHOR } from './version';
import { BRAND } from './brand';

const route = useRoute();
const router = useRouter();
const app = useAppStore();
const sideOpen = ref(false);

const navGroups = [
  { title: '工作台', items: [{ label: '总览驾驶舱', path: '/', icon: Grid, mod: 'overview' }] },
  { title: '店铺管理', items: [
    { label: '店铺业绩看板', path: '/store', icon: Shop, mod: 'store' },
    { label: '每日对账录入', path: '/reconcile', icon: Document, mod: 'reconcile' },
    { label: '门店档案', path: '/storefile', icon: Files, mod: 'store' },
  ]},
  { title: '境外投流', items: [
    { label: '境外推广看板', path: '/ads', icon: DataAnalysis, mod: 'ads' },
    { label: 'AI 客服接待', path: '/service', icon: Headset, mod: 'service' },
    { label: '投流账户管理', path: '/adsaccount', icon: Connection, mod: 'ads' },
  ]},
  { title: '自媒体 AI', items: [
    { label: '自媒体工作台', path: '/social', icon: VideoCamera, mod: 'social' },
    { label: '素材生成工坊', path: '/material', icon: MagicStick, mod: 'social' },
  ]},
  { title: '系统设置', items: [
    { label: '权限管理', path: '/permission', icon: Lock, mod: 'system' },
    { label: '系统设置', path: '/settings', icon: Setting, mod: 'system' },
    { label: 'AI 模型与密钥', path: '/aiconfig', icon: Setting, mod: 'system' },
    { label: '小程序预览', path: '/miniapp', icon: Phone, mod: '' },
  ]},
];

const titles: Record<string, string> = {
  overview: '总览驾驶舱', store: '店铺业绩看板', reconcile: '每日对账录入', storefile: '门店档案',
  ads: '境外推广看板', service: 'AI 客服接待管理', adsaccount: '投流账户管理',
  social: '自媒体 AI 工作台', material: '素材生成工坊', permission: '权限管理',
  aiconfig: 'AI 模型与密钥', miniapp: '小程序预览', settings: '系统设置', setup: '系统初始化',
};
const currentTitle = computed(() => titles[String(route.name)] || '工作台');
const roleName = computed(() => ({ super_admin: '公司总管理员', store_manager: '分店店长', staff: '员工', auditor: '只读审计' } as any)[app.user?.roleCode || ''] || '用户');
const roleShort = computed(() => roleName.value[0]);

function canShow(it: any) {
  return !it.mod || app.can(it.mod, 1);
}
function go(path: string) { router.push(path); sideOpen.value = false; }
function onStoreChange() { window.dispatchEvent(new CustomEvent('store-changed', { detail: app.currentStore })); }
async function onLogout() { await app.logout(); router.push('/login'); }

const showPwd = ref(false);
const oldPwd = ref(''); const newPwd = ref(''); const confirmPwd = ref(''); const pwdLoading = ref(false);
watch(() => app.mustChangePassword, (v) => { showPwd.value = v; }, { immediate: true });
async function submitPwd() {
  if (newPwd.value !== confirmPwd.value) return ElMessage.error('两次输入的新密码不一致');
  pwdLoading.value = true;
  try {
    await api.changePassword(oldPwd.value, newPwd.value);
    app.mustChangePassword = false;
    oldPwd.value = newPwd.value = confirmPwd.value = '';
    ElMessage.success('密码已修改，请重新登录');
    await app.logout(); router.push('/login');
  } catch (e: any) { ElMessage.error(e.message || '修改失败'); }
  finally { pwdLoading.value = false; }
}
</script>
