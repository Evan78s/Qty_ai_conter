<template>
  <div>
    <div class="page-head"><div><div class="page-title">自媒体 AI 工作台</div><div class="page-desc">小红书优先 · 账号监控 / 内容发布 / 互动回复</div></div><el-button type="primary" @click="$router.push('/material')"><el-icon><Sparkles /></el-icon>创作内容</el-button></div>
    <el-tabs v-model="tab">
      <el-tab-pane label="账号监控" name="account">
        <div class="grid g4" style="margin-top:14px"><div v-for="k in kpis" :key="k.lb" class="card kpi"><div class="top"><span class="lb">{{k.lb}}</span><span class="ic">📱</span></div><div class="val num">{{k.v}}</div><div class="ft"><span class="chip up">{{k.ch}}</span>环比上月</div></div></div>
        <div class="grid g2" style="margin-top:16px">
          <div class="card"><div class="card-h"><h3>小红书账号概览</h3><span class="tag y">模拟数据</span></div><div class="card-b">
            <div v-for="a in accounts" :key="a[0]" style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line2)"><div style="width:38px;height:38px;border-radius:9px;background:#FF2442;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">小红书</div><div style="flex:1"><div style="font-weight:600">{{a[0]}}</div><div style="font-size:12px;color:var(--ink2)">{{a[2]}}</div></div><div class="num" style="font-weight:700">{{a[1]}}</div></div>
          </div></div>
          <div class="card"><div class="card-h"><h3>粉丝增长趋势</h3></div><div class="card-b"><div ref="fansEl" class="chart"></div></div></div>
        </div>
      </el-tab-pane>
      <el-tab-pane label="发布计划" name="publish">
        <div class="card" style="margin-top:14px"><div class="card-h"><h3>内容发布日历 · 11月</h3><el-button size="small" type="primary" @click="$router.push('/material')">新建内容</el-button></div><div class="card-b">
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px"><div v-for="d in ['一','二','三','四','五','六','日']" :key="d" style="text-align:center;font-size:11px;color:var(--ink3);padding:6px">周{{d}}</div>
            <div v-for="i in 21" :key="i" style="aspect-ratio:1;border:1px solid var(--line);border-radius:8px;padding:6px;font-size:11px" :style="[2,5,9,12,16,19].includes(i)?{background:'var(--green-l)'}:{}"><div style="color:var(--ink2)">{{i}}</div><div v-if="[2,5,9,12,16,19].includes(i)" style="margin-top:4px;font-size:9px;color:var(--green);font-weight:600">肩颈养生</div></div>
          </div>
        </div></div>
      </el-tab-pane>
      <el-tab-pane label="互动回复" name="reply">
        <div class="card" style="margin-top:14px"><div class="card-h"><h3>评论与私信回复</h3><span class="page-desc">AI 建议回复 + 人工确认</span></div><div class="card-b" style="padding:0">
          <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['平台/账号','用户','内容','AI 建议回复','操作']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
            <tr v-for="r in replies" :key="r[1]"><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag r">{{r[0]}}</span></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{r[1]}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{r[2]}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2);color:var(--green-d);background:var(--green-l);border-radius:6px">{{r[3]}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><el-button type="primary" size="small" @click="ElMessage.success('回复已发送')">发送</el-button> <el-button size="small" @click="ElMessage.success('已编辑（演示）')">编辑</el-button></td></tr>
          </tbody></table>
        </div></div>
      </el-tab-pane>
    </el-tabs>
    <div class="mini-note">小红书无企业认证号，官方 API 仅支持登录授权。当前展示模拟数据 + 支持人工录入，预留官方/第三方数据接口，认证后即可切换真实数据。</div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useChart, axis } from '../composables';
const tab=ref('account');
const kpis=[{lb:'全平台粉丝',v:'28.6K',ch:'+6.8%'},{lb:'本月净增',v:'+1,842',ch:'+12%'},{lb:'平均互动率',v:'4.7%',ch:'+0.5pp'},{lb:'本月爆款',v:'6 篇',ch:'+2'}];
const accounts=[['鵲太醫官方号','18.2K 粉丝','本月 12 篇 · 互动率 5.2%'],['肩颈理疗日记','7.4K 粉丝','本月 8 篇 · 互动率 4.1%'],['静安店·小养','3.0K 粉丝','本月 6 篇 · 互动率 3.8%']];
const replies=[['小红书','小美','这个套餐适合孕妇吗？','孕期建议咨询医生后预约，我们提供温和理疗项目～'],['小红书','阿杰','价格还能优惠吗？','新客首次体验价 ¥168，性价比很高哦'],['公众号','王姐','周末营业吗？','周末正常营业 10:00–22:00，建议提前预约']];
const fansEl=ref<HTMLElement|null>(null);
useChart(fansEl,()=>({tooltip:{trigger:'axis'},grid:{left:46,right:16,top:20,bottom:24},xAxis:{type:'category',data:['W1','W2','W3','W4'],...axis},yAxis:{type:'value',...axis},series:[{type:'line',smooth:true,data:[26800,27400,27950,28600],lineStyle:{color:'#FF2442',width:2.5},itemStyle:{color:'#FF2442'},areaStyle:{color:'rgba(255,36,66,.1)'}}]}));
</script>
