<template>
  <div>
    <div class="page-head"><div><div class="page-title">投流账户管理</div><div class="page-desc">Meta / Google Ads Business Manager 账户登记与授权状态</div></div><el-button type="primary" @click="dialog=true"><el-icon><Plus /></el-icon>绑定账户</el-button></div>
    <div class="grid g2">
      <div v-for="a in accounts" :key="a.id" class="card"><div class="card-h"><h3><span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px" :style="{background:a.payload?.platform==='Google Ads'?'#34A853':'#1877F2'}"></span>{{a.payload?.platform}}</h3><span class="tag" :class="a.status==='active'?'g':'gray'">{{a.status==='active'?'已登记':'已停用'}}</span></div><div class="card-b">
        <div style="font-size:15px;font-weight:600">{{a.title}}</div><div style="color:var(--ink2);font-size:12.5px;margin:6px 0 14px">{{a.payload?.accountId}} · {{a.payload?.desc}}</div>
        <div style="display:flex;gap:8px"><el-button size="small" @click="syncData(a)">同步数据</el-button><el-button size="small" @click="authManage(a)">授权管理</el-button><el-button size="small" text type="danger" @click="del(a)">删除</el-button></div>
      </div></div>
    </div>
    <div v-if="!accounts.length" style="padding:32px;text-align:center;color:var(--ink2)">暂无账户，点「绑定账户」登记 Meta / Google Ads 账户。</div>
    <div class="mini-note">账户信息保存在本机；真实拉取投流数据需完成官方 OAuth 授权（在「系统设置 → 飞书授权」之外的投流凭证接入，后续开放）。Token 加密存储。</div>

    <el-dialog v-model="dialog" title="绑定投流账户" width="480px"><el-form label-position="top">
      <el-form-item label="平台"><el-select v-model="form.platform" style="width:100%"><el-option label="Meta" value="Meta"/><el-option label="Google Ads" value="Google Ads"/></el-select></el-form-item>
      <el-form-item label="账户名称"><el-input v-model="form.name" placeholder="如：鵲太醫 Business Manager"/></el-form-item>
      <el-form-item label="账户 ID"><el-input v-model="form.accountId" placeholder="如：BM 1029384756 / MCC 5821-4690-33"/></el-form-item>
      <el-form-item label="备注"><el-input v-model="form.desc" placeholder="广告账户数、权限等"/></el-form-item>
    </el-form><template #footer><el-button @click="dialog=false">取消</el-button><el-button type="primary" @click="submit">保存账户</el-button></template></el-dialog>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';

const accounts = ref<any[]>([]);
const dialog = ref(false);
const form = ref<any>({ platform: 'Meta', name: '', accountId: '', desc: '' });

async function load() {
  try { accounts.value = await api.bizList('ads_account'); }
  catch (e: any) { ElMessage.error(e.message || '加载失败'); }
}
onMounted(load);

async function submit() {
  if (!form.value.name || !form.value.accountId) return ElMessage.warning('请填写账户名称和 ID');
  try {
    await api.bizCreate('ads_account', { storeId: '', title: form.value.name, payload: { ...form.value } });
    dialog.value = false; ElMessage.success('账户已登记'); await load();
  } catch (e: any) { ElMessage.error(e.message || '保存失败'); }
}
async function checkCap(platform: string): Promise<boolean> {
  try {
    const cap = await api.capabilities();
    const key = platform === 'Google Ads' ? 'googleAds' : 'metaAds';
    if (!cap.capabilities?.[key]?.enabled) {
      ElMessage.warning(`${platform} 尚未完成官方 OAuth 授权，账户已登记；真实数据拉取将在凭证接入后自动启用`);
      return false;
    }
    return true;
  } catch { return false; }
}
async function syncData(a: any) { if (await checkCap(a.payload?.platform)) ElMessage.info('授权有效，投流数据同步将在数据接口接入后自动生效'); }
async function authManage(a: any) { if (await checkCap(a.payload?.platform)) ElMessage.info(`${a.payload?.platform} 授权有效`); }
async function del(a: any) {
  try { await ElMessageBox.confirm(`确定删除账户「${a.title}」吗？`, '删除', { type: 'warning' }); } catch { return; }
  try { await api.bizDelete('ads_account', a.id); ElMessage.success('已删除'); await load(); }
  catch (e: any) { ElMessage.error(e.message || '删除失败'); }
}
</script>
