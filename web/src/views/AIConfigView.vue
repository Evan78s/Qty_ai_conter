<template>
  <div>
    <div class="page-head"><div><div class="page-title">AI 模型与密钥</div><div class="page-desc">全局默认密钥（总管理员配置）+ 个人自带密钥 · 统一适配器多厂商接入</div></div><el-button type="primary" @click="ElMessage.success('配置已保存')">保存配置</el-button></div>
    <div class="card"><div class="card-h"><h3>🔑 全局默认模型（所有用户回退使用）</h3><span class="tag g">总管理员可配置</span></div><div class="card-b">
      <div class="grid g3"><el-form-item label="默认供应商"><el-select model-value="deepseek" style="width:100%"><el-option label="DeepSeek" value="deepseek"/><el-option label="方舟 Agent Plan" value="arkplan"/></el-select></el-form-item><el-form-item label="默认模型"><el-select model-value="deepseek-v4-pro" style="width:100%"><el-option label="deepseek-v4-pro" value="deepseek-v4-pro"/><el-option label="deepseek-v4-flash" value="deepseek-v4-flash"/></el-select></el-form-item><el-form-item label="全局 API Key"><el-input type="password" model-value="sk-••••••••••••••••"/></el-form-item></div>
      <div class="mini-note">由总管理员统一配置，所有用户未配置个人 Key 时回退使用。Key 以 AES-256-GCM 加密存储，前端仅显示掩码。</div>
    </div></div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>模型供应商接入</h3><span class="page-desc">OpenAI 兼容统一适配器</span></div><div class="card-b"><div class="grid g2">
      <div v-for="p in providers" :key="p.id" style="border:1px solid var(--line);border-radius:10px;padding:14px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="width:10px;height:10px;border-radius:50%" :style="{background:p.color}"></span><b>{{p.name}}</b><span v-if="p.tag" class="tag g">{{p.tag}}</span></div><div style="font-size:12px;color:var(--ink2);line-height:1.9"><div>{{p.desc}}</div><div style="font-family:monospace;font-size:11px;color:var(--ink3)">{{p.base}}</div><div>模型：{{p.model}}</div></div><div style="margin-top:10px;display:flex;gap:8px"><el-button size="small" @click="ElMessage.success('连通测试成功 · '+p.name)">测试连接</el-button><el-button size="small" @click="ElMessage.success('配置窗口（演示）')">配置</el-button></div></div>
    </div></div></div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>场景模型绑定</h3></div><div class="card-b" style="padding:0">
      <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['使用场景','能力要求','当前模型','温度','操作']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
        <tr v-for="s in scenes" :key="s[0]"><td style="padding:11px 12px;border-bottom:1px solid var(--line2);font-weight:600">{{s[0]}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2);color:var(--ink2)">{{s[1]}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag g">{{s[2]}}</span></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{s[3]}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><el-button size="small" text @click="ElMessage.success('修改场景绑定（演示）')">修改</el-button></td></tr>
      </tbody></table>
    </div></div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>个人自带密钥</h3><span class="tag y">优先级高于全局</span></div><div class="card-b"><el-form label-position="top"><el-form-item label="我的 API Key（留空则使用全局配置）"><el-input type="password" placeholder="sk-••••••••••••••••"/></el-form-item></el-form><div class="mini-note">密钥优先级：个人自带 Key &gt; 门店级 &gt; 全局默认 Key</div></div></div>
  </div>
</template>
<script setup lang="ts">
import { ElMessage } from 'element-plus';
const providers=[{id:'deepseek',name:'DeepSeek',desc:'默认模型 · OpenAI 兼容',base:'https://api.deepseek.com',model:'deepseek-v4-pro',tag:'默认',color:'#4A6CF7'},{id:'arkplan',name:'方舟 Agent Plan',desc:'订阅制 AFP · 含多模态/视频',base:'ark.cn-beijing.volces.com/api/plan/v3',model:'doubao-seed-2.0-pro',tag:'默认',color:'#E8582F'},{id:'ark',name:'方舟 Ark（按量）',desc:'独立端点 · 接入点 ep-xxx',base:'https://ark.cn-beijing.volces.com/api/v3',model:'ep-2026xxxx',tag:'',color:'#E88A2F'},{id:'bailian',name:'阿里百炼',desc:'DashScope 兼容模式',base:'dashscope.aliyuncs.com/compatible-mode/v1',model:'qwen-plus',tag:'',color:'#627EF6'},{id:'custom',name:'自定义接口',desc:'通用 OpenAI 兼容端点',base:'https://your-api.com/v1',model:'custom-model',tag:'',color:'#8A97A2'}];
const scenes=[['店铺对账核对','视觉识别 + 结构化提取','DeepSeek V4 Pro','0.2'],['投流数据分析','推理 / 归因','DeepSeek V4 Pro','0.3'],['自媒体内容创作','多模态生成','方舟 Agent Plan','0.8'],['AI 客服回复','知识库问答','DeepSeek V4 Flash','0.5'],['视频生成','图生视频','方舟 Seedance 2.0','—']];
</script>
