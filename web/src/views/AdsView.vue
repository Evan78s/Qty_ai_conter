<template>
  <div>
    <div class="page-head">
      <div><div class="page-title">境外推广看板</div><div class="page-desc">Meta 与 Google Ads 投流数据 · 选日期范围即时筛选下方看板，点同步则按该范围拉取</div></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><el-radio-group v-model="platform"><el-radio-button value="meta">Meta</el-radio-button><el-radio-button value="google">Google Ads</el-radio-button></el-radio-group><template v-if="platform==='meta'">
        <el-date-picker v-model="syncRange" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" size="default" style="width:250px" />
        <el-button size="small" text @click="resetRange">看全部</el-button>
        <el-button :loading="syncing" @click="openSync">从 Meta 同步</el-button><el-button @click="csvDialog=true">导入 CSV</el-button><el-button :loading="probeLoading" @click="probeMeta">诊断 Meta</el-button></template><el-button @click="entryDialog=true">+ 录入数据</el-button><el-button type="primary" @click="runAi"><el-icon><Sparkles /></el-icon>AI 分析</el-button></div>
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
        <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['日期','花费','曝光','点击','转化','成交额','ROAS','ROAS口径','转化事件']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
          <tr v-for="s in rows" :key="s.id"><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{s.payload?.date}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">¥{{s.payload?.spend}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{fmt(s.payload?.imp)}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{fmt(s.payload?.clicks)}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{s.payload?.conv}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2);font-weight:600" :style="dealOf(s)>0?'color:var(--up)':'color:var(--ink2)'">{{ dealOf(s)>0 ? '¥'+fmt(dealOf(s)) : '—' }}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="chip" :class="roas(s)>=3.5?'up':roas(s)<2.5?'down':'flat'">{{roas(s)}}</span></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2);font-size:12px"><span class="tag" :class="roasReal(s)?'g':'gray'">{{ roasReal(s)?'真实成交':'估算' }}</span></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2);color:var(--ink2);font-size:12px">{{ s.payload?.convLabel || (s.payload?.source==='api'?'—':'手动') }}</td></tr>
        </tbody></table>
        <div v-if="!rows.length" style="padding:24px;text-align:center;color:var(--ink2)">暂无 {{platform==='meta'?'Meta':'Google Ads'}} 数据。</div>
      </div></div>
      <div class="card"><div class="card-h"><h3>转化漏斗</h3></div><div class="card-b"><div ref="funnelEl" class="chart"></div></div></div>
    </div>
    <div class="mini-note">
      <b>日期范围</b>：选择后下方 KPI/图表/明细即时筛选只显示该区间数据，点「看全部」恢复全部；点「从 Meta 同步」则按该范围拉取数据。<br>
      Meta 数据来自官方 Graph API 同步（人民币账户按 1:1 统计，外币按汇率换算）。<b>ROAS 口径：{{ roasBasis }}</b>——在「AI 客服接待 → 成交记录」录入真实成交后，ROAS 自动改为「当日成交额 ÷ 当日花费」；未录入成交的日期用「转化 × 客单价 ¥{{aov}}」估算（客单价可在「系统设置 → Meta 投流 → 客单价」修改）。「转化」只统计真实转化事件（购买/线索/私信咨询），已剔除互动噪音。Google Ads 暂为手动录入。AI 分析需先在「AI 模型与密钥」配置 Key。
    </div>

    <el-dialog v-model="csvDialog" title="导入 Meta 广告 CSV" width="560px">
      <div class="mini-note" style="margin-bottom:10px">在 Ads Manager 导出报表（CSV），或直接从 Excel 复制表格内容粘贴进来。系统按日期聚合，重复日期会覆盖。</div>
      <el-upload accept=".csv,.txt,text/csv" :show-file-list="false" :before-upload="onCsvFile"><el-button size="small">选择 CSV 文件</el-button></el-upload>
      <el-input v-model="csvText" type="textarea" :rows="10" placeholder="粘贴 CSV 内容，第一行为表头（需含日期与花费列）" style="margin-top:10px" />
      <template #footer><el-button @click="csvDialog=false">取消</el-button><el-button type="primary" :loading="csvImporting" :disabled="!csvText.trim()" @click="importCsv">导入</el-button></template>
    </el-dialog>

    <el-dialog v-model="probeDialog" title="Meta 连接诊断" width="760px">
      <div class="mini-note" style="margin-bottom:10px">直接请求 Meta Graph API 的原始响应，用于排查「测试连接正常但看板无数据」。Token 已打码。</div>
      <div v-if="probeLoading" style="padding:24px;text-align:center;color:var(--ink2)">正在诊断，可能需要 10～30 秒…</div>
      <template v-else-if="probeResult">
        <div class="help-box" style="margin-bottom:10px">接口版本 {{ probeResult.version }} · 账户 {{ probeResult.accountId }} · 查询区间 {{ probeResult.since }} ~ {{ probeResult.until }}</div>
        <div v-if="probeResult.convAnalysis?.length" class="help-box" style="margin-bottom:10px">
          <b>转化口径分析</b>：{{ probeResult.configuredEvent ? '自定义事件 ' + probeResult.configuredEvent : '自动识别' }}<br>
          <span v-for="(c, i) in probeResult.convAnalysis" :key="i" style="display:block;margin-top:4px">
            样本{{ i + 1 }}：采用 <b>{{ c.event || '无' }}</b>（{{ c.label }}）→ 转化 <b>{{ c.conv }}</b>；候选事件：{{ Object.entries(c.candidates || {}).map(([k, v]) => k + '=' + v).join('、') }}
          </span>
        </div>
        <div v-for="c in probeResult.checks" :key="c.label" style="border:1px solid var(--line2);border-radius:8px;padding:10px 12px;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <b style="font-size:13px">{{ c.label }}</b>
            <el-tag :type="c.ok?'success':'danger'" size="small">{{ c.ok?'成功':'失败' }}</el-tag>
            <span style="color:var(--ink2);font-size:12px">{{ c.status }} · {{ c.elapsedMs }}ms · 返回 {{ c.rowCount }} 行</span>
          </div>
          <div v-if="c.rawError" style="color:#c0392b;font-size:12px;line-height:1.6">错误：{{ c.rawError.message }}<span v-if="c.rawError.code">（code {{ c.rawError.code }}/{{ c.rawError.subcode }}）</span><br>trace：{{ c.rawError.fbtrace_id }}</div>
          <pre v-if="c.sample?.length" style="margin:6px 0 0;padding:8px;background:#F7F8F6;border-radius:6px;font-size:11px;max-height:180px;overflow:auto">{{ JSON.stringify(c.sample, null, 2) }}</pre>
          <div v-else-if="c.ok" style="color:var(--ink2);font-size:12px">该查询返回 0 行</div>
        </div>
      </template>
      <template #footer><el-button @click="probeDialog=false">关闭</el-button></template>
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
// 真实成交数据（来自 AI 客服接待 → 成交记录）+ 客单价配置；用于把 ROAS 从估算升级为真实成交额计算
const deals = ref<any[]>([]); const aov = ref(400);
const syncing = ref(false); const csvDialog = ref(false); const csvText = ref(''); const csvImporting = ref(false);
// 日期范围：既是「从 Meta 同步的区间」，也是「下方看板筛选显示的区间」
const syncRange = ref<string[]>([new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)]);
/** 判断日期是否在当前选中范围内 */
function inRange(date: string): boolean {
  const d = String(date || '').slice(0, 10);
  if (!d) return false;
  const r = syncRange.value;
  if (Array.isArray(r) && r.length === 2) {
    if (r[0] && d < r[0]) return false;
    if (r[1] && d > r[1]) return false;
  }
  return true;
}
/** 范围内的真实成交记录 */
const scopedDeals = computed(() => deals.value.filter((d) => inRange(String(d.payload?.date || ''))));
/** 按日期聚合成交额（仅范围内）：{ '2026-11-20': 1200, ... } */
const dealByDate = computed(() => {
  const m: Record<string, number> = {};
  for (const d of scopedDeals.value) {
    const date = String(d.payload?.date || '').slice(0, 10);
    if (!date) continue;
    m[date] = (m[date] || 0) + (Number(d.payload?.amount) || 0);
  }
  return m;
});
const hasDealData = computed(() => scopedDeals.value.length > 0);
const totalDealAmount = computed(() => scopedDeals.value.reduce((s, d) => s + (Number(d.payload?.amount) || 0), 0));
const probeDialog = ref(false); const probeLoading = ref(false); const probeResult = ref<any>(null);
const entry = ref<any>({ date: new Date().toISOString().slice(0, 10), spend: 0, imp: 0, clicks: 0, conv: 0, countries: '' });
const trendEl = ref<HTMLElement | null>(null); const funnelEl = ref<HTMLElement | null>(null);

const rows = computed(() => allRows.value
  .filter((r) => (r.payload?.platform || 'meta') === platform.value)
  // 过滤掉字段缺失的空脏记录，避免明细表显示 undefined
  .filter((r) => r.payload && r.payload.date && (r.payload.spend !== undefined || r.payload.imp !== undefined))
  // 按选中的日期范围筛选显示——改范围即时生效
  .filter((r) => inRange(String(r.payload?.date || '')))
  .sort((a, b) => String(a.payload?.date).localeCompare(String(b.payload?.date))));
/** 某行当日的真实成交额（无则 0） */
function dealOf(r: any) { return Number(dealByDate.value[String(r.payload?.date || '').slice(0, 10)] || 0); }
/** 该行是否用真实成交额计算 ROAS */
function roasReal(r: any) { return dealOf(r) > 0; }
/** 单行 ROAS：有真实成交用「成交额/花费」，否则用「转化×客单价/花费」估算 */
function roas(r: any) {
  const s = Number(r.payload?.spend || 0);
  if (!(s > 0)) return 0;
  const d = dealOf(r);
  const revenue = d > 0 ? d : Number(r.payload?.conv || 0) * aov.value;
  return Number((revenue / s).toFixed(1));
}
const totals = computed(() => rows.value.reduce((acc, r) => {
  const p = r.payload || {};
  acc.spend += Number(p.spend || 0); acc.imp += Number(p.imp || 0); acc.clicks += Number(p.clicks || 0); acc.conv += Number(p.conv || 0);
  return acc;
}, { spend: 0, imp: 0, clicks: 0, conv: 0 }));
/** 口径说明：真实成交/估算混合时给出提示 */
const roasBasis = computed(() => {
  if (!hasDealData.value) return `按转化×客单价¥${aov.value}估算`;
  const matched = rows.value.filter((r) => roasReal(r)).length;
  return `真实成交额${matched}/${rows.value.length}天 · 其余按¥${aov.value}估算`;
});
const kpis = computed(() => {
  const t = totals.value;
  const ctr = t.imp ? (t.clicks / t.imp * 100).toFixed(1) : '0';
  // 总 ROAS：有真实成交数据时用「总成交额/总花费」，否则用「总转化×客单价/总花费」
  const revenue = hasDealData.value && totalDealAmount.value > 0 ? totalDealAmount.value : t.conv * aov.value;
  const roasV = t.spend ? (revenue / t.spend).toFixed(1) : '0';
  const roasLabel = hasDealData.value ? '真实成交额/花费' : `转化×¥${aov.value}估算`;
  return [
    { lb: '投流花费', v: '¥' + fmt(t.spend), ic: '💰', ft: `${rows.value.length} 天数据` },
    { lb: hasDealData.value ? '真实成交额' : '曝光量', v: hasDealData.value ? '¥' + fmt(totalDealAmount.value) : fmt(t.imp), ic: hasDealData.value ? '💵' : '🌐', ft: hasDealData.value ? deals.value.length + ' 笔成交' : '累计' },
    { lb: '点击率 CTR', v: ctr + '%', ic: '📈', ft: '转化率 ' + (t.clicks ? (t.conv / t.clicks * 100).toFixed(1) : '0') + '%' },
    { lb: '转化 / ROAS', v: String(t.conv), ic: '🎯', ft: `ROAS ${roasV}（${roasLabel}）` },
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
  try {
    const [rows, dealRows, meta] = await Promise.all([
      api.bizList('ads_daily'),
      api.bizList('service_deal').catch(() => []),
      api.metaConfig().catch(() => null),
    ]);
    allRows.value = rows;
    deals.value = dealRows || [];
    if (meta?.aov > 0) aov.value = meta.aov;
    await nextTick(); renderCharts();
  } catch (e: any) { ElMessage.error(e.message || '加载失败'); }
}
onMounted(load);
watch(platform, () => nextTick(renderCharts));
// 改日期范围即时刷新图表（KPI/明细表由 computed 自动响应）
watch(syncRange, () => nextTick(renderCharts), { deep: true });

function resetRange() {
  // 清空范围 = 显示全部数据；同步时若范围为空则回退到默认近 30 天
  syncRange.value = [] as any;
  ElMessage.info('已显示全部日期数据');
}
async function openSync() {
  // 范围为空时同步回退到默认近 30 天（后端默认），并在同步后恢复可筛选范围
  if (!syncRange.value || syncRange.value.length !== 2) {
    const since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);
    await syncMeta(since, until);
    syncRange.value = [since, until];
    return;
  }
  await syncMeta(syncRange.value[0], syncRange.value[1]);
}
async function syncMeta(since?: string, until?: string) {
  syncing.value = true;
  try {
    const res = await api.metaSync(since && until ? { since, until } : {});
    const cur = res.accountCurrency ? ` · 账户币种 ${res.accountCurrency}${res.needConvert ? `（按汇率 ${res.rate} 换算）` : '（人民币 1:1，无需换算）'}` : '';
    const basis = res.convEvents?.length ? ` · 转化口径：${res.convEvents.join('、')}` : '';
    ElMessage.success({ message: `已同步 ${res.added + res.updated} 天数据（新增 ${res.added}，更新 ${res.updated}）${cur}${basis}`, duration: 8000 });
    await load();
  } catch (e: any) {
    // 原样展示后端返回的真实错误，便于定位 Token 权限/接口等问题
    ElMessage.error({ message: String(e?.message || '同步失败'), duration: 8000, showClose: true });
  } finally { syncing.value = false; }
}
async function probeMeta() {
  probeDialog.value = true; probeLoading.value = true; probeResult.value = null;
  try {
    probeResult.value = await api.metaProbe();
  } catch (e: any) {
    ElMessage.error({ message: String(e?.message || '诊断失败'), duration: 8000, showClose: true });
    probeDialog.value = false;
  } finally { probeLoading.value = false; }
}
async function onCsvFile(file: File) {
  csvText.value = await file.text();
  return false;
}
async function importCsv() {
  csvImporting.value = true;
  try {
    const res = await api.metaImportCsv({ csv: csvText.value });
    const cur = res.accountCurrency === 'CNY' ? ' · 人民币账户，按 1:1 直接统计' : ` · 按汇率 ${res.rate} 换算`;
    ElMessage.success(`已导入 ${res.added + res.updated} 天数据${cur}`);
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
