<template>
  <div>
    <div class="page-head">
      <div><div class="page-title">店铺业绩看板</div><div class="page-desc">日 / 周 / 月多维业绩，基于「每日对账录入」的真实记录</div></div>
      <div style="display:flex;gap:10px">
        <el-radio-group v-model="period"><el-radio-button value="day">日</el-radio-button><el-radio-button value="week">周</el-radio-button><el-radio-button value="month">月</el-radio-button></el-radio-group>
        <el-button type="primary" @click="openAi"><el-icon><Sparkles /></el-icon>AI 对账核对</el-button>
      </div>
    </div>
    <div v-if="!filtered.length" style="margin-bottom:14px;padding:14px;background:var(--gold-l);border-radius:8px;font-size:13px;color:var(--ink2)">暂无对账数据。先到「每日对账录入」添加，看板会自动汇总。</div>
    <div class="grid g4">
      <div v-for="k in kpis" :key="k.lb" class="card kpi"><div class="top"><span class="lb">{{ k.lb }}</span><span class="ic">📊</span></div><div class="val num">{{ k.v }}</div><div class="ft"><span class="chip flat">{{ k.ft }}</span></div></div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-h"><h3>营业额与耗卡趋势</h3><span class="page-desc">按对账日期</span></div><div class="card-b"><div ref="trendEl" class="chart"></div></div></div>
      <div class="card"><div class="card-h"><h3>对账字段构成</h3></div><div class="card-b"><div ref="projEl" class="chart"></div></div></div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-h"><h3>各门店业绩对比</h3><el-select v-model="metric" size="small" style="width:130px"><el-option label="总营业额" value="revenue"/><el-option label="耗卡金额" value="card"/><el-option label="充值金额" value="recharge"/></el-select></div><div class="card-b">
        <div v-for="(s,i) in ranked" :key="s.name" style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line2)">
          <span class="rank" :class="{top:i===0}">{{ i+1 }}</span><div style="width:110px;font-size:13px">{{ s.name }}</div>
          <div class="bar-cell" style="flex:1"><div class="bar-track"><div class="bar-fill" :style="{width:(max?(s as any)[metric]/max*100:0)+'%'}"></div></div></div>
          <div class="num" style="font-weight:700;min-width:80px;text-align:right">¥{{ fmt((s as any)[metric]) }}</div>
        </div>
        <div v-if="!ranked.length" style="padding:24px;text-align:center;color:var(--ink2)">暂无数据</div>
      </div></div>
      <div class="card"><div class="card-h"><h3>客户来源渠道</h3></div><div class="card-b" style="padding:0">
        <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left;padding:11px 12px;background:#FAFBF9">渠道</th><th style="text-align:left;padding:11px 12px;background:#FAFBF9">识别金额</th></tr></thead><tbody>
          <tr v-for="c in channels" :key="c.name"><td style="padding:10px 12px;border-bottom:1px solid var(--line2)">{{c.name}}</td><td style="padding:10px 12px;border-bottom:1px solid var(--line2)">¥{{c.value}}</td></tr>
        </tbody></table>
        <div v-if="!channels.length" style="padding:20px;text-align:center;color:var(--ink2)">对账文本中含「微信/支付宝/现金/美团/抖音」等渠道时可识别</div>
      </div></div>
    </div>

    <el-drawer v-model="aiOpen" title="AI 对账核对" size="440px">
      <div v-if="aiLoading" style="padding:32px;text-align:center;color:var(--ink2)">AI 核对中…</div>
      <div v-else style="background:var(--green-l);padding:14px;border-radius:10px;line-height:1.8;font-size:13px;white-space:pre-wrap">{{ aiResult || '点「开始核对」让 AI 检查近期对账记录的一致性。' }}</div>
      <template #footer><el-button @click="runAi" :loading="aiLoading">开始核对</el-button><el-button type="primary" @click="writeFeishu">确认写入飞书</el-button></template>
    </el-drawer>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { useAppStore } from '../stores/app';
import { api } from '../api';
import { useChart, axis } from '../composables';

const app = useAppStore();
const period = ref('day'); const metric = ref('revenue'); const aiOpen = ref(false);
const aiLoading = ref(false); const aiResult = ref('');
const all = ref<any[]>([]);
function storeNameOf(id: string) { return id ? (app.stores.find((s: any) => s.id === id)?.name || id) : '全部门店'; }
function fmt(n: number) { return n >= 10000 ? (n / 10000).toFixed(1) + '万' : String(n); }
function numOf(r: any, key: string) {
  const f = (r.payload?.fields || []).find((x: any) => String(x.label).includes(key));
  return f ? Number(String(f.value).replace(/,/g, '')) || 0 : 0;
}
const filtered = computed(() => app.currentStore === 'all' ? all.value : all.value.filter((r) => r.storeId === app.currentStore));
const latest = computed(() => [...filtered.value].sort((a, b) => String(b.payload?.date).localeCompare(String(a.payload?.date))));
const current = computed(() => latest.value[0]);

const kpis = computed(() => {
  const r = current.value;
  const sum = (key: string) => filtered.value.reduce((s, x) => s + numOf(x, key), 0);
  const p = period.value === 'day' ? '今日' : period.value === 'week' ? '本周' : '本月';
  const label = p + (r?.payload?.date ? `(${r.payload.date})` : '');
  return [
    { lb: label + '总营业额', v: '¥' + fmt(period.value === 'day' ? (r ? numOf(r, '总营业额') : 0) : sum('总营业额')), ft: `${filtered.value.length} 条记录` },
    { lb: '耗卡金额', v: '¥' + fmt(sum('耗卡')), ft: '累计' },
    { lb: '充值金额', v: '¥' + fmt(sum('充值')), ft: '累计' },
    { lb: '对账门店', v: String(new Set(filtered.value.map((r) => r.storeId)).size), ft: '家' },
  ];
});
const ranked = computed(() => {
  const m: Record<string, any> = {};
  for (const r of filtered.value) {
    const name = storeNameOf(r.storeId);
    if (!m[name]) m[name] = { name, revenue: 0, card: 0, recharge: 0 };
    m[name].revenue += numOf(r, '总营业额'); m[name].card += numOf(r, '耗卡'); m[name].recharge += numOf(r, '充值');
  }
  return Object.values(m).sort((a: any, b: any) => b.revenue - a.revenue);
});
const max = computed(() => Math.max(1, ...ranked.value.map((s: any) => s[metric.value] || 0)));
const channels = computed(() => {
  const m: Record<string, number> = {};
  for (const r of filtered.value) {
    for (const part of String(r.payload?.text || '').split(/[｜,，]/)) {
      const mm = part.match(/(微信|支付宝|现金|美团|抖音|银行卡|其他)\s*[:：]?\s*([\d,]+)/);
      if (mm) m[mm[1]] = (m[mm[1]] || 0) + Number(mm[2].replace(/,/g, ''));
    }
  }
  return Object.entries(m).map(([name, value]) => ({ name, value }));
});

const trendEl = ref<HTMLElement|null>(null); const projEl = ref<HTMLElement|null>(null);
const { render: rt } = useChart(trendEl, () => {
  const data = [...latest.value].reverse().slice(0, 14);
  const byDate: Record<string, { rev: number; card: number }> = {};
  for (const r of data) {
    const d = String(r.payload?.date || '');
    if (!byDate[d]) byDate[d] = { rev: 0, card: 0 };
    byDate[d].rev += numOf(r, '总营业额'); byDate[d].card += numOf(r, '耗卡');
  }
  const dates = Object.keys(byDate);
  return { tooltip:{trigger:'axis'}, legend:{data:['营业额','耗卡'],right:0,textStyle:{fontSize:11,color:'#6B7B74'}}, grid:{left:50,right:16,top:30,bottom:24}, xAxis:{type:'category',data:dates.length?dates:['无数据'],...axis}, yAxis:{type:'value',...axis},
    series:[{name:'营业额',type:'bar',data:dates.map((d)=>byDate[d].rev),itemStyle:{color:'#2E7D6B',borderRadius:[4,4,0,0]},barMaxWidth:22},{name:'耗卡',type:'bar',data:dates.map((d)=>byDate[d].card),itemStyle:{color:'#C9A227',borderRadius:[4,4,0,0]},barMaxWidth:22}] };
});
useChart(projEl, () => {
  const r = current.value;
  const data = r
    ? (r.payload?.fields || []).filter((f: any) => !/总营业额|渠道合计/.test(f.label)).slice(0, 6).map((f: any) => ({ name: f.label, value: Number(String(f.value).replace(/,/g, '')) || 0 }))
    : [];
  return {tooltip:{trigger:'item'},legend:{orient:'vertical',right:0,top:'center',textStyle:{fontSize:11,color:'#6B7B74'}},series:[{type:'pie',radius:'65%',center:['35%','52%'],data:data.length?data:[{name:'无数据',value:1}],label:{show:false},itemStyle:{borderColor:'#fff',borderWidth:2}}],color:['#2E7D6B','#4A9C86','#C9A227','#E0BE4F','#7FB69F','#B8CFC4']};
});
watch([period, metric, () => app.currentStore], () => nextTick(rt));

async function load() { try { all.value = await api.bizList('reconcile'); await nextTick(); rt(); } catch (e: any) { ElMessage.error(e.message || '加载失败'); } }
onMounted(load);

function openAi() { aiOpen.value = true; }
async function runAi() {
  if (!filtered.value.length) return ElMessage.warning('请先录入对账数据');
  aiLoading.value = true; aiResult.value = '';
  try {
    const detail = latest.value.slice(0, 5).map((r) => `${r.payload?.date}：${(r.payload?.fields || []).map((f: any) => f.label + f.value).join('、')}`).join('\n');
    const data = await api.aiChat({
      prompt: `请核对以下每日对账记录中各字段是否自洽（如渠道之和是否等于总营业额），指出异常：\n${detail}`,
      system: '你是财务对账助手，基于给定数据核对，明确指出不一致之处，中文，简洁。',
      scene: 'reconcile',
    });
    aiResult.value = data.content;
  } catch (e: any) {
    if ((e.message || '').includes('Key')) ElMessage.warning('请先到「AI 模型与密钥」配置 Key');
    else ElMessage.error(e.message || '核对失败');
  } finally { aiLoading.value = false; }
}
async function writeFeishu() {
  try {
    const cap = await api.capabilities();
    if (!cap.capabilities?.feishu?.enabled) return ElMessage.warning('尚未配置飞书凭证/门店表格，请先到「系统设置 → 飞书授权/门店表格绑定」配置');
    ElMessage.info('飞书已配置，数据同步将在业务接口接入后自动生效');
  } catch (e: any) { ElMessage.error(e.message || '检查配置失败'); }
}
</script>
