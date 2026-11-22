<template>
  <div>
    <div class="page-head"><div><div class="page-title">素材生成工坊</div><div class="page-desc">AI 生成图文与视频 · Skill 管理 · 视频供应商配置</div></div></div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>✨ AI 创作</h3><span class="tag g">方舟 Agent Plan</span></div><div class="card-b">
        <el-form label-position="top">
          <el-form-item label="素材类型"><el-radio-group v-model="type"><el-radio-button value="image">图文笔记</el-radio-button><el-radio-button value="video">短视频</el-radio-button></el-radio-group></el-form-item>
          <el-form-item label="主题 / 提示词"><el-input v-model="prompt" type="textarea" :rows="4" placeholder="例如：秋季肩颈理疗套餐种草…"/></el-form-item>
          <el-form-item label="视频供应商（视频生成时生效）"><el-select v-model="vendor" :disabled="type!=='video'" style="width:100%"><el-option label="方舟 · Seedance 2.0" value="ark"/><el-option label="即梦" value="jimeng"/><el-option label="可灵" value="kling"/></el-select></el-form-item>
        </el-form>
        <el-button type="primary" @click="gen" :loading="loading"><el-icon><Sparkles /></el-icon>生成素材</el-button>
      </div></div>
      <div class="card"><div class="card-h"><h3>Skill 管理</h3><span class="page-desc">已安装 4 个</span></div><div class="card-b">
        <div v-for="s in skills" :key="s[0]" style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line2)"><div style="width:36px;height:36px;border-radius:9px;background:var(--green-l);color:var(--green);display:flex;align-items:center;justify-content:center">✨</div><div style="flex:1"><div style="font-weight:600">{{s[0]}}</div><div style="font-size:12px;color:var(--ink2)">{{s[1]}}</div></div><span class="tag" :class="s[3]?'g':'y'">{{s[2]}}</span></div>
      </div></div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>素材库</h3></div><div class="card-b"><div class="grid g4">
      <div v-for="m in materials" :key="m[0]" style="border:1px solid var(--line);border-radius:10px;overflow:hidden"><div style="height:90px;background:linear-gradient(135deg,var(--green-l),var(--gold-l));display:flex;align-items:center;justify-content:center;color:var(--green);font-size:12px">{{m[1]==='视频'?'▶ 视频封面':'图文预览'}}</div><div style="padding:10px"><div style="font-size:12.5px;font-weight:600">{{m[0]}}</div><div style="font-size:11px;color:var(--ink3);margin-top:4px">{{m[2]}} · {{m[3]}}</div></div></div>
    </div></div></div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
const type=ref('image'); const vendor=ref('ark'); const prompt=ref('秋季养生 · 肩颈理疗套餐种草笔记，突出专业手法与放松氛围'); const loading=ref(false);
const skills=[['小红书图文生成','一键生成种草图文笔记','已安装',1],['AI 短视频脚本','分镜脚本 + 旁白生成','已安装',1],['方舟 Seedance 视频','图片转短视频','需 Large 档',0],['飞书报告助手','自动生成数据日报','已安装',1]];
const materials=[['秋季肩颈理疗种草图文','图文','11-21','已发布'],['精油SPA 30秒短视频','视频','11-20','待发布'],['新客体验价海报','图文','11-19','已发布'],['门店环境展示视频','视频','11-18','草稿']];
function gen(){loading.value=true;setTimeout(()=>{loading.value=false;ElMessage.success(type.value==='video'?'短视频已生成，可在素材库查看':'图文笔记已生成，可在素材库查看')},1200)}
</script>
