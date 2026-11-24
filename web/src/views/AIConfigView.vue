<template>
  <div>
    <div class="page-head"><div><div class="page-title">AI 模型与密钥</div><div class="page-desc">全局默认密钥（总管理员配置）+ 个人自带密钥 · 统一适配器多厂商接入</div></div><el-button type="primary" :loading="saving" @click="saveAll">保存配置</el-button></div>
    <div class="card"><div class="card-h"><h3>🔑 全局默认模型（所有用户回退使用）</h3><span class="tag g">总管理员可配置</span></div><div class="card-b">
      <div class="grid g3">
        <el-form-item label="默认供应商"><el-select v-model="global.provider" style="width:100%" :disabled="!canEditGlobal"><el-option label="DeepSeek" value="deepseek"/><el-option label="方舟 Agent Plan" value="arkplan"/><el-option label="方舟 Ark（按量）" value="ark"/><el-option label="阿里百炼" value="bailian"/><el-option label="自定义接口" value="custom"/></el-select></el-form-item>
        <el-form-item label="默认模型"><el-input v-model="global.model" placeholder="如 deepseek-chat" :disabled="!canEditGlobal" /></el-form-item>
        <el-form-item label="全局 API Key"><el-input v-model="global.apiKey" type="password" :placeholder="global.hasKey ? ('已配置 '+global.apiKeyMasked+'，留空不修改') : '粘贴 API Key'" show-password :disabled="!canEditGlobal" /></el-form-item>
      </div>
      <div class="grid g2">
        <el-form-item label="接口地址（OpenAI 兼容）"><el-input v-model="global.baseUrl" placeholder="https://api.deepseek.com" :disabled="!canEditGlobal" /></el-form-item>
        <el-form-item label="温度"><el-input v-model="global.temperature" placeholder="0.3" :disabled="!canEditGlobal" /></el-form-item>
      </div>
      <div style="display:flex;gap:8px;align-items:center"><el-button size="small" :loading="testing" @click="test('global')">测试连接</el-button><span class="mini-note" style="margin:0">Key 以 AES-256-GCM 加密存储，前端仅显示掩码。</span></div>
    </div></div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>模型供应商接入</h3><span class="page-desc">OpenAI 兼容统一适配器 · 选「配置」会填入下方默认供应商</span></div><div class="card-b"><div class="grid g2">
      <div v-for="p in providers" :key="p.id" style="border:1px solid var(--line);border-radius:10px;padding:14px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="width:10px;height:10px;border-radius:50%" :style="{background:p.color}"></span><b>{{p.name}}</b><span v-if="p.tag" class="tag g">{{p.tag}}</span></div><div style="font-size:12px;color:var(--ink2);line-height:1.9"><div>{{p.desc}}</div><div style="font-family:monospace;font-size:11px;color:var(--ink3)">{{p.base}}</div><div>模型：{{p.model}}</div></div><div style="margin-top:10px;display:flex;gap:8px"><el-button size="small" :disabled="!canEditGlobal" @click="useProvider(p)">选用此供应商</el-button></div></div>
    </div></div></div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>场景模型绑定</h3></div><div class="card-b" style="padding:0">
      <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['使用场景','当前模型','温度','状态','操作']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
        <tr v-for="s in scenes" :key="s.code"><td style="padding:11px 12px;border-bottom:1px solid var(--line2);font-weight:600">{{s.name}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><el-input v-model="s.model" size="small" placeholder="留空用全局" style="width:180px" :disabled="!canEditGlobal" /></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><el-input v-model="s.temperature" size="small" style="width:80px" :disabled="!canEditGlobal" /></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><el-switch v-model="s.enabled" :disabled="!canEditGlobal" /></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><el-button size="small" text :disabled="!canEditGlobal" @click="saveScene(s)">保存</el-button></td></tr>
      </tbody></table>
    </div></div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>Agent Skill 提示词</h3><span class="page-desc">管理员统一配置 · 对账对话窗口调用「对账核对」场景</span></div><div class="card-b">
      <el-select v-model="skillScene" style="width:220px;margin-bottom:10px"><el-option v-for="s in scenes" :key="s.code" :label="s.name" :value="s.code" /></el-select>
      <el-input v-model="skillPrompt" type="textarea" :rows="6" placeholder="留空则使用系统内置默认提示词" :disabled="!canEditGlobal" />
      <div style="display:flex;gap:8px;margin-top:10px"><el-button size="small" type="primary" :disabled="!canEditGlobal" @click="saveSkill">保存提示词</el-button><span class="mini-note" style="margin:0;align-self:center">提示词决定 Agent 如何解析上传/粘贴内容并输出可写回多维表格的字段。</span></div>
    </div></div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>个人自带密钥</h3><span class="tag y">优先级高于全局</span></div><div class="card-b"><el-form label-position="top"><el-form-item label="我的 API Key（留空则使用全局配置）"><el-input v-model="personal.apiKey" type="password" :placeholder="personal.hasKey ? ('已配置 '+personal.apiKeyMasked+'，留空保持') : 'sk-...'" show-password /></el-form-item></el-form><div style="display:flex;gap:8px"><el-button size="small" @click="savePersonal">保存个人 Key</el-button><el-button size="small" :loading="testingPersonal" @click="test('personal')">测试连接</el-button></div><div class="mini-note">密钥优先级：个人自带 Key &gt; 全局默认 Key。留空保存会清空个人 Key。</div></div></div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../api';

const providers = [
  { id: 'deepseek', name: 'DeepSeek', desc: '默认模型 · OpenAI 兼容', base: 'https://api.deepseek.com', model: 'deepseek-chat', tag: '推荐', color: '#4A6CF7' },
  { id: 'arkplan', name: '方舟 Agent Plan', desc: '订阅制 AFP · 含多模态/视频', base: 'https://ark.cn-beijing.volces.com/api/plan/v3', model: 'doubao-seed-2.0-pro', tag: '', color: '#E8582F' },
  { id: 'ark', name: '方舟 Ark（按量）', desc: '独立端点 · 接入点 ep-xxx', base: 'https://ark.cn-beijing.volces.com/api/v3', model: 'ep-2026xxxx', tag: '', color: '#E88A2F' },
  { id: 'bailian', name: '阿里百炼', desc: 'DashScope 兼容模式', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', tag: '', color: '#627EF6' },
  { id: 'custom', name: '自定义接口', desc: '通用 OpenAI 兼容端点', base: 'https://your-api.com/v1', model: 'custom-model', tag: '', color: '#8A97A2' },
];
const global = ref<any>({ provider: 'deepseek', model: '', baseUrl: '', temperature: '0.3', apiKey: '', apiKeyMasked: '', hasKey: false });
const personal = ref<any>({ apiKey: '', apiKeyMasked: '', hasKey: false });
const scenes = ref<any[]>([]);
const canEditGlobal = ref(false);
const saving = ref(false); const testing = ref(false); const testingPersonal = ref(false);
const skillScene = ref('reconcile');
const skillPrompt = computed({
  get: () => scenes.value.find((s) => s.code === skillScene.value)?.systemPrompt || '',
  set: (v: string) => { const s = scenes.value.find((x) => x.code === skillScene.value); if (s) s.systemPrompt = v; },
});
async function saveSkill() {
  const s = scenes.value.find((x) => x.code === skillScene.value);
  if (!s) return;
  try { await api.updateAiScene(s.code, { systemPrompt: s.systemPrompt || '' }); ElMessage.success(`${s.name} 提示词已保存`); }
  catch (e: any) { ElMessage.error(e.message || '保存失败'); }
}

async function load() {
  try {
    const data = await api.aiConfig();
    if (data.global) Object.assign(global.value, data.global);
    if (data.personal) Object.assign(personal.value, data.personal);
    scenes.value = data.scenes || [];
    canEditGlobal.value = !!data.canEditGlobal;
  } catch (e: any) { ElMessage.error(e.message || '加载配置失败'); }
}
onMounted(load);

function useProvider(p: any) {
  global.value.provider = p.id;
  global.value.baseUrl = p.base;
  global.value.model = p.model;
  ElMessage.success(`已选用 ${p.name}，记得填 Key 并保存`);
}
async function saveAll() {
  if (!canEditGlobal.value) return ElMessage.warning('仅总管理员可修改全局配置');
  saving.value = true;
  try {
    await api.saveAiGlobal({ provider: global.value.provider, baseUrl: global.value.baseUrl, model: global.value.model, temperature: global.value.temperature, apiKey: global.value.apiKey });
    global.value.apiKey = '';
    ElMessage.success('全局配置已保存');
    await load();
  } catch (e: any) { ElMessage.error(e.message || '保存失败'); }
  finally { saving.value = false; }
}
async function savePersonal() {
  try {
    await api.saveAiPersonal({ apiKey: personal.value.apiKey });
    personal.value.apiKey = '';
    ElMessage.success('个人 Key 已保存');
    await load();
  } catch (e: any) { ElMessage.error(e.message || '保存失败'); }
}
async function saveScene(s: any) {
  try { await api.updateAiScene(s.code, { model: s.model, temperature: s.temperature, enabled: s.enabled, systemPrompt: s.systemPrompt || '' }); ElMessage.success(`${s.name} 已保存`); }
  catch (e: any) { ElMessage.error(e.message || '保存失败'); }
}
async function test(which: 'global' | 'personal') {
  if (which === 'global') testing.value = true; else testingPersonal.value = true;
  try {
    // 若本次输入了新 Key，先保存再测试
    if (which === 'global' && global.value.apiKey) await saveAll();
    if (which === 'personal' && personal.value.apiKey) await savePersonal();
    const data = await api.testAi(which);
    ElMessage.success(`连接成功 · ${data.provider || ''} ${data.model || ''}`);
  } catch (e: any) { ElMessage.error(e.message || '连接失败'); }
  finally { testing.value = false; testingPersonal.value = false; }
}
</script>
