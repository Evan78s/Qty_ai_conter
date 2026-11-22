<template>
  <div>
    <div class="page-head"><div><div class="page-title">小程序预览</div><div class="page-desc">移动端 / 小程序关键页示意 · 复用同一后端与 AI 配置</div></div><span class="tag g">高频场景优先</span></div>
    <div class="mini-phones">
      <div v-for="p in phones" :key="p.title" class="phone">
        <div class="status"><span>9:41</span><span>●●● ▰</span></div>
        <div class="nav">{{p.title}}</div>
        <div class="pbody" v-html="p.body"></div>
        <div class="tabbar"><div :class="{on:p.tab==='home'}">首页</div><div :class="{on:p.tab==='data'}">看板</div><div :class="{on:p.tab==='service'}">接待</div><div>我的</div></div>
      </div>
    </div>
    <div class="mini-note">小程序聚焦：总览、店铺看板、待人工接待、AI 回复；完整管理功能保留在响应式 Web 端。</div>
  </div>
</template>
<script setup lang="ts">
const tabbar=(on:string)=>'';
const phones=[
  {title:'总览',tab:'home',body:`<div class="m-row"><div class="m-kpi"><div class="t">今日营业额</div><div class="v num">¥18,620</div></div><div class="m-kpi"><div class="t">到店人次</div><div class="v num">96</div></div></div><div class="m-row"><div class="m-kpi"><div class="t">充值金额</div><div class="v num">¥9,800</div></div><div class="m-kpi"><div class="t">耗卡金额</div><div class="v num">¥6,340</div></div></div><div class="m-kpi"><div class="t">门店业绩排行</div><div style="font-size:11px;line-height:2;margin-top:4px">1. 总店 ¥18,620<br>2. 浦东店 ¥14,880<br>3. 静安店 ¥12,450</div></div>`},
  {title:'店铺看板',tab:'data',body:`<div class="m-kpi"><div class="t">营业额趋势 · 近7天</div><svg viewBox="0 0 200 80" style="width:100%;height:80px;margin-top:6px"><polyline points="0,60 30,45 60,50 90,30 120,38 150,20 180,28" fill="none" stroke="#2E7D6B" stroke-width="2"/><polyline points="0,60 30,45 60,50 90,30 120,38 150,20 180,28 180,80 0,80" fill="rgba(46,125,107,.12)" stroke="none"/></svg></div><div class="m-kpi"><div class="t">项目占比</div><div style="font-size:11px;line-height:1.9;margin-top:4px">肩颈理疗 38% · 精油SPA 26%<br>艾灸养生 18% · 面部护理 12%</div></div>`},
  {title:'待人工接待',tab:'service',body:`<div style="font-size:11px;color:var(--ink2);margin-bottom:8px">4 条消息待处理</div><div class="m-kpi"><div style="display:flex;justify-content:space-between"><b style="font-size:12px">林女士</b><span class="tag r" style="font-size:9px">待回复</span></div><div style="font-size:11px;color:var(--ink2);margin-top:4px">咨询肩颈理疗套餐价格和预约…</div></div><div class="m-kpi"><div style="display:flex;justify-content:space-between"><b style="font-size:12px">Anonymous</b><span class="tag r" style="font-size:9px">待回复</span></div><div style="font-size:11px;color:var(--ink2);margin-top:4px">What are your opening hours?…</div></div><div class="m-kpi"><div style="display:flex;justify-content:space-between"><b style="font-size:12px">陈先生</b><span class="tag r" style="font-size:9px">待回复</span></div><div style="font-size:11px;color:var(--ink2);margin-top:4px">会员卡可以转让给别人使用吗？</div></div>`},
  {title:'AI 回复',tab:'home',body:`<div class="m-kpi"><div class="t">AI 经营助手</div><div style="font-size:11px;line-height:1.8;margin-top:6px">本周总营业额环比 +12.4%，充值创新高。</div></div><div style="border:1px solid var(--line);border-radius:9px;padding:10px;height:250px;display:flex;flex-direction:column"><div style="flex:1;font-size:11px;color:var(--ink2)">问：本周经营亮点？<br><br>答：总店表现最佳，老客推荐占比提升…</div><div style="height:32px;border:1px solid var(--line);border-radius:6px;display:flex;align-items:center;padding:0 8px;font-size:11px;color:var(--ink3)">输入问题…</div></div>`},
];
</script>
