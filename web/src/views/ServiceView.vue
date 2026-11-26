<template>
  <div>
    <div class="page-head"><div><div class="page-title">AI 客服接待管理</div><div class="page-desc">知识库维护 · 人工接待协同 · 飞书群每日推送（数据保存本机，配飞书后可同步）</div></div><el-button type="primary" @click="openKb('')"><el-icon><Plus /></el-icon>新增知识条目</el-button></div>
    <div class="grid g4">
      <div v-for="k in kpis" :key="k.lb" class="card kpi"><div class="top"><span class="lb">{{k.lb}}</span><span class="ic">🤖</span></div><div class="val num">{{k.v}}</div><div class="ft"><span class="chip flat">{{k.ch}}</span>当前统计</div></div>
    </div>
    <div style="margin-top:16px"><el-tabs v-model="tab">
      <!-- 待人工接待 -->
      <el-tab-pane label="待人工接待" name="queue">
        <div class="card"><div class="card-h"><h3>待人工接待队列</h3><el-button size="small" @click="openQueue">+ 添加接待</el-button></div><div class="card-b" style="padding:0">
          <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['客户','问题摘要','来源','状态','操作']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
            <tr v-for="q in queue" :key="q.id"><td style="padding:11px 12px;border-bottom:1px solid var(--line2);font-weight:600">{{q.payload?.name}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2);max-width:260px">{{q.payload?.question}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag gray">{{q.payload?.source}}</span></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag" :class="q.status==='done'?'g':'r'">{{q.status==='done'?'已处理':'待接待'}}</span></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><el-button v-if="q.status!=='done'" type="primary" size="small" @click="reply(q)">回复</el-button><el-button size="small" text type="danger" @click="delItem('service_queue',q)">删除</el-button></td></tr>
          </tbody></table>
          <div v-if="!queue.length" style="padding:24px;text-align:center;color:var(--ink2)">暂无待接待客户，点「添加接待」录入。</div>
        </div></div>
      </el-tab-pane>
      <!-- 知识库 -->
      <el-tab-pane label="知识库" name="kb">
        <div class="card"><div class="card-h"><h3>知识库（保存本机，可同步飞书）</h3><el-button size="small" @click="syncFeishu">同步飞书</el-button></div><div class="card-b" style="padding:0">
          <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['标准问法','答案摘要','标签','命中次数','状态','操作']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
            <tr v-for="k in kb" :key="k.id"><td style="padding:11px 12px;border-bottom:1px solid var(--line2);font-weight:600">{{k.title}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2);color:var(--ink2);max-width:260px">{{k.payload?.answer}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag g">{{k.payload?.tag}}</span></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{k.payload?.hits||0}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag" :class="k.status==='active'?'g':'gray'">{{k.status==='active'?'启用':'停用'}}</span></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><el-button size="small" text @click="openKb(k)">编辑</el-button><el-button size="small" text type="danger" @click="delItem('kb',k)">删除</el-button></td></tr>
          </tbody></table>
          <div v-if="!kb.length" style="padding:24px;text-align:center;color:var(--ink2)">暂无知识条目，点右上角「新增知识条目」添加。</div>
        </div></div>
      </el-tab-pane>
      <!-- 回复记录 -->
      <el-tab-pane label="AI 回复记录" name="replies">
        <div class="card"><div class="card-h"><h3>回复记录</h3></div><div class="card-b" style="padding:0">
          <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['时间','客户','客户问题','回复内容','结果']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
            <tr v-for="r in replies" :key="r.id"><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{fmtTime(r.createdAt)}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{r.payload?.name}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{r.payload?.question}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{r.payload?.reply}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag g">已处理</span></td></tr>
          </tbody></table>
          <div v-if="!replies.length" style="padding:24px;text-align:center;color:var(--ink2)">暂无回复记录。</div>
        </div></div>
      </el-tab-pane>
      <!-- 成交记录 -->
      <el-tab-pane label="成交记录" name="deals">
        <div class="mini-note" style="margin-bottom:10px">录入每一笔真实成交，投流看板的 <b>ROAS 会自动用这里的成交额计算</b>（当日成交额 ÷ 当日花费），比「转化 × 客单价」的估算更准确。不录入时看板才回退到估算口径。</div>
        <div class="card"><div class="card-h"><h3>成交记录</h3><el-button size="small" type="primary" @click="openDeal"><el-icon><Plus /></el-icon>新增成交</el-button></div><div class="card-b" style="padding:0">
          <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['成交日期','客户','项目/套餐','金额','来源','门店','备注','操作']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
            <tr v-for="d in deals" :key="d.id"><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{d.payload?.date}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2);font-weight:600">{{d.payload?.customer}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{d.payload?.item}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2);color:var(--up);font-weight:600">¥{{fmtNum(d.payload?.amount)}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag gray">{{d.payload?.source||'—'}}</span></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{storeName(d.storeId)}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2);color:var(--ink2);max-width:180px">{{d.payload?.note||''}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><el-button size="small" text @click="openDeal(d)">编辑</el-button><el-button size="small" text type="danger" @click="delItem('service_deal',d)">删除</el-button></td></tr>
          </tbody></table>
          <div v-if="!deals.length" style="padding:24px;text-align:center;color:var(--ink2)">暂无成交记录，点「新增成交」录入第一笔。</div>
        </div>
        <div style="padding:12px 16px;border-top:1px solid var(--line2);display:flex;gap:24px;font-size:13px;color:var(--ink2)">
          <span>累计成交 <b style="color:var(--ink);font-size:16px">{{deals.length}}</b> 笔</span>
          <span>成交总额 <b style="color:var(--up);font-size:16px">¥{{fmtNum(dealTotal)}}</b></span>
          <span>平均客单价 <b style="color:var(--ink);font-size:16px">¥{{fmtNum(deals.length?dealTotal/deals.length:0)}}</b></span>
        </div></div>
      </el-tab-pane>
      <!-- 推送配置 -->
      <el-tab-pane label="飞书推送配置" name="push">
        <div class="grid g2"><div class="card"><div class="card-h"><h3>每日定时推送</h3><span class="tag" :class="pushCfg.enabled?'g':'gray'">{{pushCfg.enabled?'已启用':'已停用'}}</span></div><div class="card-b">
          <el-form label-position="top">
            <el-form-item label="推送时间"><el-time-picker v-model="pushTime" format="HH:mm" style="width:100%"/></el-form-item>
            <el-form-item label="推送内容"><el-select v-model="pushCfg.content" style="width:100%"><el-option label="待人工接待信息汇总" value="待人工接待信息汇总"/><el-option label="客服接待日报" value="客服接待日报"/></el-select></el-form-item>
            <el-form-item label="飞书群机器人 Webhook"><el-input v-model="pushCfg.webhook" type="password" show-password placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."/></el-form-item>
            <el-form-item label="目标飞书群"><el-input v-model="pushCfg.group" placeholder="如：客服接待群"/></el-form-item>
            <el-form-item label="启用"><el-switch v-model="pushCfg.enabled" /></el-form-item>
          </el-form>
          <el-button type="primary" :loading="savingPush" @click="savePush">保存配置</el-button>
        </div></div>
        <div class="card"><div class="card-h"><h3>推送预览</h3><el-button size="small" @click="sendTest">发送测试</el-button></div><div class="card-b">
          <div style="border:1px solid var(--line);border-radius:10px;overflow:hidden"><div style="background:var(--green);color:#fff;padding:10px 14px;font-weight:600;font-size:13px">🤖 {{pushCfg.content}} · {{today}}</div><div style="padding:14px;font-size:12.5px;line-height:1.9;background:#FAFBF9">待人工接待 <b style="color:var(--up)">{{ pendingCount }}</b> 条：<br><span v-for="q in pending" :key="q.id" style="padding-left:12px;color:var(--ink2)">· {{q.payload?.name}}：{{q.payload?.question}}<br></span><span v-if="!pending.length" style="padding-left:12px;color:var(--ink2)">暂无待接待</span></div></div>
        </div></div></div>
      </el-tab-pane>
    </el-tabs></div>

    <!-- 知识库弹窗 -->
    <el-dialog v-model="kbDialog" :title="editingKb?'编辑知识条目':'新增知识条目'" width="500px">
      <el-form label-position="top"><el-form-item label="标准问法"><el-input v-model="kbForm.question" placeholder="客户最常问的问题"/></el-form-item><el-form-item label="答案"><el-input v-model="kbForm.answer" type="textarea" :rows="4" placeholder="标准答案内容"/></el-form-item><el-form-item label="标签"><el-select v-model="kbForm.tag" style="width:100%"><el-option label="门店信息" value="门店信息"/><el-option label="价格套餐" value="价格套餐"/><el-option label="预约服务" value="预约服务"/></el-select></el-form-item></el-form>
      <template #footer><el-button @click="kbDialog=false">取消</el-button><el-button type="primary" :loading="saving" @click="submitKb">保存</el-button></template>
    </el-dialog>
    <!-- 添加接待弹窗 -->
    <el-dialog v-model="queueDialog" title="添加待接待客户" width="460px">
      <el-form label-position="top"><el-form-item label="客户称呼"><el-input v-model="queueForm.name"/></el-form-item><el-form-item label="问题摘要"><el-input v-model="queueForm.question" type="textarea" :rows="3"/></el-form-item><el-form-item label="来源"><el-select v-model="queueForm.source" style="width:100%"><el-option label="小红书私信" value="小红书私信"/><el-option label="微信公众号" value="微信公众号"/><el-option label="Messenger" value="Messenger"/><el-option label="到店咨询" value="到店咨询"/></el-select></el-form-item></el-form>
      <template #footer><el-button @click="queueDialog=false">取消</el-button><el-button type="primary" @click="submitQueue">添加</el-button></template>
    </el-dialog>
    <!-- 回复弹窗 -->
    <el-dialog v-model="replyDialog" :title="'回复客户 · '+replyName" width="500px">
      <el-form label-position="top"><el-form-item label="客户问题"><el-input type="textarea" :rows="2" :model-value="replyQuestion" readonly/></el-form-item><el-form-item label="输入回复"><el-input v-model="replyText" type="textarea" :rows="4" placeholder="输入人工回复内容…"/></el-form-item></el-form>
      <template #footer><el-button @click="replyDialog=false">取消</el-button><el-button type="primary" :loading="saving" @click="submitReply">发送并保存</el-button></template>
    </el-dialog>
    <!-- 成交记录弹窗 -->
    <el-dialog v-model="dealDialog" :title="editingDeal?'编辑成交记录':'新增成交记录'" width="520px">
      <el-form label-position="top">
        <div class="grid g2">
          <el-form-item label="成交日期"><el-date-picker v-model="dealForm.date" type="date" value-format="YYYY-MM-DD" style="width:100%" placeholder="选择成交日期"/></el-form-item>
          <el-form-item label="成交金额（¥）"><el-input-number v-model="dealForm.amount" :min="0" :precision="2" :step="100" style="width:100%"/></el-form-item>
        </div>
        <div class="grid g2">
          <el-form-item label="客户称呼"><el-input v-model="dealForm.customer" placeholder="如：王女士"/></el-form-item>
          <el-form-item label="项目/套餐"><el-input v-model="dealForm.item" placeholder="如：肩颈调理10次卡"/></el-form-item>
        </div>
        <div class="grid g2">
          <el-form-item label="来源"><el-select v-model="dealForm.source" style="width:100%"><el-option label="Meta 广告" value="Meta 广告"/><el-option label="小红书私信" value="小红书私信"/><el-option label="微信公众号" value="微信公众号"/><el-option label="Messenger" value="Messenger"/><el-option label="到店咨询" value="到店咨询"/><el-option label="老客转介" value="老客转介"/></el-select></el-form-item>
          <el-form-item label="归属门店"><el-select v-model="dealForm.storeId" style="width:100%" clearable placeholder="公司级（不指定）"><el-option v-for="s in storeList" :key="s.id" :label="s.name" :value="s.id"/></el-select></el-form-item>
        </div>
        <el-form-item label="备注"><el-input v-model="dealForm.note" type="textarea" :rows="2" placeholder="可选，补充说明"/></el-form-item>
      </el-form>
      <template #footer><el-button @click="dealDialog=false">取消</el-button><el-button type="primary" :loading="saving" @click="submitDeal">保存</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';

const tab = ref('queue');
const kb = ref<any[]>([]); const queue = ref<any[]>([]); const replies = ref<any[]>([]); const deals = ref<any[]>([]);
const storeList = ref<any[]>([]);
const kbDialog = ref(false); const queueDialog = ref(false); const replyDialog = ref(false); const dealDialog = ref(false);
const editingKb = ref(''); const editingDeal = ref(''); const saving = ref(false); const savingPush = ref(false);
const kbForm = ref<any>({ question: '', answer: '', tag: '门店信息' });
const queueForm = ref<any>({ name: '', question: '', source: '小红书私信' });
const dealForm = ref<any>({ date: new Date().toISOString().slice(0, 10), amount: 0, customer: '', item: '', source: 'Meta 广告', storeId: '', note: '' });
const replyName = ref(''); const replyQuestion = ref(''); const replyText = ref(''); const replyTarget = ref<any>(null);
const pushTime = ref<Date>(new Date());
const pushCfg = ref<any>({ content: '待人工接待信息汇总', webhook: '', group: '', enabled: true });
const today = new Date().toLocaleDateString('zh-CN');

const dealTotal = computed(() => deals.value.reduce((s, d) => s + (Number(d.payload?.amount) || 0), 0));
function fmtNum(n: any) { const v = Number(n) || 0; return v >= 10000 ? (v / 10000).toFixed(1) + '万' : String(v); }
function storeName(id: string) { return id ? (storeList.value.find((s) => s.id === id)?.name || id) : '公司级'; }

const pending = computed(() => queue.value.filter((q) => q.status !== 'done'));
const pendingCount = computed(() => pending.value.length);
const kpis = computed(() => [
  { lb: '待人工接待', v: String(pending.value.length), ch: '实时' },
  { lb: '成交总额', v: '¥' + fmtNum(dealTotal.value), ch: deals.value.length + ' 笔' },
  { lb: '回复记录', v: String(replies.value.length), ch: '条' },
  { lb: '知识条目', v: String(kb.value.length), ch: '条' },
]);

async function load() {
  try {
    const [k, q, r, p, d, stores] = await Promise.all([
      api.bizList('kb'), api.bizList('service_queue'), api.bizList('service_reply'), api.bizList('push_config'),
      api.bizList('service_deal'), api.settingStores().catch(() => []),
    ]);
    kb.value = k; queue.value = q; replies.value = r; deals.value = d; storeList.value = stores || [];
    if (p.length && p[0].payload) {
      Object.assign(pushCfg.value, p[0].payload);
      if (p[0].payload.time) {
        const [hh, mm] = p[0].payload.time.split(':').map(Number);
        pushTime.value = new Date(2026, 0, 1, hh || 9, mm || 0);
      }
    }
  } catch (e: any) { ElMessage.error(e.message || '加载失败'); }
}
onMounted(load);

function openKb(k: any) {
  editingKb.value = k?.id || '';
  kbForm.value = k ? { question: k.title, answer: k.payload?.answer || '', tag: k.payload?.tag || '门店信息' } : { question: '', answer: '', tag: '门店信息' };
  kbDialog.value = true;
}
async function submitKb() {
  if (!kbForm.value.question || !kbForm.value.answer) return ElMessage.warning('请填写问法和答案');
  saving.value = true;
  try {
    const body = { storeId: '', title: kbForm.value.question, payload: { answer: kbForm.value.answer, tag: kbForm.value.tag, hits: kbForm.value.hits || 0 } };
    if (editingKb.value) await api.bizUpdate('kb', editingKb.value, body);
    else await api.bizCreate('kb', body);
    kbDialog.value = false; ElMessage.success('知识条目已保存'); await load();
  } catch (e: any) { ElMessage.error(e.message || '保存失败'); }
  finally { saving.value = false; }
}
function openQueue() { queueForm.value = { name: '', question: '', source: '小红书私信' }; queueDialog.value = true; }
async function submitQueue() {
  if (!queueForm.value.name || !queueForm.value.question) return ElMessage.warning('请填写客户和问题');
  try {
    await api.bizCreate('service_queue', { storeId: '', title: queueForm.value.name, payload: { ...queueForm.value }, status: 'active' });
    queueDialog.value = false; ElMessage.success('已添加到待接待队列'); await load();
  } catch (e: any) { ElMessage.error(e.message || '添加失败'); }
}
function reply(q: any) { replyTarget.value = q; replyName.value = q.payload?.name; replyQuestion.value = q.payload?.question || ''; replyText.value = ''; replyDialog.value = true; }
async function submitReply() {
  if (!replyText.value.trim()) return ElMessage.warning('请输入回复内容');
  saving.value = true;
  try {
    await api.bizCreate('service_reply', { storeId: '', title: replyName.value, payload: { name: replyName.value, question: replyQuestion.value, reply: replyText.value } });
    if (replyTarget.value) await api.bizUpdate('service_queue', replyTarget.value.id, { status: 'done' });
    replyDialog.value = false; ElMessage.success('回复已保存'); await load();
  } catch (e: any) { ElMessage.error(e.message || '发送失败'); }
  finally { saving.value = false; }
}
function openDeal(d?: any) {
  editingDeal.value = d?.id || '';
  dealForm.value = d
    ? { date: d.payload?.date || '', amount: Number(d.payload?.amount) || 0, customer: d.payload?.customer || '', item: d.payload?.item || '', source: d.payload?.source || 'Meta 广告', storeId: d.storeId || '', note: d.payload?.note || '' }
    : { date: new Date().toISOString().slice(0, 10), amount: 0, customer: '', item: '', source: 'Meta 广告', storeId: '', note: '' };
  dealDialog.value = true;
}
async function submitDeal() {
  const f = dealForm.value;
  if (!f.date) return ElMessage.warning('请选择成交日期');
  if (!(Number(f.amount) > 0)) return ElMessage.warning('请填写成交金额');
  saving.value = true;
  try {
    const body = { storeId: f.storeId || '', title: `${f.customer || '客户'} · ${f.item || '成交'}`, payload: { ...f } };
    if (editingDeal.value) await api.bizUpdate('service_deal', editingDeal.value, body);
    else await api.bizCreate('service_deal', body);
    dealDialog.value = false; ElMessage.success('成交记录已保存，投流看板 ROAS 将自动更新'); await load();
  } catch (e: any) { ElMessage.error(e.message || '保存失败'); }
  finally { saving.value = false; }
}
async function delItem(type: string, item: any) {
  try { await ElMessageBox.confirm('确定删除这条记录吗？', '删除', { type: 'warning' }); } catch { return; }
  try { await api.bizDelete(type, item.id); ElMessage.success('已删除'); await load(); }
  catch (e: any) { ElMessage.error(e.message || '删除失败'); }
}
async function syncFeishu() {
  try {
    const cap = await api.capabilities();
    if (!cap.capabilities?.feishu?.enabled) return ElMessage.warning('尚未配置飞书凭证/门店表格，请先到「系统设置 → 飞书授权/门店表格绑定」配置后再同步');
    ElMessage.info('飞书已配置，同步功能将在业务接口接入后自动生效');
  } catch (e: any) { ElMessage.error(e.message || '检查配置失败'); }
}
async function savePush() {
  savingPush.value = true;
  try {
    const time = `${String(pushTime.value.getHours()).padStart(2, '0')}:${String(pushTime.value.getMinutes()).padStart(2, '0')}`;
    const body = { storeId: '', title: '飞书推送配置', payload: { ...pushCfg.value, time } };
    const existing = await api.bizList('push_config');
    if (existing.length) await api.bizUpdate('push_config', existing[0].id, body);
    else await api.bizCreate('push_config', body);
    ElMessage.success('推送配置已保存'); await load();
  } catch (e: any) { ElMessage.error(e.message || '保存失败'); }
  finally { savingPush.value = false; }
}
async function sendTest() {
  try {
    if (!pushCfg.value.webhook) return ElMessage.warning('请先填写飞书群机器人 Webhook 并保存');
    ElMessage.info('测试推送将在飞书机器人接口接入后发送');
  } catch (e: any) { ElMessage.error(e.message || '发送失败'); }
}
function fmtTime(ts: number) { return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'; }
</script>
