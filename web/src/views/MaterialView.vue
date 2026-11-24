<template>
  <div>
    <div class="page-head"><div><div class="page-title">素材生成工坊</div><div class="page-desc">AI 生成图文与视频脚本 · 素材库保存本机 · 需先在「AI 模型与密钥」配置 Key</div></div></div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>✨ AI 创作</h3><span class="tag g">调用已配置模型</span></div><div class="card-b">
        <el-form label-position="top">
          <el-form-item label="素材类型"><el-radio-group v-model="type"><el-radio-button value="image">图文笔记</el-radio-button><el-radio-button value="video">短视频脚本</el-radio-button></el-radio-group></el-form-item>
          <el-form-item label="主题 / 提示词"><el-input v-model="prompt" type="textarea" :rows="4" placeholder="例如：秋季肩颈理疗套餐种草…"/></el-form-item>
          <el-form-item v-if="type==='video'" label="视频供应商"><el-select v-model="vendor" style="width:100%"><el-option label="方舟 · Seedance 2.0" value="ark"/><el-option label="即梦" value="jimeng"/><el-option label="可灵" value="kling"/></el-select></el-form-item>
        </el-form>
        <el-button type="primary" @click="gen" :loading="loading"><el-icon><Sparkles /></el-icon>生成素材</el-button>
      </div></div>
      <div class="card"><div class="card-h"><h3>Skill 管理</h3><span class="page-desc">内置技能</span></div><div class="card-b">
        <div v-for="s in skills" :key="s[0]" style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line2)"><div style="width:36px;height:36px;border-radius:9px;background:var(--green-l);color:var(--green);display:flex;align-items:center;justify-content:center">✨</div><div style="flex:1"><div style="font-weight:600">{{s[0]}}</div><div style="font-size:12px;color:var(--ink2)">{{s[1]}}</div></div><span class="tag" :class="s[3]?'g':'y'">{{s[2]}}</span></div>
      </div></div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>素材库（{{ materials.length }}）</h3><span class="page-desc">点击卡片查看生成内容</span></div><div class="card-b"><div class="grid g4">
      <div v-for="m in materials" :key="m.id" style="border:1px solid var(--line);border-radius:10px;overflow:hidden">
        <div style="height:90px;background:linear-gradient(135deg,var(--green-l),var(--gold-l));display:flex;align-items:center;justify-content:center;color:var(--green);font-size:12px;cursor:pointer" @click="view(m)">{{m.payload?.type==='video'?'▶ 视频脚本':'图文预览'}}</div>
        <div style="padding:10px"><div style="font-size:12.5px;font-weight:600">{{m.title}}</div><div style="font-size:11px;color:var(--ink3);margin-top:4px">{{ m.payload?.type==='video'?'视频脚本':'图文' }} · {{fmtDate(m.createdAt)}}</div><el-button size="small" text type="danger" @click="del(m)">删除</el-button></div>
      </div>
    </div><div v-if="!materials.length" style="padding:24px;text-align:center;color:var(--ink2)">素材库为空，生成素材后会保存在这里。</div></div></div>

    <el-dialog v-model="viewDialog" :title="viewTitle" width="640px"><div style="white-space:pre-wrap;line-height:1.9;font-size:13.5px;color:var(--ink)">{{ viewContent }}</div><template #footer><el-button @click="viewDialog=false">关闭</el-button></template></el-dialog>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';

const type = ref('image'); const vendor = ref('ark');
const prompt = ref('秋季养生 · 肩颈理疗套餐种草笔记，突出专业手法与放松氛围');
const loading = ref(false);
const materials = ref<any[]>([]);
const viewDialog = ref(false); const viewTitle = ref(''); const viewContent = ref('');
const skills = [['小红书图文生成','一键生成种草图文笔记','已安装',1],['AI 短视频脚本','分镜脚本 + 旁白生成','已安装',1],['方舟 Seedance 视频','图片转短视频','需 Large 档',0],['飞书报告助手','自动生成数据日报','已安装',1]];

async function load() {
  try { materials.value = await api.bizList('material'); }
  catch (e: any) { ElMessage.error(e.message || '加载素材失败'); }
}
onMounted(load);

async function gen() {
  if (!prompt.value.trim()) return ElMessage.warning('请输入主题或提示词');
  loading.value = true;
  try {
    const system = type.value === 'video'
      ? '你是短视频编导，输出分镜脚本（镜头/画面/旁白/时长），中文，可直接拍摄。'
      : '你是小红书运营，输出一篇种草图文笔记（标题+正文+话题标签），中文，真实自然。';
    const data = await api.aiChat({ prompt: prompt.value, system, scene: 'social' });
    const title = prompt.value.slice(0, 24) + (type.value === 'video' ? '·视频脚本' : '·图文');
    await api.bizCreate('material', {
      storeId: '', title,
      payload: { type: type.value, prompt: prompt.value, vendor: type.value === 'video' ? vendor.value : '', content: data.content, model: data.model },
    });
    ElMessage.success(`${type.value === 'video' ? '短视频脚本' : '图文笔记'}已生成并保存到素材库`);
    await load();
  } catch (e: any) {
    const msg = e.message || '生成失败';
    if (msg.includes('Key') || msg.includes('配置')) {
      ElMessage.warning('请先到「系统设置 → AI 模型与密钥」配置 API Key 后再生成');
    } else ElMessage.error(msg);
  } finally { loading.value = false; }
}
function view(m: any) { viewTitle.value = m.title; viewContent.value = m.payload?.content || '（无内容）'; viewDialog.value = true; }
async function del(m: any) {
  try { await ElMessageBox.confirm(`确定删除素材「${m.title}」吗？`, '删除', { type: 'warning' }); } catch { return; }
  try { await api.bizDelete('material', m.id); ElMessage.success('已删除'); await load(); }
  catch (e: any) { ElMessage.error(e.message || '删除失败'); }
}
function fmtDate(ts: number) { return ts ? new Date(ts).toLocaleDateString('zh-CN') : '—'; }
</script>
