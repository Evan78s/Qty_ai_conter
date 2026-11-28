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
      <div v-if="isAiporto" class="aiporto-guide">
        <div class="ag-head"><b>🛳 Aiporto 智港 · 开通三步</b><span>一个 Key 接入多家大模型，统一额度与账单</span></div>
        <div class="ag-links"><a href="https://www.aiporto.net/register" target="_blank" rel="noopener">① 免费注册 ↗</a><a href="https://www.aiporto.net/plans" target="_blank" rel="noopener">② 选择套餐 ↗</a><a href="https://www.aiporto.net/orders" target="_blank" rel="noopener">③ 订单领取 API Key ↗</a><a href="https://www.aiporto.net/docs" target="_blank" rel="noopener">接入指南 ↗</a></div>
        <div class="ag-model"><span>模型别名：</span><el-select v-model="global.model" filterable allow-create default-first-option placeholder="保存 Key 后点右侧按钮拉取" style="width:280px" :disabled="!canEditGlobal"><el-option v-for="m in availableModels" :key="m" :label="m" :value="m" /></el-select><el-button size="small" :loading="modelsLoading" :disabled="!canEditGlobal" @click="loadModels">拉取可用模型</el-button><span class="mini-note" style="margin:0">Key 形如 sk-wb-xxx；模型填网关别名，填厂商真实模型名会报 no route for model。</span></div>
      </div>
      <div style="display:flex;gap:8px;align-items:center"><el-button size="small" :loading="testing" @click="test('global')">测试连接</el-button><span class="mini-note" style="margin:0">Key 以 AES-256-GCM 加密存储，前端仅显示掩码。</span></div>
    </div></div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>模型供应商接入</h3><span class="page-desc">OpenAI 兼容统一适配器 · 选「配置」会填入下方默认供应商</span></div><div class="card-b"><div class="grid g2">
      <div v-for="p in providers" :key="p.id" style="border:1px solid var(--line);border-radius:10px;padding:14px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="width:10px;height:10px;border-radius:50%" :style="{background:p.color}"></span><b>{{p.name}}</b><span v-if="p.tag" class="tag g">{{p.tag}}</span></div><div style="font-size:12px;color:var(--ink2);line-height:1.9"><div>{{p.desc}}</div><div style="font-family:monospace;font-size:11px;color:var(--ink3)">{{p.base}}</div><div>模型：{{p.model || '保存 Key 后拉取网关别名'}}</div></div><div v-if="p.links" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"><a v-for="l in p.links" :key="l.label" :href="l.href" target="_blank" rel="noopener" class="provider-link">{{l.label}} ↗</a></div><div style="margin-top:10px;display:flex;gap:8px"><el-button size="small" :disabled="!canEditGlobal" @click="useProvider(p)">选用此供应商</el-button></div></div>
    </div></div></div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>场景模型绑定</h3></div><div class="card-b" style="padding:0">
      <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['使用场景','当前模型','温度','状态','操作']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
        <tr v-for="s in scenes" :key="s.code"><td style="padding:11px 12px;border-bottom:1px solid var(--line2);font-weight:600">{{s.name}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><el-input v-model="s.model" size="small" placeholder="留空用全局" style="width:180px" :disabled="!canEditGlobal" /></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><el-input v-model="s.temperature" size="small" style="width:80px" :disabled="!canEditGlobal" /></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><el-switch v-model="s.enabled" :disabled="!canEditGlobal" /></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><el-button size="small" text :disabled="!canEditGlobal" @click="saveScene(s)">保存</el-button></td></tr>
      </tbody></table>
    </div></div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>Agent Skill 提示词</h3><span class="page-desc">无需安装插件 · 在这里配置全公司统一使用的 Skill（对账为主，兼作 AI 助理）</span></div><div class="card-b">
      <el-select v-model="skillScene" style="width:220px;margin-bottom:10px"><el-option v-for="s in scenes" :key="s.code" :label="s.name" :value="s.code" /></el-select>
      <el-input v-model="skillPrompt" type="textarea" :rows="8" placeholder="留空则使用系统内置默认提示词" :disabled="!canEditGlobal" />
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><el-button size="small" type="primary" :disabled="!canEditGlobal" @click="saveSkill">保存提示词</el-button><el-button size="small" :disabled="!canEditGlobal" @click="applyDefaultSkill">套用默认 Skill 模板</el-button><span class="mini-note" style="margin:0;align-self:center">点「套用默认 Skill 模板」会自动填入「对账核对 + AI 运营助理」双能力提示词，再点保存即可生效；留空则运行内置默认。</span></div>
    </div></div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>个人自带密钥</h3><span class="tag y">优先级高于全局</span></div><div class="card-b"><el-form label-position="top"><el-form-item label="我的 API Key（留空则使用全局配置）"><el-input v-model="personal.apiKey" type="password" :placeholder="personal.hasKey ? ('已配置 '+personal.apiKeyMasked+'，留空保持') : 'sk-...'" show-password /></el-form-item></el-form><div style="display:flex;gap:8px"><el-button size="small" @click="savePersonal">保存个人 Key</el-button><el-button size="small" :loading="testingPersonal" @click="test('personal')">测试连接</el-button></div><div class="mini-note">密钥优先级：个人自带 Key &gt; 全局默认 Key。留空保存会清空个人 Key。</div></div></div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../api';

const providers = [
  { id: 'aiporto', name: 'Aiporto 智港', desc: '一个 Key 接入多家大模型 · 注册购买套餐后领取 Key 即可对接', base: 'https://gw.aiporto.net/v1', model: '', tag: '推荐', color: '#12B39A',
    links: [
      { label: '免费注册', href: 'https://www.aiporto.net/register' },
      { label: '选择套餐', href: 'https://www.aiporto.net/plans' },
      { label: '订单领 Key', href: 'https://www.aiporto.net/orders' },
      { label: '接入指南', href: 'https://www.aiporto.net/docs' },
    ] },
  { id: 'deepseek', name: 'DeepSeek', desc: '默认模型 · OpenAI 兼容', base: 'https://api.deepseek.com', model: 'deepseek-chat', tag: '', color: '#4A6CF7' },
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
const modelsLoading = ref(false);
const availableModels = ref<string[]>([]);
const isAiporto = computed(() => global.value.provider === 'aiporto' || /aiporto\.net/i.test(global.value.baseUrl || ''));
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

/** 一键套用官方 Skill 模板：填入默认提示词（对账 + AI 助理），仍需点保存生效。 */
async function applyDefaultSkill() {
  try {
    const data = await api.defaultSkill(skillScene.value);
    if (!data?.systemPrompt) { ElMessage.warning('该场景暂无 Skill 模板，请手动填写提示词'); return; }
    skillPrompt.value = data.systemPrompt;
    ElMessage.success('已填入默认模板，确认内容后点「保存提示词」生效');
  } catch (e: any) { ElMessage.error(e.message || '加载默认模板失败'); }
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
  global.value.model = p.model || '';
  availableModels.value = [];
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (p.id === 'aiporto') {
    ElMessage({ message: 'Aiporto：先注册并购买套餐 → 订单领取 Key → 填入上方并保存 → 拉取模型别名即可对接', duration: 6000 });
  } else {
    ElMessage.success(`已选用 ${p.name}，记得填 Key 并保存`);
  }
}
/** 用已保存的 Key 向网关查询可用模型别名（Aiporto 按别名路由，必须先查）。 */
async function loadModels() {
  modelsLoading.value = true;
  try {
    if (global.value.apiKey) await saveAll();
    const data: any = await api.aiModels({ which: 'global', baseUrl: global.value.baseUrl, apiKey: global.value.apiKey || undefined });
    availableModels.value = Array.isArray(data?.models) ? data.models : [];
    if (availableModels.value.length) {
      ElMessage.success(`已获取 ${availableModels.value.length} 个模型别名，选择一个后点「保存配置」`);
    } else {
      ElMessage.warning('网关未返回可用模型，请确认套餐已开通、Key 有效');
    }
  } catch (e: any) { ElMessage.error(e.message || '拉取模型列表失败'); }
  finally { modelsLoading.value = false; }
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
  if (which === 'global' && isAiporto.value && !global.value.model?.trim()) {
    ElMessage.warning('请先点「拉取可用模型」选择 Aiporto 模型别名并保存配置');
    return;
  }
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
<style scoped>
.aiporto-guide { background:#F0FAF8; border:1px solid #BFE8E1; border-radius:10px; padding:12px 14px; margin-bottom:12px; }
.ag-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:13px; color:var(--ink); }
.ag-head span { font-size:12px; color:var(--ink2); }
.ag-links { display:flex; flex-wrap:wrap; gap:8px; margin:10px 0; }
.ag-links a, .provider-link { color:#0B8E78; font-size:12px; text-decoration:none; border:1px solid #BFE8E1; background:#fff; border-radius:6px; padding:4px 9px; }
.ag-links a:hover, .provider-link:hover { color:#fff; background:#0B8E78; }
.ag-model { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:12px; color:var(--ink2); }
</style>
