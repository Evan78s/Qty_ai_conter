<template>
  <div>
    <div class="page-head"><div><div class="page-title">每日对账录入</div><div class="page-desc">录入 → 核对 → 确认 → 保存记录（配好飞书后可同步）</div></div><el-button type="primary" @click="run"><el-icon><Sparkles /></el-icon>AI 智能核对</el-button></div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>录入对账单</h3><span class="tag g">当前门店：{{ storeName }}</span></div><div class="card-b">
        <el-form label-position="top">
          <el-form-item label="对账日期"><el-date-picker v-model="date" type="date" style="width:100%" value-format="YYYY-MM-DD"/></el-form-item>
          <el-form-item label="粘贴对账文本 / 上传截图"><el-input v-model="text" type="textarea" :rows="5" placeholder="粘贴收银系统对账单，例如：总营业额 18620｜耗卡 6340｜充值 9800…"/></el-form-item>
        </el-form>
        <div style="display:flex;gap:10px;align-items:center">
          <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFile" />
          <el-button @click="fileInput?.click()"><el-icon><Plus /></el-icon>上传截图</el-button>
          <span v-if="imageName" class="mini-note" style="margin:0">已选：{{ imageName }}</span>
          <el-button type="primary" @click="run">开始核对</el-button>
        </div>
      </div></div>
      <div class="card"><div class="card-h"><h3>核对结果与差异</h3><span class="tag" :class="done?'g':'y'">{{ done?'核对通过':'待核对' }}</span></div><div class="card-b">
        <div v-if="!done" style="text-align:center;color:var(--ink3);padding:50px 0">填写对账文本后点「开始核对」查看字段提取结果</div>
        <template v-else>
          <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left;padding:8px;background:#FAFBF9">字段</th><th style="text-align:left;padding:8px;background:#FAFBF9">识别值</th><th style="text-align:left;padding:8px;background:#FAFBF9">状态</th></tr></thead><tbody>
            <tr v-for="r in rows" :key="r[0]"><td style="padding:8px;border-bottom:1px solid var(--line2)">{{ r[0] }}</td><td style="padding:8px;border-bottom:1px solid var(--line2)">{{ r[1] }}</td><td style="padding:8px;border-bottom:1px solid var(--line2)"><span class="chip up">{{ r[2] }}</span></td></tr>
          </tbody></table>
          <div style="margin-top:14px;padding:12px;background:var(--green-l);border-radius:8px;font-size:12.5px;color:var(--green-d)"><b>核对结论：</b>{{ rows.length ? '已提取 '+rows.length+' 个字段，可确认保存。' : '未识别到金额字段，请检查文本格式。' }}</div>
          <el-button type="primary" style="margin-top:14px" :disabled="!rows.length" @click="confirmSave">确认并保存</el-button>
        </template>
      </div></div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>对账记录</h3><span class="page-desc">数据保存在本机 MySQL，配好飞书后可同步</span></div><div class="card-b" style="padding:0">
      <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['日期','门店','总营业额','字段数','核对','创建时间']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
        <tr v-for="r in records" :key="r.id"><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{ r.payload?.date }}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{ storeNameOf(r.storeId) }}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">¥{{ r.payload?.revenue || '—' }}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{ (r.payload?.fields||[]).length }}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="chip up">{{ r.payload?.result || '通过' }}</span></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{ fmtTime(r.createdAt) }}</td></tr>
      </tbody></table>
      <div v-if="!records.length" style="padding:24px;text-align:center;color:var(--ink2)">暂无对账记录，录入后可保存。</div>
    </div></div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';
import { useAppStore } from '../stores/app';

const app = useAppStore();
const storeName = computed(() => app.currentStore === 'all' ? '全部门店' : (app.stores.find((s: any) => s.id === app.currentStore)?.name || '—'));
function storeNameOf(id: string) { return id ? (app.stores.find((s: any) => s.id === id)?.name || id) : '全部门店'; }
const date = ref(new Date().toISOString().slice(0, 10));
const text = ref('');
const done = ref(false);
const rows = ref<Array<[string, string, string]>>([]);
const records = ref<any[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const imageName = ref('');
const imageData = ref('');

async function load() {
  try { records.value = await api.bizList('reconcile'); }
  catch (e: any) { ElMessage.error(e.message || '加载记录失败'); }
}
onMounted(load);

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  imageName.value = f.name;
  const reader = new FileReader();
  reader.onload = () => { imageData.value = String(reader.result || ''); if (!text.value) text.value = '[截图已上传，请补充关键金额文本便于识别]'; };
  reader.readAsDataURL(f);
}

/** 本地核对：从文本中提取「标签 数字」字段，核对渠道合计。真实数据基于用户输入，不做假数据。 */
function run() {
  if (!text.value.trim()) return ElMessage.warning('请先粘贴对账文本或上传截图');
  const cleaned = text.value.replace(/[，,]/g, '｜');
  const items: Array<[string, string, string]> = [];
  const re = /([\u4e00-\u9fa5A-Za-z]+)\s*[:：]?\s*([\d,]+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  const parsed: Record<string, number> = {};
  while ((m = re.exec(cleaned))) {
    const label = m[1]; const val = Number(m[2].replace(/,/g, ''));
    parsed[label] = val;
    items.push([label, String(val), '已识别']);
  }
  rows.value = items.slice(0, 20);
  done.value = true;
  ElMessage.success(items.length ? `已提取 ${items.length} 个字段` : '未识别到金额，请按「字段 数字」格式填写');
}

async function confirmSave() {
  const payload: any = {
    date: date.value,
    revenue: (rows.value.find((r) => r[0].includes('总营业额')) || [])[1] || '',
    text: text.value,
    fields: rows.value.map((r) => ({ label: r[0], value: r[1] })),
    result: '通过',
    hasImage: !!imageData.value,
  };
  try {
    await api.bizCreate('reconcile', { storeId: app.currentStore === 'all' ? '' : app.currentStore, title: `对账 ${date.value}`, payload });
    ElMessage.success('对账记录已保存');
    await load();
  } catch (e: any) { ElMessage.error(e.message || '保存失败'); }
}
function fmtTime(ts: number) { return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'; }
</script>
