<template>
  <div>
    <div class="page-head">
      <div><div class="page-title">每日对账录入</div><div class="page-desc">对账为主 · 兼作 AI 助理 · 读写飞书「门店每日台账」· 本地 MySQL 同步留痕</div></div>
      <div style="display:flex;gap:10px;align-items:center">
        <span class="tag g">当前门店：{{ storeName }}</span>
        <el-button :loading="loadingRemote" @click="loadRemote">读取台账</el-button>
      </div>
    </div>

    <div class="grid g2">
      <!-- Agent 对话窗口 -->
      <div class="card"><div class="card-h"><h3>对账 Agent · AI 助理</h3><span class="page-desc">对账识别台账字段，也能回答运营问题 · 使用管理员配置的 Skill</span></div><div class="card-b" style="padding:0">
        <div ref="chatBody" class="agent-body">
          <div v-if="!messages.length" class="agent-empty">
            <div class="empty-icon">✦</div>
            <div class="empty-title">把对账单或问题交给 Agent</div>
            <div class="empty-desc">粘贴收银系统文本可识别台账字段；也可以直接问经营分析、文案、话术等问题。图片请先补充图中金额文字。</div>
            <div class="quick-group"><span>对账</span><div class="quick-list">
              <button v-for="q in reconcilePrompts" :key="q" class="quick" @click="input = q">{{ q }}</button>
            </div></div>
            <div class="quick-group"><span>AI 助理</span><div class="quick-list">
              <button v-for="q in assistantPrompts" :key="q" class="quick" @click="input = q">{{ q }}</button>
            </div></div>
          </div>
          <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
            <div class="avatar">{{ m.role === 'user' ? '我' : 'AI' }}</div>
            <div class="bubble">
              <div class="role">{{ m.role === 'user' ? '你' : '对账 Agent' }}</div>
              <div class="content">{{ m.content }}</div>
              <div v-if="m.fields" class="field-chips">
                <span v-for="(v, k) in m.fields" :key="k" class="chip flat">{{ k }}：{{ v }}</span>
              </div>
            </div>
          </div>
          <div v-if="sending" class="msg assistant"><div class="avatar">AI</div><div class="bubble"><div class="typing">正在核对…</div></div></div>
        </div>
        <div class="agent-input">
          <el-input v-model="input" type="textarea" :rows="3" resize="none" :disabled="sending" placeholder="粘贴对账文本识别台账字段，或直接问运营问题…（Enter 发送，Shift+Enter 换行）" @keydown.enter.exact.prevent="sendAgent" />
          <div class="agent-actions">
            <input ref="fileInput" type="file" accept=".txt,.csv,.md,text/plain,image/*" style="display:none" @change="onFile" />
            <el-button size="small" :disabled="sending" @click="fileInput?.click()">上传文本/截图</el-button>
            <span v-if="fileName" class="mini-note" style="margin:0">{{ fileName }}</span>
            <el-button size="small" :disabled="sending || !messages.length" @click="clearChat">清空对话</el-button>
            <el-button size="small" type="primary" :loading="sending" :disabled="!input.trim()" @click="sendAgent">发送给 Agent</el-button>
          </div>
        </div>
      </div></div>

      <!-- 结果与台账 -->
      <div class="card"><div class="card-h"><h3>核对结果与台账</h3><span class="tag" :class="lastFields ? 'g' : 'y'">{{ lastFields ? '已识别' : '待核对' }}</span></div><div class="card-b">
        <el-form label-position="top">
          <el-form-item label="对账日期"><el-date-picker v-model="date" type="date" style="width:100%" value-format="YYYY-MM-DD" /></el-form-item>
        </el-form>
        <div class="ledger-info">
          <div>台账子表：<b>{{ tableId || '自动匹配「门店每日台账」' }}</b></div>
          <div>飞书记录：<b>{{ remoteRecords.length }}</b> 条</div>
          <div v-if="remoteError" class="err">⚠ {{ remoteError }}</div>
        </div>
        <div v-if="lastFields" class="result-box">
          <b>Agent 识别字段</b>
          <div class="field-chips"><span v-for="(v, k) in lastFields" :key="k" class="chip flat">{{ k }}：{{ v }}</span></div>
          <el-button type="primary" style="margin-top:12px" @click="saveReconcile">确认并写入台账</el-button>
        </div>
        <div v-else class="hint-box">在左侧把对账单发给 Agent，识别后可一键写入飞书台账和本地记录；普通 AI 助理问答不会写入台账。</div>
      </div></div>
    </div>

    <div class="card" style="margin-top:16px"><div class="card-h"><h3>飞书「门店每日台账」记录</h3><span class="page-desc">{{ tableId ? 'table_id: ' + tableId : '未连接' }}</span></div><div class="card-b" style="padding:0">
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in remoteColumns" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
        <tr v-for="(r, i) in remoteRecords" :key="r.recordId || i"><td v-for="h in remoteColumns" :key="h" style="padding:10px 12px;border-bottom:1px solid var(--line2);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ formatField(r.fields?.[h]) }}</td></tr>
      </tbody></table></div>
      <div v-if="!remoteRecords.length" style="padding:24px;text-align:center;color:var(--ink2)">暂无飞书台账记录（可能未绑定表格或未配置「门店每日台账」子表）。</div>
    </div></div>

    <div class="card" style="margin-top:16px"><div class="card-h"><h3>本地对账留痕</h3><span class="page-desc">每次确认都会在本地 MySQL 保存一份</span></div><div class="card-b" style="padding:0">
      <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['日期','门店','总营业额','识别字段','同步状态','创建时间']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
        <tr v-for="r in records" :key="r.id"><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{ r.payload?.date }}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{ storeNameOf(r.storeId) }}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">¥{{ r.payload?.revenue || '—' }}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{ Object.keys(r.payload?.fields || {}).length }} 个</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag" :class="r.payload?.syncError ? 'r' : 'g'">{{ r.payload?.syncError ? '飞书同步失败' : '已同步' }}</span></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{ fmtTime(r.createdAt) }}</td></tr>
      </tbody></table>
      <div v-if="!records.length" style="padding:24px;text-align:center;color:var(--ink2)">暂无本地对账记录。</div>
    </div></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../api';
import { useAppStore } from '../stores/app';

interface Msg { role: 'user' | 'assistant'; content: string; fields?: Record<string, any> }
const app = useAppStore();
const storeName = computed(() => app.currentStore === 'all' ? '全部门店' : (app.stores.find((s: any) => s.id === app.currentStore)?.name || '—'));
function storeNameOf(id: string) { return id ? (app.stores.find((s: any) => s.id === id)?.name || id) : '全部门店'; }

const date = ref(new Date().toISOString().slice(0, 10));
const input = ref('');
const messages = ref<Msg[]>([]);
const lastFields = ref<Record<string, any> | null>(null);
const sending = ref(false);
const chatBody = ref<HTMLElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const fileName = ref('');
const hasImage = ref(false);
const records = ref<any[]>([]);
const remoteRecords = ref<any[]>([]);
const tableId = ref('');
const remoteError = ref('');
const loadingRemote = ref(false);
const reconcilePrompts = ['总营业额 18620，耗卡 6340，充值 9800，请核对', '请帮我检查这段对账文本有没有异常', '把识别结果整理成台账字段'];
const assistantPrompts = ['帮我分析本周营业额下滑的可能原因', '写一条门店新客体验活动文案', '顾客投诉排队太久，帮我拟一段回复话术'];
/** 只有包含台账字段的 JSON 才视为「可写回台账」，避免 AI 助理的普通回答被误识别。 */
const LEDGER_KEYS = ['日期', '门店', '总营业额', '营业额', '耗卡', '充值', '核对结果', '备注', 'date', 'store', 'revenue'];

function scrollChat() { nextTick(() => { if (chatBody.value) chatBody.value.scrollTop = chatBody.value.scrollHeight; }); }

/** 从 Agent 回复里取最后一个 JSON 对象作为可写回台账的字段。 */
function extractFields(content: string): Record<string, any> | null {
  const block = content.match(/```json\s*([\s\S]*?)```/i);
  const plain = content.match(/\{[\s\S]*\}/);
  const raw = block?.[1] || plain?.[0];
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    const keys = Object.keys(obj);
    return keys.some((k) => LEDGER_KEYS.includes(k)) ? obj : null;
  } catch { return null; }
}

function fmtTime(ts: number) { return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'; }
function formatField(v: any) {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
const remoteColumns = computed(() => {
  const keys: string[] = [];
  for (const r of remoteRecords.value.slice(0, 8)) {
    for (const k of Object.keys(r.fields || {})) if (!keys.includes(k)) keys.push(k);
  }
  return keys.slice(0, 8);
});

async function loadLocal() {
  try { records.value = await api.bizList('reconcile'); } catch (e: any) { ElMessage.error(e.message || '加载本地记录失败'); }
}
async function loadRemote() {
  loadingRemote.value = true;
  remoteError.value = '';
  try {
    const data = await api.reconcileRemote(app.currentStore);
    remoteRecords.value = data.records || [];
    tableId.value = data.tableId || '';
  } catch (e: any) {
    remoteRecords.value = [];
    tableId.value = '';
    remoteError.value = e.message || '读取飞书台账失败';
  } finally { loadingRemote.value = false; }
}
onMounted(() => { loadLocal(); loadRemote(); });

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  fileName.value = f.name;
  if (f.type.startsWith('image/')) {
    hasImage.value = true;
    input.value += `${input.value ? '\n' : ''}[已上传截图：${f.name}，请补充图中金额文字]`;
    ElMessage.info('图片已附加；当前模型仅处理文字，请粘贴图中金额便于识别');
  } else {
    const text = await f.text();
    input.value += `${input.value ? '\n' : ''}${text.slice(0, 20000)}`;
  }
  (e.target as HTMLInputElement).value = '';
}

function clearChat() { messages.value = []; lastFields.value = null; }

async function sendAgent() {
  const text = input.value.trim();
  if (!text || sending.value) return;
  input.value = '';
  messages.value.push({ role: 'user', content: text });
  sending.value = true;
  scrollChat();
  try {
    const data = await api.reconcileAgent({
      storeId: app.currentStore,
      messages: messages.value.filter((m) => !m.fields).map((m) => ({ role: m.role, content: m.content })),
    });
    const fields = extractFields(data.content || '');
    messages.value.push({ role: 'assistant', content: data.content || '（无返回）', fields: fields || undefined });
    if (fields) lastFields.value = fields;
  } catch (e: any) {
    const msg = e?.message || 'Agent 处理失败';
    messages.value.push({ role: 'assistant', content: `⚠️ ${msg}` });
    if (String(msg).includes('Key')) ElMessage.warning('请先到「AI 模型与密钥」配置系统全局 Key');
    else ElMessage.error(msg);
  } finally {
    sending.value = false;
    scrollChat();
  }
}

async function saveReconcile() {
  if (!lastFields.value) return;
  const f = lastFields.value as any;
  const revenue = f['总营业额'] ?? f['营业额'] ?? '';
  try {
    const res = await api.reconcileSync({
      storeId: app.currentStore,
      date: date.value,
      revenue,
      fields: f,
      result: f['核对结果'] || '通过',
      text: messages.value.map((m) => `${m.role === 'user' ? '输入' : 'Agent'}：${m.content}`).join('\n').slice(0, 20000),
      hasImage: hasImage.value,
    });
    if (res.syncError) ElMessage.warning(`本地已保存，但飞书写入失败：${res.syncError}`);
    else ElMessage.success('已写入飞书台账并保存本地记录');
    hasImage.value = false;
    await Promise.all([loadLocal(), loadRemote()]);
  } catch (e: any) { ElMessage.error(e.message || '保存失败'); }
}
</script>

<style scoped>
.agent-body { height: 400px; overflow-y: auto; padding: 10px 14px; }
.agent-empty { text-align: center; padding: 36px 10px; color: var(--ink2); }
.empty-icon { font-size: 34px; color: var(--green-d); }
.empty-title { font-size: 15px; font-weight: 700; color: var(--ink); margin-top: 8px; }
.empty-desc { font-size: 12px; margin-top: 4px; }
.quick-group { margin-top: 14px; }
.quick-group > span { display: inline-block; font-size: 11px; color: var(--ink2); border: 1px solid var(--line2); border-radius: 10px; padding: 2px 8px; margin-bottom: 6px; }
.quick-list { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 6px; }
.quick { border: 1px solid var(--line2); background: transparent; color: var(--ink2); border-radius: 18px; padding: 6px 12px; font-size: 12px; cursor: pointer; }
.quick:hover { border-color: var(--green-d); color: var(--green-d); }
.msg { display: flex; gap: 10px; margin: 12px 0; align-items: flex-start; }
.msg.user { flex-direction: row-reverse; }
.avatar { width: 30px; height: 30px; flex: 0 0 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; background: var(--green-d); }
.msg.user .avatar { background: #8a94a6; }
.bubble { max-width: 82%; background: var(--green-l); border: 1px solid var(--line2); border-radius: 10px; padding: 9px 12px; }
.msg.user .bubble { background: #f2f4f7; }
.role { font-size: 11px; color: var(--ink2); margin-bottom: 4px; }
.content { font-size: 13px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; color: var(--ink); }
.typing { font-size: 13px; color: var(--ink2); }
.field-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.agent-input { border-top: 1px solid var(--line2); padding: 12px 14px; }
.agent-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.ledger-info { font-size: 12.5px; color: var(--ink2); line-height: 2; margin: 4px 0 14px; }
.ledger-info b { color: var(--ink); }
.err { color: #c45656; }
.result-box { background: var(--green-l); border-radius: 8px; padding: 12px; font-size: 13px; color: var(--green-d); }
.hint-box { background: #FAFBF9; border: 1px dashed var(--line); border-radius: 8px; padding: 16px; font-size: 12.5px; color: var(--ink2); line-height: 1.8; }
</style>
