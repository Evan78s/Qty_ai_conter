<template>
  <div>
    <div class="page-head">
      <div><div class="page-title">总览驾驶舱</div><div class="page-desc">{{ storeLabel }} · 数据来自「每日对账录入」的真实记录</div></div>
      <div style="display:flex;gap:10px">
        <el-button @click="exportReport"><el-icon><Download /></el-icon>导出日报</el-button>
        <el-button type="primary" @click="openAi"><el-icon><Sparkles /></el-icon>AI 经营解读</el-button>
      </div>
    </div>
    <div class="grid g4">
      <div v-for="k in kpis" :key="k.lb" class="card kpi">
        <div class="top"><span class="lb">{{ k.lb }}</span><span class="ic">{{ k.ic }}</span></div>
        <div class="val num">{{ k.v }}</div>
        <div class="ft"><span class="chip flat">{{ k.ft }}</span></div>
      </div>
    </div>
    <div v-if="!reconciles.length" style="margin-top:14px;padding:14px;background:var(--gold-l);border-radius:8px;font-size:13px;color:var(--ink2)">尚无对账数据。先到「每日对账录入」添加记录，这里会自动汇总真实经营数据。</div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-h"><h3>营业额趋势</h3><el-radio-group v-model="range" size="small"><el-radio-button value="7">近7条</el-radio-button><el-radio-button value="30">全部</el-radio-button></el-radio-group></div><div class="card-b"><div ref="trendEl" class="chart"></div></div></div>
      <div class="card"><div class="card-h"><h3>各门店营业额</h3></div><div class="card-b">
        <div v-for="s in storeRank" :key="s.name" style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line2)">
          <span class="rank" :class="{top:s.rank===1}">{{ s.rank }}</span>
          <div style="flex:1"><div style="font-weight:600">{{ s.name }}</div><div class="bar-cell" style="margin-top:5px"><div class="bar-track"><div class="bar-fill" :style="{width:s.pct+'%'}"></div></div></div></div>
          <div class="num" style="font-weight:700">¥{{ fmt(s.revenue) }}</div>
        </div>
        <div v-if="!storeRank.length" style="padding:24px;text-align:center;color:var(--ink2)">暂无门店业绩数据</div>
      </div></div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-h"><h3>对账记录（最近 {{ visibleReconciles.length }} 条）</h3></div><div class="card-b" style="padding:0">
        <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['日期','门店','营业额','字段数']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
          <tr v-for="r in visibleReconciles" :key="r.id"><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{r.payload?.date}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{storeNameOf(r.storeId)}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">¥{{r.payload?.revenue||'—'}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{(r.payload?.fields||[]).length}}</td></tr>
        </tbody></table>
        <div v-if="!visibleReconciles.length" style="padding:20px;text-align:center;color:var(--ink2)">暂无对账记录</div>
      </div></div>
      <div class="card"><div class="card-h"><h3>今日待办与提醒</h3><span class="tag y">{{ todos.length }} 项待处理</span></div><div class="card-b">
        <div v-for="t in todos" :key="t.title" style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line2);cursor:pointer" @click="router.push(t.path)">
          <span class="tag" :class="t.tag">{{ t.title }}</span><div style="flex:1;font-size:13px">{{ t.desc }}</div><span style="color:var(--ink3)">→</span>
        </div>
        <div v-if="!todos.length" style="padding:20px;text-align:center;color:var(--ink2)">暂无待办，一切正常。</div>
      </div></div>
    </div>

    <el-drawer v-model="aiOpen" title="AI 经营解读" size="440px">
      <div v-if="aiLoading" style="padding:32px;text-align:center;color:var(--ink2)">AI 解读中…</div>
      <div v-else style="background:var(--green-l);padding:14px;border-radius:10px;line-height:1.8;font-size:13px;white-space:pre-wrap">{{ aiResult || '点「开始解读」让 AI 基于当前经营数据给出分析与建议。' }}</div>
      <template #footer><el-button @click="aiOpen=true;runAi()" :loading="aiLoading">开始解读</el-button><el-button type="primary" @click="aiOpen=false">知道了</el-button></template>
    </el-drawer>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAppStore } from '../stores/app';
import { api } from '../api';
import { useChart, axis } from '../composables';

const router = useRouter(); const app = useAppStore();
const range = ref('7'); const aiOpen = ref(false); const aiLoading = ref(false); const aiResult = ref('');
const reconciles = ref<any[]>([]);
const queueCount = ref(0); const materialCount = ref(0); const postCount = ref(0);
const storeLabel = computed(() => app.currentStore === 'all' ? '全部门店' : app.stores.find(s=>s.id===app.currentStore)?.name || '全部门店');
function storeNameOf(id: string) { return id ? (app.stores.find((s: any) => s.id === id)?.name || id) : '全部门店'; }
function fmt(n: number) { return n >= 10000 ? (n / 10000).toFixed(1) + '万' : String(n); }
function numOf(r: any, key: string) {
  const f = (r.payload?.fields || []).find((x: any) => String(x.label).includes(key));
  return f ? Number(String(f.value).replace(/,/g, '')) || 0 : 0;
}

const visibleReconciles = computed(() => {
  const filtered = app.currentStore === 'all' ? reconciles.value : reconciles.value.filter((r) => r.storeId === app.currentStore);
  return [...filtered].sort((a, b) => String(b.payload?.date).localeCompare(String(a.payload?.date)));
});
const shown = computed(() => range.value === '7' ? visibleReconciles.value.slice(0, 7) : visibleReconciles.value);
const totals = computed(() => visibleReconciles.value.reduce((acc, r) => {
  acc.revenue += numOf(r, '总营业额'); acc.card += numOf(r, '耗卡'); acc.recharge += numOf(r, '充值');
  return acc;
}, { revenue: 0, card: 0, recharge: 0 }));
const kpis = computed(() => [
  { lb: '总营业额', v: '¥' + fmt(totals.value.revenue), ic: '💰', ft: `${visibleReconciles.value.length} 条对账` },
  { lb: '耗卡金额', v: '¥' + fmt(totals.value.card), ic: '💳', ft: '累计' },
  { lb: '充值金额', v: '¥' + fmt(totals.value.recharge), ic: '📈', ft: '累计' },
  { lb: '对账记录', v: String(visibleReconciles.value.length), ic: '📋', ft: '条' },
]);
const storeRank = computed(() => {
  const m: Record<string, number> = {};
  for (const r of reconciles.value) {
    if (app.currentStore !== 'all' && r.storeId !== app.currentStore) continue;
    const name = storeNameOf(r.storeId);
    m[name] = (m[name] || 0) + numOf(r, '总营业额');
  }
  const arr = Object.entries(m).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue);
  const max = arr.length ? arr[0].revenue : 1;
  return arr.map((s, i) => ({ ...s, rank: i + 1, pct: max ? s.revenue / max * 100 : 0 }));
});
const todos = computed(() => [
  ...(reconciles.value.length === 0 ? [{ title: '对账录入', desc: '尚无对账数据，去录入今日账单', tag: 'r', path: '/reconcile' }] : []),
  ...(queueCount.value > 0 ? [{ title: 'AI 客服', desc: `${queueCount.value} 条客户消息等待人工回复`, tag: 'r', path: '/service' }] : []),
  ...(materialCount.value === 0 ? [{ title: '内容创作', desc: '素材库为空，去生成营销素材', tag: 'y', path: '/material' }] : []),
  ...(postCount.value === 0 ? [{ title: '发布计划', desc: '暂无发布计划，去安排内容', tag: 'y', path: '/social' }] : []),
]);

const trendEl = ref<HTMLElement | null>(null);
const { render: renderTrend } = useChart(trendEl, () => {
  const data = [...shown.value].reverse();
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['营业额', '耗卡'], right: 0, textStyle: { fontSize: 11, color: '#6B7B74' } },
    grid: { left: 50, right: 16, top: 30, bottom: 24 },
    xAxis: { type: 'category', data: data.length ? data.map((r) => String(r.payload?.date || '').slice(5)) : ['无数据'], ...axis },
    yAxis: { type: 'value', ...axis },
    series: [
      { name: '营业额', type: 'line', smooth: true, data: data.map((r) => numOf(r, '总营业额')), lineStyle: { color: '#2E7D6B', width: 2.5 }, itemStyle: { color: '#2E7D6B' }, areaStyle: { color: 'rgba(46,125,107,.12)' } },
      { name: '耗卡', type: 'line', smooth: true, data: data.map((r) => numOf(r, '耗卡')), lineStyle: { color: '#C9A227', width: 2 }, itemStyle: { color: '#C9A227' } },
    ],
  };
});
watch(range, () => nextTick(renderTrend));
watch(() => app.currentStore, () => nextTick(renderTrend));

async function load() {
  try {
    const [rec, q, mat, posts] = await Promise.all([
      api.bizList('reconcile'), api.bizList('service_queue'), api.bizList('material'), api.bizList('social_post'),
    ]);
    reconciles.value = rec; queueCount.value = q.filter((x: any) => x.status !== 'done').length;
    materialCount.value = mat.length; postCount.value = posts.length;
    await nextTick(); renderTrend();
  } catch (e: any) { ElMessage.error(e.message || '加载数据失败'); }
}
onMounted(load);

function openAi() { aiOpen.value = true; }
async function runAi() {
  if (!visibleReconciles.value.length) return ElMessage.warning('请先录入对账数据');
  aiLoading.value = true; aiResult.value = '';
  try {
    const summary = visibleReconciles.value.slice(0, 10).map((r) => `${r.payload?.date} ${storeNameOf(r.storeId)} 营业额${r.payload?.revenue}`).join('；');
    const data = await api.aiChat({
      prompt: `以下是门店近期经营数据：${summary}。合计营业额 ¥${totals.value.revenue}，耗卡 ¥${totals.value.card}，充值 ¥${totals.value.recharge}。请给出经营分析与 3 条可执行建议。`,
      system: '你是养生馆连锁运营顾问，分析基于数据、建议具体可执行，中文，简洁。',
      scene: 'reconcile',
    });
    aiResult.value = data.content;
  } catch (e: any) {
    if ((e.message || '').includes('Key')) ElMessage.warning('请先到「AI 模型与密钥」配置 Key');
    else ElMessage.error(e.message || '解读失败');
  } finally { aiLoading.value = false; }
}
function exportReport() {
  if (!visibleReconciles.value.length) return ElMessage.warning('暂无数据可导出');
  const head = '日期,门店,营业额,耗卡,充值,字段数';
  const rows = visibleReconciles.value.map((r) => [r.payload?.date, storeNameOf(r.storeId), numOf(r, '总营业额'), numOf(r, '耗卡'), numOf(r, '充值'), (r.payload?.fields || []).length]
    .map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','));
  const blob = new Blob(['\ufeff' + [head, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `经营日报_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
  ElMessage.success('已导出经营日报 CSV');
}
</script>
