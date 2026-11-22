<template>
  <div>
    <div class="page-head"><div><div class="page-title">投流账户管理</div><div class="page-desc">Meta / Google Ads Business Manager 授权接入</div></div><el-button type="primary" @click="ElMessage.success('OAuth 授权窗口（演示）')"><el-icon><Plus /></el-icon>绑定账户</el-button></div>
    <div class="grid g2">
      <div v-for="a in accounts" :key="a.p" class="card"><div class="card-h"><h3><span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px" :style="{background:a.c}"></span>{{a.p}}</h3><span class="tag g">{{a.status}}</span></div><div class="card-b">
        <div style="font-size:15px;font-weight:600">{{a.n}}</div><div style="color:var(--ink2);font-size:12.5px;margin:6px 0 14px">{{a.id}} · {{a.desc}}</div>
        <div style="display:flex;gap:8px"><el-button size="small" @click="ElMessage.success('同步数据（演示）')">同步数据</el-button><el-button size="small" @click="ElMessage.success('授权管理（演示）')">授权管理</el-button></div>
      </div></div>
    </div>
    <div class="mini-note">授权主体为 Business Manager；Token 加密存储，支持多广告账户与权限隔离。当前为预留接口演示。</div>
  </div>
</template>
<script setup lang="ts">
import { ElMessage } from 'element-plus';
const accounts=[{p:'Meta',n:'鵲太醫 Business Manager',id:'BM · 1029384756',status:'已授权',c:'#1877F2',desc:'3 个广告账户 · 权限：管理员'},{p:'Google Ads',n:'鵲太醫 Google Ads',id:'MCC · 5821-4690-33',status:'已授权',c:'#34A853',desc:'2 个广告账户 · 权限：管理员'}];
</script>
