<template>
  <div class="login-page">
    <div class="login-box">
      <div class="login-brand">
        <div class="lg"><img class="m logo-img" :src="BRAND.logo" alt="logo" /><h1>{{ BRAND.name }}</h1></div>
        <p>{{ BRAND.slogan }}<br>{{ BRAND.slogan2 }}</p>
      </div>
      <div class="login-form">
        <h2>欢迎回来</h2>
        <div class="sub">登录后开始管理你的门店</div>
        <el-form label-position="top" @submit.prevent="submit">
          <el-form-item label="账号"><el-input v-model="username" size="large" placeholder="账号" /></el-form-item>
          <el-form-item label="密码"><el-input v-model="password" type="password" show-password size="large" placeholder="密码" @keyup.enter="submit" /></el-form-item>
        </el-form>
        <button class="btn-login" @click="submit" :disabled="loading">{{ loading ? '登录中…' : '登 录' }}</button>
        <div v-if="DEMO" class="demo-banner">本地演示模式 · 账号已预填，直接点「登录」即可进入（无需后端/数据库）</div>
        <div v-else class="login-tip">由总管理员分配账号 · 首次登录需修改密码</div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAppStore } from '../stores/app';
import { DEMO } from '../api';
import { BRAND } from '../brand';
const router = useRouter();
const app = useAppStore();
const username = ref('admin'); const password = ref(DEMO ? 'demo1234' : ''); const loading = ref(false);
async function submit() {
  if (!username.value || !password.value) return ElMessage.warning('请输入账号和密码');
  loading.value = true;
  try { await app.login(username.value, password.value); router.push('/'); }
  catch (e: any) { ElMessage.error(e.message || '登录失败'); }
  finally { loading.value = false; }
}
</script>
