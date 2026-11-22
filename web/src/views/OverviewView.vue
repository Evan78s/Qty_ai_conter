<template>
  <div>
    <div class="page-head">
      <div><div class="page-title">总览驾驶舱</div><div class="page-desc">{{ storeLabel }} · 数据来自每日对账（阶段1为演示数据）</div></div>
      <div style="display:flex;gap:10px">
        <el-button @click="ElMessage.success('已导出经营日报（演示）')"><el-icon><Download /></el-icon>导出日报</el-button>
        <el-button type="primary" @click="aiOpen = true"><el-icon><Sparkles /></el-icon>AI 经营解读</el-button>
      </div>
    </div>
    <div class="grid g4">
      <div v-for="k in kpis" :key="k.lb" class="card kpi">
        <div class="top"><span class="lb">{{ k.lb }}</span><span class="ic">{{ k.ic }}</span></div>
        <div class="val num">{{ k.v }}</div>
        <div class="ft"><span class="chip" :class="k.up?'up':'down'">{{ k.ch }}</span>{{ k.ft }}</div>
      </div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-h"><h3>营业额趋势</h3><el-radio-group v-model="range" size="small"><el-radio-button value="7">近7天</el-radio-button><el-radio-button value="30">近30天</el-radio-button></el-radio-group></div><div class="card-b"><div ref="trendEl" class="chart"></div></div></div>
      <div class="card"><div class="card-h"><h3>客户来源构成</h3></div><div class="card-b"><div ref="sourceEl" class="chart"></div></div></div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-h"><h3>门店业绩排行</h3></div><div class="card-b">
        <div v-for="(s,i) in ALL" :key="s.name" style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line2)">
          <span class="rank" :class="{top:i===0}">{{ i+1 }}</span>
          <div style="flex:1"><div style="font-weight:600">{{ s.short }}</div><div class="bar-cell" style="margin-top:5px"><div class="bar-track"><div class="bar-fill" :style="{width:(s.revenue/18620*100)+'%'}"></div></div></div></div>
          <div class="num" style="font-weight:700">¥{{ fmt(s.revenue) }}</div>
        </div>
      </div></div>
      <div class="card"><div class="card-h"><h3>今日待办与提醒</h3><span class="tag y">4 项待处理</span></div><div class="card-b">
        <div v-for="t in todos" :key="t.title" style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line2);cursor:pointer" @click="router.push(t.path)">
          <span class="tag" :class="t.tag">{{ t.title }}</span><div style="flex:1;font-size:13px">{{ t.desc }}</div><span style="color:var(--ink3)">→</span>
        </div>
      </div></div>
    </div>

    <el-drawer v-model="aiOpen" title="AI 经营解读" size="440px">
      <div style="background:var(--green-l);padding:14px;border-radius:10px;line-height:1.8;font-size:13px">
        <b>经营摘要：</b>当前门店合计营业额 <b>¥45,950</b>，环比 <span class="chip up">↑12.4%</span>；充值 ¥23,500 创近 8 周新高。老客推荐来源占比提升，获客成本下降。
        <br><br><b>建议：</b>① 总店周末增派理疗师；② 向会员推送秋季套餐复购券；③ 加大小红书种草发布频率。
      </div>
      <template #footer><el-button type="primary" @click="aiOpen=false">知道了</el-button></template>
    </el-drawer>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAppStore } from '../stores/app';
import { ALL, agg, fmt, trend, SOURCES } from '../api/mock';
import { useChart, axis } from '../composables';
const router = useRouter(); const app = useAppStore();
const range = ref('7'); const aiOpen = ref(false);
const storeLabel = computed(() => app.currentStore === 'all' ? '全部门店' : app.stores.find(s=>s.id===app.currentStore)?.name || '全部门店');
const kpis = computed(() => [
  { lb:'总营业额', v:'¥'+fmt(agg('revenue',app.currentStore)), ic:'💰', ch:'+12.4%', up:true, ft:'较上周同期' },
  { lb:'耗卡金额', v:'¥'+fmt(agg('card',app.currentStore)), ic:'💳', ch:'+5.8%', up:true, ft:'耗卡率 34%' },
  { lb:'充值金额', v:'¥'+fmt(agg('recharge',app.currentStore)), ic:'📈', ch:'+23.1%', up:true, ft:'创近 8 周新高' },
  { lb:'到店人次', v:fmt(agg('customers',app.currentStore)), ic:'👥', ch:'-2.3%', up:false, ft:'新客 55 人' },
]);
const todos = [
  { title:'对账录入', desc:'总店 11/21 对账单待 AI 核对', tag:'r', path:'/reconcile' },
  { title:'AI 客服', desc:'4 条客户消息等待人工回复', tag:'r', path:'/service' },
  { title:'投流优化', desc:'2 个广告系列花费异常需处理', tag:'y', path:'/ads' },
  { title:'内容发布', desc:'本周小红书发布计划 2 篇待创作', tag:'y', path:'/material' },
];
const trendEl = ref<HTMLElement|null>(null); const sourceEl = ref<HTMLElement|null>(null);
const { render: renderTrend } = useChart(trendEl, () => {
  const t = trend(Number(range.value));
  return { tooltip:{trigger:'axis'}, legend:{data:['营业额','耗卡'],right:0,textStyle:{fontSize:11,color:'#6B7B74'}}, grid:{left:50,right:16,top:30,bottom:24}, xAxis:{type:'category',data:t.x,...axis}, yAxis:{type:'value',...axis},
    series:[{name:'营业额',type:'line',smooth:true,data:t.a,lineStyle:{color:'#2E7D6B',width:2.5},itemStyle:{color:'#2E7D6B'},areaStyle:{color:'rgba(46,125,107,.12)'}},{name:'耗卡',type:'line',smooth:true,data:t.b,lineStyle:{color:'#C9A227',width:2},itemStyle:{color:'#C9A227'}}] };
});
useChart(sourceEl, () => ({ tooltip:{trigger:'item'}, series:[{type:'pie',radius:['48%','72%'],center:['50%','52%'],data:SOURCES.map((n,i)=>({name:n,value:[28,22,18,15,10,7][i]})),itemStyle:{borderColor:'#fff',borderWidth:2},label:{fontSize:11,color:'#6B7B74'}}], color:['#2E7D6B','#4A9C86','#C9A227','#E0BE4F','#7FB69F','#B8CFC4'] }));
watch(range, () => renderTrend());
watch(() => app.currentStore, () => renderTrend());
</script>
