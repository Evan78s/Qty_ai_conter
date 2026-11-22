<template>
  <div>
    <div class="page-head">
      <div><div class="page-title">境外推广看板</div><div class="page-desc">Meta 与 Google Ads 投流数据 · <span class="live"><i></i>实时监控</span></div></div>
      <div style="display:flex;gap:10px"><el-radio-group v-model="platform"><el-radio-button value="meta">Meta</el-radio-button><el-radio-button value="google">Google Ads</el-radio-button></el-radio-group><el-button type="primary" @click="aiOpen=true"><el-icon><Sparkles /></el-icon>AI 分析</el-button></div>
    </div>
    <div class="grid g4">
      <div v-for="k in kpis" :key="k.lb" class="card kpi"><div class="top"><span class="lb">{{ k.lb }}</span><span class="ic">{{ k.ic }}</span></div><div class="val num" v-html="k.v"></div><div class="ft"><span class="chip" :class="k.up?'up':'down'">{{ k.ch }}</span>{{ k.ft }}</div></div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-h"><h3>花费与转化趋势</h3><span class="page-desc">{{ platform==='meta'?'Meta':'Google Ads' }} · 近 14 天</span></div><div class="card-b"><div ref="trendEl" class="chart"></div></div></div>
      <div class="card"><div class="card-h"><h3>投放国家 / 地区表现</h3></div><div class="card-b">
        <div v-for="c in d.countries" :key="c[0]" style="display:flex;align-items:center;gap:10px;padding:9px 0"><span style="width:60px;font-size:13px">{{c[0]}}</span><div class="bar-cell" style="flex:1"><div class="bar-track"><div class="bar-fill" :style="{width:(Number(c[1])/4.5*100)+'%'}"></div></div></div><span class="num" style="font-weight:700;width:42px;text-align:right">{{c[1]}}</span></div>
      </div></div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-h"><h3>广告系列表现</h3><span class="tag y">模拟数据</span></div><div class="card-b" style="padding:0">
        <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['广告系列','花费','曝光','CTR','转化','ROAS']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
          <tr v-for="s in series" :key="s[0]"><td v-for="(c,i) in s" :key="i" style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span v-if="i===5" class="chip" :class="Number(c)>=3.5?'up':Number(c)<2.5?'down':'flat'">{{c}}</span><span v-else>{{c}}</span></td></tr>
        </tbody></table>
      </div></div>
      <div class="card"><div class="card-h"><h3>转化漏斗</h3></div><div class="card-b"><div ref="funnelEl" class="chart"></div></div></div>
    </div>
    <div class="mini-note">数据来源：Business Manager 授权（预留接口）+ 飞书表格统计；当前为模拟数据，授权后自动切换真实数据。</div>

    <el-drawer v-model="aiOpen" title="AI 投流分析" size="440px">
      <div style="background:var(--green-l);padding:14px;border-radius:10px;line-height:1.8;font-size:13px">
        <b>检测到 2 处异常：</b><br>① Meta「品牌曝光·广泛」CTR 仅 1.4%，花费增 18% 但转化持平；<br>② Google「视频·YouTube」ROAS 1.9，连续 5 天低于盈亏线。<br><br><b>建议：</b>缩减上述系列预算，转移至高 ROAS 的「新客首单·再营销」（ROAS 5.1）。预计整体 ROAS 可由 3.4 升至 4.1。
      </div>
      <template #footer><el-button type="primary" @click="aiOpen=false;ElMessage.success('日报已写入飞书（演示）')">生成日报写飞书</el-button></template>
    </el-drawer>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { ADS, fmt } from '../api/mock';
import { useChart, axis } from '../composables';
const platform = ref('meta'); const aiOpen = ref(false);
const d = computed(()=>ADS[platform.value as 'meta'|'google']);
const kpis = computed(()=>{ const x=d.value; const ctr=(x.clicks/x.imp*100).toFixed(1); const cvr=(x.conv/x.clicks*100).toFixed(1); const roas=(x.conv*520/x.spend).toFixed(1); return [
  {lb:'投流花费',v:'¥'+fmt(x.spend),ic:'💰',ch:'+8.2%',up:true,ft:'较上周'},
  {lb:'曝光量',v:fmt(x.imp),ic:'🌐',ch:'+15.6%',up:true,ft:'覆盖 5 国'},
  {lb:'点击率 CTR',v:ctr+'%',ic:'📈',ch:'+0.3pp',up:true,ft:'转化率 '+cvr+'%'},
  {lb:'转化 / ROAS',v:x.conv+' <small>笔 · '+roas+'</small>',ic:'🎯',ch:'-4.1%',up:false,ft:'CPA ¥'+Math.round(x.spend/x.conv)},
];});
const series = computed<any[]>(()=> platform.value==='meta'
  ? [['秋季养生·转化型','¥1,240','1.2M','2.8%',52,4.6],['肩颈SPA·种草','¥980','860K','3.2%',41,3.8],['新客首单·再营销','¥760','540K','2.1%',38,5.1],['会员唤醒·视频','¥640','610K','1.9%',29,2.9],['品牌曝光·广泛','¥1,200','1.6M','1.4%',26,2.2]]
  : [['搜索·品牌词','¥920','420K','4.8%',46,4.2],['搜索·通用词','¥780','360K','2.6%',32,3.4],['展示·再营销','¥640','780K','0.9%',28,4.8],['购物·产品','¥710','290K','3.1%',24,2.7],['视频·YouTube','¥600','510K','1.6%',12,1.9]]);
const trendEl=ref<HTMLElement|null>(null),funnelEl=ref<HTMLElement|null>(null);
const {render:rt}=useChart(trendEl,()=>{const base=platform.value==='meta'?[3200,3600,4100,3800,4600,5200,4820,5100,5600,4900,5300,5800,5400,4820]:[2400,2600,2900,2700,3200,3500,3650,3400,3800,3550,3900,4100,3800,3650];const conv=platform.value==='meta'?[120,138,151,142,172,196,186,201,218,190,205,224,210,186]:[90,98,110,102,125,138,142,131,149,140,153,161,150,142];return{tooltip:{trigger:'axis'},legend:{data:['花费','转化'],right:0,textStyle:{fontSize:11,color:'#6B7B74'}},grid:{left:50,right:36,top:30,bottom:24},xAxis:{type:'category',data:base.map((_,i)=>`11/${8+i}`),...axis},yAxis:[{type:'value',...axis},{type:'value',...axis,splitLine:{show:false}}],series:[{name:'花费',type:'bar',data:base,itemStyle:{color:'#2E7D6B',borderRadius:[4,4,0,0]},barMaxWidth:18},{name:'转化',type:'line',yAxisIndex:1,data:conv,smooth:true,lineStyle:{color:'#C9A227',width:2},itemStyle:{color:'#C9A227'}}]};});
useChart(funnelEl,()=>({tooltip:{trigger:'item'},series:[{type:'funnel',left:'10%',right:'10%',top:20,bottom:20,data:[{name:'落地页浏览',value:9840},{name:'咨询留资',value:1771},{name:'加微/预约',value:298},{name:'到店转化',value:186}],label:{position:'inside',fontSize:11,color:'#fff',formatter:'{b} {c}'},itemStyle:{borderColor:'#fff',borderWidth:2}}],color:['#2E7D6B','#4A9C86','#C9A227','#E0BE4F']}));
watch(platform,()=>rt());
</script>
