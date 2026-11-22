<template>
  <div>
    <div class="page-head"><div><div class="page-title">每日对账录入</div><div class="page-desc">上传或粘贴对账单 → AI 核对 → 人工确认 → 写入飞书多维表格</div></div><el-button type="primary" @click="run"><el-icon><Sparkles /></el-icon>AI 智能核对</el-button></div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>录入对账单</h3><span class="tag g">门店：鵲太醫·总店</span></div><div class="card-b">
        <el-form label-position="top">
          <el-form-item label="对账日期"><el-date-picker v-model="date" type="date" style="width:100%" value-format="YYYY-MM-DD"/></el-form-item>
          <el-form-item label="粘贴对账文本 / 上传截图"><el-input v-model="text" type="textarea" :rows="5" placeholder="粘贴收银系统对账单，或上传结算截图由 AI 识别…"/></el-form-item>
        </el-form>
        <div style="display:flex;gap:10px"><el-button @click="ElMessage.success('已选择图片（演示）')"><el-icon><Plus /></el-icon>上传截图</el-button><el-button type="primary" @click="run">开始 AI 核对</el-button></div>
      </div></div>
      <div class="card"><div class="card-h"><h3>核对结果与差异</h3><span class="tag" :class="done?'g':'y'">{{ done?'核对通过':'待核对' }}</span></div><div class="card-b">
        <div v-if="!done" style="text-align:center;color:var(--ink3);padding:50px 0">点击「开始 AI 核对」查看字段提取与差异校验结果</div>
        <template v-else>
          <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left;padding:8px;background:#FAFBF9">字段</th><th style="text-align:left;padding:8px;background:#FAFBF9">对账文本</th><th style="text-align:left;padding:8px;background:#FAFBF9">校验</th></tr></thead><tbody>
            <tr v-for="r in rows" :key="r[0]"><td style="padding:8px;border-bottom:1px solid var(--line2)">{{ r[0] }}</td><td style="padding:8px;border-bottom:1px solid var(--line2)">¥{{ r[1] }}</td><td style="padding:8px;border-bottom:1px solid var(--line2)"><span class="chip up">一致</span></td></tr>
          </tbody></table>
          <div style="margin-top:14px;padding:12px;background:var(--green-l);border-radius:8px;font-size:12.5px;color:var(--green-d)"><b>核对结论：</b>全部字段一致，可确认写入飞书多维表格。</div>
          <el-button type="primary" style="margin-top:14px" @click="ElMessage.success('已写入飞书多维表格（演示）')">确认并写入飞书</el-button>
        </template>
      </div></div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>飞书数据同步记录</h3><span class="live"><i></i>自动同步</span></div><div class="card-b" style="padding:0">
      <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['日期','门店','总营业额','AI核对','写入飞书','时间']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
        <tr v-for="r in sync" :key="r[0]+r[1]"><td v-for="(c,i) in r" :key="i" style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span v-if="i===3" class="tag g">{{c}}</span><span v-else-if="i===4" class="chip up">{{c}}</span><span v-else>{{c}}</span></td></tr>
      </tbody></table>
    </div></div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
const date = ref('2026-11-21');
const text = ref('总营业额 18,620｜耗卡 6,340｜充值 9,800｜微信 8,120｜支付宝 4,300｜现金 620｜美团 3,580｜抖音 2,000');
const done = ref(false);
const rows = [['总营业额','18,620'],['耗卡金额','6,340'],['充值金额','9,800'],['渠道合计','18,620'],['微信','8,120'],['抖音团购','2,000']];
const sync = [['2026-11-21','鵲太醫·总店','¥18,620','通过','成功','15:42'],['2026-11-20','鵲太醫·静安店','¥12,450','通过','成功','昨日 18:30'],['2026-11-20','鵲太醫·浦东店','¥14,880','通过','成功','昨日 18:28']];
function run(){done.value=true;ElMessage.success('AI 核对完成，全部字段一致')}
</script>
