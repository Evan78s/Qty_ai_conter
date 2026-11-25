<template>
  <div>
    <div class="page-head">
      <div><div class="page-title">境外推广看板</div><div class="page-desc">Meta 与 Google Ads 投流数据 · 录入真实数据后自动统计</div></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><el-radio-group v-model="platform"><el-radio-button value="meta">Meta</el-radio-button><el-radio-button value="google">Google Ads</el-radio-button></el-radio-group><template v-if="platform==='meta'"><el-button :loading="syncing" @click="syncMeta">从 Meta 同步</el-button><el-button @click="csvDialog=true">导入 CSV</el-button></template><el-button @click="entryDialog=true">+ 录入数据</el-button><el-button type="primary" @click="runAi"><el-icon><Sparkles /></el-icon>AI 分析</el-button></div>
    </div>
    <div class="grid g4">
      <div v-for="k in kpis" :key="k.lb" class="card kpi"><div class="top"><span class="lb">{{ k.lb }}</span><span class="ic">{{ k.ic }}</span></div><div class="val num">{{ k.v }}</div><div class="ft"><span class="chip flat">{{ k.ft }}</span></div></div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-h"><h3>花费与转化趋势</h3><span class="page-desc">{{ platform==='meta'?'Meta':'Google Ads' }} · 按录入日期</span></div><div class="card-b"><div ref="trendEl" class="chart"></div></div></div>
      <div class="card"><div class="card-h"><h3>投放国家 / 地区表现</h3></div><div class="card-b">
        <div v-for="c in countries" :key="c[0]" style="display:flex;align-items:center;gap:10px;padding:9px 0"><span style="width:60px;font-size:13px">{{c[0]}}</span><div style="flex:1"><div class="bar-track"><div class="bar-fill" :style="{width:c[2]+'%'}"></div></div></div><span class="num" style="font-weight:700;width:42px;text-align:right">{{c[1]}}</span></div>
        <div v-if="!countries.length" style="padding:24px;text-align:center;color:var(--ink2)">暂无数据，点「录入数据」添加。</div>
      </div></div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-h"><h3>投流数据明细</h3><el-button size="small" text type="danger" @click="clearAll">清空</el-button></div><div class="card-b" style="padding:0">
        <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['日期','花费','曝光','点击','转化','ROAS']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
          <tr v-for="s in rows" :key="s.id"><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{s.payload?.date}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">¥{{s.payload?.spend}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{fmt(s.payload?.imp)}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{fmt(s.payload?.clicks)}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{s.payload?.conv}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="chip" :class="roas(s)>=3.5?'up':roas(s)<2.5?'down':'flat'">{{roas(s)}}</span></td></tr>
        </tbody></table>
        <div v-if="!rows.length" style="padding:24px;text-align:center;color:var(--ink2)">暂无 {{platform==='meta'?'Meta':'Google Ads'}} 数据。</div>
      </div></div>
      <div class="card"><div class="card-h"><h3>转化漏斗</h3></div><div class="card-b"><div ref="funnelEl" class="chart"></div></div></div>
    </div>
    <div class="mini-note">Meta 数据来自官方 Graph API 同步或 CSV 导入（按汇率换算成人民币）；Google Ads 暂为手动录入。AI 分析需先在「AI 模型与密钥」配置 Key。</div>

    <el-dialog v-model="csvDialog" title="导入 Meta 广告 CSV" width="560px">
      <div class="mini-note" style="margin-bottom:10px">在 Ads Manager 导出报表（CSV），或直接从 Excel 复制表格内容粘贴进来。系统按日期聚合，重复日期会覆盖。</div>
      <el-upload accept=".csv,.txt,text/csv" :show-file-list="false" :before-upload="onCsvFile"><el-button size="small">选择 CSV 文件</el-button></el-upload>
      <el-input v-model="csvText" type="textarea" :rows="10" placeholder="粘贴 CSV 内容，第一行为表头（需含日期与花费列）" style="margin-top:10px" />
      <template #footer><el-button @click="csvDialog=false">取消</el-button><el-button type="primary" :loading="csvImporting" :disabled="!csvText.trim()" @click="importCsv">导入</el-button></template>
    </el-dialog>

    <el-dialog v-model="entryDialog" title="录入投流数据" width="480px"><el-form label-position="top">
      <el-form-item label="日期"><el-date-picker v-model="entry.date" type="date" value-format="YYYY-MM-DD" style="width:100%"/></el-form-item>
      <div class="grid g2">
        <el-form-item label="花费(¥)"><el-input-number v-model="entry.spend" :min="0" style="width:100%"/></el-form-item>
        <el-form-item label="曝光"><el-input-number v-model="entry.imp" :min="0" style="width:100%"/></el-form-item>
        <el-form-item label="点击"><el-input-number v-model="entry.clicks" :min="0" style="width:100%"/></el-form-item>
        <el-form-item label="转化"><el-input-number v-model="entry.conv" :min="0" style="width:100%"/></el-form-item>
      </div>
      <el-form-item label="投放国家（逗号分隔，可选）"><el-input v-model="entry.countries" placeholder="美国:4.2, 加拿大:3.6"/></el-form-item>
    </el-form><template #footer><el-button @click="entryDialog=false">取消</el-button><el-button type="primary" @click="submitEntry">保存</el-button></template></el-dialog>

    <el-drawer v-model="aiOpen" title="AI 投流分析" size="440px">
      <div v-if="aiLoading" style="padding:32px;text-align:center;color:var(--ink2)">AI 分析中…</div>
      <div v-else style="background:var(--green-l);padding:14px;border-radius:10px;line-height:1.8;font-size:13px;white-space:pre-wrap">{{ aiResult || '点「开始分析」让 AI 基于当前投流数据给出优化建议。' }}</div>
      <template #footer><el-button @click="runAi" :loading="aiLoading">开始分析</el-button><el-button type="primary" @click="writeFeishu">生成日报写飞书</el-button></template>
    </el-drawer>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';
import { useChart, axis } from '../composables';

const platform = ref('meta'); const aiOpen = ref(false); const aiLoading = ref(false); const aiResult = ref('');
const allRows = ref<any[]>([]); const entryDialog = ref(false);
const syncing = ref(false); const csvDialog = ref(false); const csvText = ref(''); const csvImporting = ref(false);
const entry = ref<any>({ date: new Date().toISOString().slice(0, 10), spend: 0, imp: 0, clicks: 0, conv: 0, countries: '' });
const trendEl = ref<HTMLElement | null>(null); const funnelEl = ref<HTMLElement | null>(null);

const rows = computed(() => allRows.value
  .filter((r) => (r.payload?.platform || 'meta') === platform.value)
  // 过滤掉字段缺失的空脏记录，避免明细表显示 undefined
  .filter((r) => r.payload && r.payload.date && (r.payload.spend !== undefined || r.payload.imp !== undefined))
  .sort((a, b) => String(a.payload?.date).localeCompare(String(b.payload?.date))));
function roas(r: any) { const c = Number(r.payload?.conv || 0); const s = Number(r.payload?.spend || 0); return s > 0 ? Number((c * 520 / s).toFixed(1)) : 0; }
const totals = computed(() => rows.value.reduce((acc, r) => {
  const p = r.payload || {};
  acc.spend += Number(p.spend || 0); acc.imp += Number(p.imp || 0); acc.clicks += Number(p.clicks || 0); acc.conv += Number(p.conv || 0);
  return acc;
}, { spend: 0, imp: 0, clicks: 0, conv: 0 }));
const kpis = computed(() => {
  const t = totals.value;
  const ctr = t.imp ? (t.clicks / t.imp * 100).toFixed(1) : '0';
  const roasV = t.spend ? (t.conv * 520 / t.spend).toFixed(1) : '0';
  return [
    { lb: '投流花费', v: '¥' + fmt(t.spend), ic: '💰', ft: `${rows.value.length} 天数据` },
    { lb: '曝光量', v: fmt(t.imp), ic: '🌐', ft: '累计' },
    { lb: '点击率 CTR', v: ctr + '%', ic: '📈', ft: '转化率 ' + (t.clicks ? (t.conv / t.clicks * 100).toFixed(1) : '0') + '%' },
    { lb: '转化 / ROAS', v: String(t.conv), ic: '🎯', ft: 'ROAS ' + roasV },
  ];
});
const countries = computed(() => {
  const map: Record<string, number> = {};
  for (const r of rows.value) {
    const cs = String(r.payload?.countries || '');
    for (const part of cs.split(/[,，]/)) {
      const [name, val] = part.split(':').map((x) => x?.trim());
      if (name && val) map[name] = (map[name] || 0) + Number(val);
    }
  }
  const arr = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = arr.length ? arr[0][1] : 1;
  return arr.map(([name, val]) => [name, val.toFixed(1), Math.min(100, val / max * 100)] as [string, string, number]);
});

function fmt(n: any) { const v = Number(n) || 0; return v >= 10000 ? (v / 10000).toFixed(1) + '万' : String(v); }

// 顶层注册一次图表，option 闭包读取响应式数据；数据变化后调用 render() 刷新
const { render: renderTrend } = useChart(trendEl, () => {
  const data = rows.value;
  const dates = data.map((r) => String(r.payload?.date || '').slice(5));
  const spends = data.map((r) => Number(r.payload?.spend || 0));
  const convs = data.map((r) => Number(r.payload?.conv || 0));
  return {
    tooltip: { trigger: 'axis' }, legend: { data: ['花费', '转化'], right: 0, textStyle: { fontSize: 11, color: '#6B7B74' } },
    grid: { left: 50, right: 36, top: 30, bottom: 24 },
    xAxis: { type: 'category', data: dates.length ? dates : ['无数据'], ...axis },
    yAxis: [{ type: 'value', ...axis }, { type: 'value', ...axis, splitLine: { show: false } }],
    series: [
      { name: '花费', type: 'bar', data: spends, itemStyle: { color: '#2E7D6B', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 18 },
      { name: '转化', type: 'line', yAxisIndex: 1, data: convs, smooth: true, lineStyle: { color: '#C9A227', width: 2 }, itemStyle: { color: '#C9A227' } },
    ],
  };
});
const { render: renderFunnel } = useChart(funnelEl, () => {
  const t = totals.value;
  return {
    tooltip: { trigger: 'item' },
    series: [{ type: 'funnel', left: '10%', right: '10%', top: 20, bottom: 20,
      data: [
        { name: '曝光', value: Math.max(1, t.imp) },
        { name: '点击', value: Math.max(1, t.clicks) },
        { name: '咨询留资', value: Math.max(1, Math.round(t.clicks * 0.15)) },
        { name: '到店转化', value: Math.max(1, t.conv) },
      ], label: { position: 'inside', fontSize: 11, color: '#fff', formatter: '{b} {c}' }, itemStyle: { borderColor: '#fff', borderWidth: 2 } }],
    color: ['#2E7D6B', '#4A9C86', '#C9A227', '#E0BE4F'],
  };
});
function renderCharts() { renderTrend(); renderFunnel(); }

async function load() {
  try { allRows.value = await api.bizList('ads_daily'); await nextTick(); renderCharts(); }
  catch (e: any) { ElMessage.error(e.message || '加载失败'); }
}
onMounted(load);
watch(platform, () => nextTick(renderCharts));

async function syncMeta() {
  syncing.value = true;
  try {
    const res = await api.metaSync({});
    ElMessage.success(`已同步 ${res.added + res.updated} 天数据（新增 ${res.added}，更新 ${res.updated}）`);
    await load();
  } catch (e: any) {
    // 原样展示后端返回的真实错误，便于定位 Token 权限/接口等问题
    ElMessage.error({ message: String(e?.message || '同步失败'), duration: 8000, showClose: true });
  } finally { syncing.value = false; }
}
async function onCsvFile(file: File) {
  csvText.value = await file.text();
  return false;
}
async function importCsv() {
  csvImporting.value = true;
  try {
    const res = await api.metaImportCsv({ csv: csvText.value });
    ElMessage.success(`已导入 ${res.added + res.updated} 天数据`);
    csvDialog.value = false; csvText.value = '';
    await load();
  } catch (e: any) { ElMessage.error(e.message || '导入失败'); }
  finally { csvImporting.value = false; }
}

async function submitEntry() {
  if (!entry.value.date) return ElMessage.warning('请选择日期');
  try {
    await api.bizCreate('ads_daily', {
      storeId: '', title: `${platform.value} ${entry.value.date}`,
      payload: { ...entry.value, platform: platform.value },
    });
    entryDialog.value = false; ElMessage.success('投流数据已保存'); await load();
  } catch (e: any) { ElMessage.error(e.message || '保存失败'); }
}
async function clearAll() {
  try { await ElMessageBox.confirm(`确定清空 ${platform.value} 的全部投流数据吗？`, '清空', { type: 'warning' }); } catch { return; }
  try { for (const r of rows.value) await api.bizDelete('ads_daily', r.id); ElMessage.success('已清空'); await load(); }
  catch (e: any) { ElMessage.error(e.message || '清空失败'); }
}
async function runAi() {
  const t = totals.value;
  if (!rows.value.length) return ElMessage.warning('请先录入投流数据');
  aiLoading.value = true; aiResult.value = '';
  try {
    const data = await api.aiChat({
      prompt: `平台：${platform.value}。近 ${rows.value.length} 天累计：花费 ¥${t.spend}，曝光 ${t.imp}，点击 ${t.clicks}，转化 ${t.conv}。请分析数据并给出 3 条具体优化建议。`,
      system: '你是资深投流优化师，分析要基于数据、给出可执行建议，中文，简洁。',
      scene: 'ads',
    });
    aiResult.value = data.content;
  } catch (e: any) {
    if ((e.message || '').includes('Key')) ElMessage.warning('请先到「AI 模型与密钥」配置 Key');
    else ElMessage.error(e.message || '分析失败');
  } finally { aiLoading.value = false; }
}
async function writeFeishu() {
  try {
    const cap = await api.capabilities();
    if (!cap.capabilities?.feishu?.enabled) return ElMessage.warning('尚未配置飞书凭证/门店表格，请先到「系统设置 → 飞书授权/门店表格绑定」配置');
    ElMessage.info('飞书已配置，日报自动写入将在业务接口接入后生效');
  } catch (e: any) { ElMessage.error(e.message || '检查配置失败'); }
}
</script>
