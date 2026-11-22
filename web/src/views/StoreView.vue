<template>
  <div>
    <div class="page-head">
      <div><div class="page-title">店铺业绩看板</div><div class="page-desc">日 / 周 / 月多维业绩，数据来自每日对账并同步飞书</div></div>
      <div style="display:flex;gap:10px">
        <el-radio-group v-model="period"><el-radio-button value="day">日</el-radio-button><el-radio-button value="week">周</el-radio-button><el-radio-button value="month">月</el-radio-button></el-radio-group>
        <el-button type="primary" @click="aiOpen=true"><el-icon><Sparkles /></el-icon>AI 对账核对</el-button>
      </div>
    </div>
    <div class="grid g4">
      <div v-for="k in kpis" :key="k.lb" class="card kpi"><div class="top"><span class="lb">{{ k.lb }}</span><span class="ic">📊</span></div><div class="val num">{{ k.v }}</div><div class="ft"><span class="chip" :class="k.up?'up':'down'">{{ k.ch }}</span>环比上期</div></div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-h"><h3>营业额与耗卡趋势</h3><span class="page-desc">{{ periodLabel }}</span></div><div class="card-b"><div ref="trendEl" class="chart"></div></div></div>
      <div class="card"><div class="card-h"><h3>项目营收占比</h3></div><div class="card-b"><div ref="projEl" class="chart"></div></div></div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-h"><h3>各门店业绩对比</h3><el-select v-model="metric" size="small" style="width:130px"><el-option label="总营业额" value="revenue"/><el-option label="耗卡金额" value="card"/><el-option label="充值金额" value="recharge"/><el-option label="到店人次" value="customers"/></el-select></div><div class="card-b">
        <div v-for="(s,i) in ranked" :key="s.name" style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line2)">
          <span class="rank" :class="{top:i===0}">{{ i+1 }}</span><div style="width:80px;font-size:13px">{{ s.short }}</div>
          <div class="bar-cell" style="flex:1"><div class="bar-track"><div class="bar-fill" :style="{width:((s as any)[metric]/max*100)+'%'}"></div></div></div>
          <div class="num" style="font-weight:700;min-width:70px;text-align:right">{{ metric==='customers'?(s as any)[metric]:'¥'+fmt((s as any)[metric]) }}</div>
        </div>
      </div></div>
      <div class="card"><div class="card-h"><h3>客户来源渠道</h3></div><div class="card-b"><div ref="srcEl" class="chart"></div></div></div>
    </div>

    <el-drawer v-model="aiOpen" title="AI 对账核对" size="440px">
      <div style="background:var(--green-l);padding:14px;border-radius:10px;line-height:1.8;font-size:13px">
        <b>核对完成 · 全部字段一致</b><br>总营业额 ¥18,620 ✓ · 耗卡 ¥6,340 ✓ · 充值 ¥9,800 ✓<br>渠道合计 ¥18,620 ✓
        <br>数据可确认写入飞书多维表格。
      </div>
      <template #footer><el-button type="primary" @click="aiOpen=false;ElMessage.success('已写入飞书（演示）')">确认写入飞书</el-button></template>
    </el-drawer>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useAppStore } from '../stores/app';
import { ALL, agg, fmt, trend, SOURCES } from '../api/mock';
import { useChart, axis } from '../composables';
const app = useAppStore();
const period = ref('day'); const metric = ref('revenue'); const aiOpen = ref(false);
const F: any = { day:1, week:6.4, month:27 };
const periodLabel = computed(() => period.value==='day'?'近 14 天':period.value==='week'?'近 8 周':'近 12 月');
const kpis = computed(() => {
  const f = F[period.value], p = period.value==='day'?'今日':period.value==='week'?'本周':'本月';
  return [
    {lb:p+'总营业额',v:'¥'+fmt(Math.round(agg('revenue',app.currentStore)*f)),ch:'+12.4%',up:true},
    {lb:'耗卡金额',v:'¥'+fmt(Math.round(agg('card',app.currentStore)*f)),ch:'+5.8%',up:true},
    {lb:'充值金额',v:'¥'+fmt(Math.round(agg('recharge',app.currentStore)*f)),ch:'+23.1%',up:true},
    {lb:'到店人次',v:fmt(Math.round(agg('customers',app.currentStore)*f)),ch:'-2.3%',up:false},
  ];
});
const ranked = computed(() => [...ALL].sort((a:any,b:any)=>b[metric.value]-a[metric.value]));
const max = computed(() => Math.max(...ALL.map((s:any)=>s[metric.value])));
const trendEl=ref<HTMLElement|null>(null), projEl=ref<HTMLElement|null>(null), srcEl=ref<HTMLElement|null>(null);
const { render: rt } = useChart(trendEl, () => { const t=trend(7); return {tooltip:{trigger:'axis'},legend:{data:['营业额','耗卡'],right:0,textStyle:{fontSize:11,color:'#6B7B74'}},grid:{left:50,right:16,top:30,bottom:24},xAxis:{type:'category',data:t.x,...axis},yAxis:{type:'value',...axis},series:[{name:'营业额',type:'bar',data:t.a,itemStyle:{color:'#2E7D6B',borderRadius:[4,4,0,0]},barMaxWidth:22},{name:'耗卡',type:'bar',data:t.b,itemStyle:{color:'#C9A227',borderRadius:[4,4,0,0]},barMaxWidth:22}]}; });
useChart(projEl, () => ({tooltip:{trigger:'item'},legend:{orient:'vertical',right:0,top:'center',textStyle:{fontSize:11,color:'#6B7B74'}},series:[{type:'pie',radius:'65%',center:['35%','52%'],data:[{name:'肩颈理疗',value:38},{name:'精油SPA',value:26},{name:'艾灸养生',value:18},{name:'面部护理',value:12},{name:'其他',value:6}],label:{show:false},itemStyle:{borderColor:'#fff',borderWidth:2}}],color:['#2E7D6B','#4A9C86','#C9A227','#E0BE4F','#B8CFC4']}));
useChart(srcEl, () => ({tooltip:{trigger:'axis'},grid:{left:70,right:20,top:10,bottom:24},xAxis:{type:'value',...axis},yAxis:{type:'category',data:SOURCES.slice().reverse(),...axis},series:[{type:'bar',data:[7,10,15,18,22,28].reverse(),itemStyle:{color:'#4A9C86',borderRadius:[0,5,5,0]},barWidth:14,label:{show:true,position:'right',fontSize:11,color:'#6B7B74',formatter:'{c}%'}}]}));
watch([period,()=>app.currentStore],()=>rt());
</script>
