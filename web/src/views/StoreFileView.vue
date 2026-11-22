<template>
  <div>
    <div class="page-head"><div><div class="page-title">门店档案</div><div class="page-desc">门店基础信息、员工与项目价目表</div></div><el-button type="primary" @click="ElMessage.success('新增门店窗口（演示）')"><el-icon><Plus /></el-icon>新增门店</el-button></div>
    <div class="grid g3">
      <div v-for="s in stores" :key="s.id" class="card"><div class="card-h"><h3>{{ s.name }}</h3><span class="tag g">营业中</span></div><div class="card-b">
        <div style="font-size:12.5px;color:var(--ink2);line-height:2">📍 {{ s.address }}<br>👤 店长：{{ s.managerName }}<br>👥 员工：{{ s.staffCount }} 人<br>🏷 会员：{{ (s as any).member }} 人</div>
        <div style="margin-top:12px;display:flex;gap:8px"><el-button size="small" @click="ElMessage.success('编辑门店（演示）')">编辑</el-button><el-button size="small" @click="ElMessage.success('员工管理（演示）')">员工管理</el-button></div>
      </div></div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>项目价目表 · 鵲太醫·总店</h3><el-button size="small" @click="ElMessage.success('新增项目（演示）')"><el-icon><Plus /></el-icon>新增项目</el-button></div><div class="card-b" style="padding:0">
      <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['项目名称','类别','售价','耗卡价','时长','状态']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
        <tr v-for="p in prices" :key="p[0]"><td v-for="(c,i) in p" :key="i" style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span v-if="i===5" class="tag" :class="c?'g':'gray'">{{c?'在售':'下架'}}</span><span v-else>{{c}}</span></td></tr>
      </tbody></table>
    </div></div>
  </div>
</template>
<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { api } from '../api';
import { ref, onMounted } from 'vue';
import { STORES } from '../api/mock';
const stores = ref<any[]>([]);
onMounted(async()=>{ try{ const list=await api.get('/stores'); stores.value=list.map((s:any)=>({...s,member:(STORES as any)[s.id]?.member||0})); }catch{ stores.value=[]; } });
const prices=[['肩颈理疗·单次','理疗','¥298','¥198','60分钟',1],['精油SPA·90分钟','SPA','¥498','¥358','90分钟',1],['艾灸养生·疗程','艾灸','¥1,280','¥980','10次',1],['面部护理·单次','美容','¥368','¥258','70分钟',1],['拔罐刮痧·单次','理疗','¥188','¥128','45分钟',0]];
</script>
