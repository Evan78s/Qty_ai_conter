<template>
  <div class="setup-page">
    <div class="setup-card">
      <div class="setup-head">
        <img class="setup-logo" src="/logo.ico" alt="logo" />
        <div>
          <h1>系统初始化</h1>
          <p>{{ BRAND.name }} · AI 运营管理工作台</p>
        </div>
      </div>

      <!-- 步骤条 -->
      <div class="steps">
        <div v-for="(s, i) in steps" :key="s" class="step" :class="{ on: i === step, done: i < step }">
          <span class="dot">{{ i < step ? '✓' : i + 1 }}</span><span>{{ s }}</span>
        </div>
      </div>

      <!-- step 0: 欢迎 -->
      <div v-if="step === 0" class="sbody">
        <h2>欢迎使用</h2>
        <p class="muted">首次使用需要连接你的 MySQL 数据库。请确保已在宝塔面板创建好数据库，并记下库名、账号和密码。</p>
        <div class="notice">
          <b>准备清单</b>
          <ul>
            <li>宝塔面板已创建数据库（字符集 utf8mb4）</li>
            <li>已记下数据库名、用户名、密码</li>
            <li>数据库访问权限建议选「本地访问 127.0.0.1」</li>
          </ul>
        </div>
        <button class="primary" @click="step = 1">开始配置 →</button>
      </div>

      <!-- step 1: 数据库配置 -->
      <div v-if="step === 1" class="sbody">
        <h2>连接数据库</h2>
        <p class="muted">填入宝塔面板创建的数据库信息。</p>
        <div class="grid2">
          <label>数据库地址<input v-model="form.host" placeholder="127.0.0.1" /></label>
          <label>端口<input v-model.number="form.port" type="number" placeholder="3306" /></label>
          <label>用户名<input v-model="form.user" placeholder="quetaiyiai" /></label>
          <label>密码<input v-model="form.password" type="password" placeholder="数据库密码" /></label>
          <label class="full">数据库名<input v-model="form.name" placeholder="quetaiyiai" /></label>
        </div>
        <label class="check"><input v-model="form.createDatabase" type="checkbox" /> 数据库不存在时自动创建（需账号有 CREATE 权限）</label>
        <div v-if="testResult" class="result" :class="testResult.ok ? 'ok' : 'err'">
          <template v-if="testResult.ok">✓ 连接成功 · {{ testResult.server }} · 库 {{ testResult.database }} · 可建表：{{ testResult.canWrite ? '是' : '否' }}</template>
          <template v-else>✗ {{ testResult.message }}</template>
        </div>
        <div class="actions">
          <button class="ghost" :disabled="busy" @click="testConnection">{{ busy ? '测试中…' : '测试连接' }}</button>
          <button class="primary" :disabled="busy" @click="step = 2">下一步 →</button>
        </div>
      </div>

      <!-- step 2: 管理员账号 -->
      <div v-if="step === 2" class="sbody">
        <h2>创建公司总管理员</h2>
        <p class="muted">这个账号拥有系统最高权限，可管理连锁所有分店和系统设置。本系统为连锁店版，服务你这一家连锁企业的多门店运营；其他企业需各自下载、独立部署。</p>
        <div class="grid2">
          <label>登录账号<input v-model="form.adminUsername" placeholder="admin" /></label>
          <label>显示名称<input v-model="form.adminName" placeholder="总管理员" /></label>
          <label class="full">初始密码<input v-model="form.adminPassword" type="password" placeholder="至少 8 位" /></label>
        </div>
        <div class="notice">首次登录会强制修改密码。安装成功后还会生成 AES 加密密钥，用于保护飞书凭证和 API Key。</div>
        <button class="primary" @click="step = 3">下一步 →</button>
      </div>

      <!-- step 3: 品牌信息 -->
      <div v-if="step === 3" class="sbody">
        <h2>平台品牌</h2>
        <p class="muted">这些之后都能在系统设置里改。</p>
        <div class="grid2">
          <label class="full">平台名称<input v-model="form.platformName" :placeholder="BRAND.name" /></label>
        </div>
        <button class="primary" @click="doInstall">开始安装 →</button>
      </div>

      <!-- step 4: 安装中 -->
      <div v-if="step === 4" class="sbody center">
        <div class="spinner"></div>
        <h2>正在安装…</h2>
        <p class="muted">{{ installMsg }}</p>
      </div>

      <!-- step 5: 完成 -->
      <div v-if="step === 5" class="sbody">
        <div class="done-icon">✓</div>
        <h2>安装完成</h2>
        <p class="muted">系统已就绪。请妥善保存下面的管理员账号：</p>
        <div class="cred-box">
          <div><span>账号</span><b>{{ result?.admin?.username }}</b></div>
          <div><span>初始密码</span><b>{{ result?.admin?.password }}</b></div>
        </div>
        <div class="notice warn">密码只显示这一次，首次登录后会强制修改。</div>
        <button class="primary" @click="goApp">进入工作台 →</button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api, DEMO } from '../api';
import { BRAND } from '../brand';

const router = useRouter();
const steps = ['欢迎', '数据库', '管理员', '品牌', '安装', '完成'];
const step = ref(0);
const busy = ref(false);
const testResult = ref<any>(null);
const installMsg = ref('准备中…');
const result = ref<any>(null);

const form = reactive<any>({
  host: '127.0.0.1', port: 3306, user: 'quetaiyiai', password: '', name: 'quetaiyiai', createDatabase: false,
  adminUsername: 'admin', adminName: '总管理员', adminPassword: '', platformName: BRAND.name,
});

async function testConnection() {
  busy.value = true; testResult.value = null;
  try {
    testResult.value = await api.testDb(form);
  } catch (e: any) { testResult.value = { ok: false, message: e.message || '连接失败' }; }
  finally { busy.value = false; }
}

async function doInstall() {
  step.value = 4;
  const msgs = ['正在连接数据库…', '正在创建数据表…', '正在初始化数据…', '正在创建管理员…', '即将完成…'];
  let i = 0;
  const timer = setInterval(() => { installMsg.value = msgs[Math.min(i++, msgs.length - 1)]; }, 500);
  try {
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 2200));
      result.value = { admin: { username: form.adminUsername, password: form.adminPassword || 'Demo@2026' } };
    } else {
      result.value = await api.install(form);
    }
    clearInterval(timer);
    step.value = 5;
  } catch (e: any) {
    clearInterval(timer);
    step.value = 1;
    testResult.value = { ok: false, message: e.message || '安装失败' };
  }
}

function goApp() { router.push('/login'); }

onMounted(async () => {
  if (DEMO) return; // 演示模式不检查安装状态，直接可走流程
  try {
    const s = await api.setupStatus();
    if (s.installed) router.replace('/login');
  } catch { /* 未安装或未连通，留在向导 */ }
});
</script>
