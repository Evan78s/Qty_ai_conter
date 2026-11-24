<template>
  <div>
    <div class="page-head"><div><div class="page-title">权限管理</div><div class="page-desc">多店连锁 · 角色与门店数据权限精细化管控</div></div><el-button type="primary" @click="openCreateUser"><el-icon><Plus /></el-icon>新增用户</el-button></div>
    <div class="grid g4"><div v-for="k in kpis" :key="k.lb" class="card kpi"><div class="top"><span class="lb">{{k.lb}}</span><span class="ic">🔐</span></div><div class="val num">{{k.v}}</div></div></div>
    <el-tabs v-model="tab" style="margin-top:16px">
      <!-- 用户管理 -->
      <el-tab-pane label="用户管理" name="users"><div class="card" style="margin-top:14px"><div class="card-h"><h3>用户列表</h3></div><div class="card-b" style="padding:0">
        <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['姓名','账号','角色','可访问门店','状态','操作']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
          <tr v-for="u in users" :key="u.id">
            <td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{ u.displayName }}</td>
            <td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{ u.username }}</td>
            <td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag" :class="u.roleCode==='super_admin'?'r':u.roleCode==='store_manager'?'g':u.roleCode==='staff'?'y':'gray'">{{ roleName(u.roleCode) }}</span></td>
            <td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{ storeNames(u.id) }}</td>
            <td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag" :class="u.status==='active'?'g':'gray'">{{ u.status==='active'?'正常':'停用' }}</span></td>
            <td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><el-button size="small" text @click="openEditUser(u)">编辑</el-button><el-button size="small" text type="danger" @click="removeUser(u)">删除</el-button></td>
          </tr>
        </tbody></table>
        <div v-if="!users.length" style="padding:24px;text-align:center;color:var(--ink2)">暂无用户</div>
      </div></div></el-tab-pane>
      <!-- 角色权限矩阵 -->
      <el-tab-pane label="角色权限矩阵" name="matrix"><div class="card" style="margin-top:14px"><div class="card-h"><h3>RBAC 权限矩阵</h3><span class="page-desc">V查看 E编辑 A审批 X导出 · 点击单元格切换 · 保存后对全部角色生效</span><el-button size="small" type="primary" :loading="savingRole" @click="saveRoles">保存权限</el-button></div><div class="card-b" style="padding:0;overflow-x:auto">
        <table style="width:100%;min-width:680px;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left;padding:11px 12px;background:#FAFBF9">功能板块</th><th v-for="r in roles" :key="r.code" style="text-align:center;padding:11px 12px;background:#FAFBF9">{{ r.name }}</th></tr></thead><tbody>
          <tr v-for="m in moduleDefs" :key="m.key"><td style="padding:11px 12px;border-bottom:1px solid var(--line2);font-weight:600">{{ m.label }}</td><td v-for="r in roles" :key="r.code" style="text-align:center;padding:11px 12px;border-bottom:1px solid var(--line2)"><span v-for="p in permDefs" :key="p.bit" class="tag" :class="(rolePerms[r.code]?.[m.key]||0)&p.bit?'g':'gray'" style="cursor:pointer;margin:0 2px" :title="p.label" @click="togglePerm(r.code,m.key,p.bit)">{{ p.label }}</span></td></tr>
        </tbody></table>
      </div></div></el-tab-pane>
      <!-- 门店管理 -->
      <el-tab-pane label="门店管理" name="stores"><div class="card" style="margin-top:14px"><div class="card-h"><h3>门店管理（与「门店档案」同步）</h3><el-button size="small" @click="goStores">添加门店</el-button></div><div class="card-b" style="padding:0">
        <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['门店','地址','店长','员工数','状态']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
          <tr v-for="s in stores" :key="s.id"><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{ s.name }}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{ s.address }}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{ s.managerName }}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{ s.staffCount }}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag g">{{ s.status==='active'?'营业中':'停用' }}</span></td></tr>
        </tbody></table>
      </div></div></el-tab-pane>
      <!-- 审计日志 -->
      <el-tab-pane label="审计日志" name="audit"><div class="card" style="margin-top:14px"><div class="card-h"><h3>操作审计日志</h3><el-button size="small" @click="exportAudit">导出 CSV</el-button></div><div class="card-b" style="padding:0">
        <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['时间','操作','模块','结果']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
          <tr v-for="a in audit" :key="a.id"><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{ fmtTime(a.createdAt) }}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{ a.action }}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{ a.module }}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="chip up">{{ a.result }}</span></td></tr>
        </tbody></table>
        <div v-if="!audit.length" style="padding:24px;text-align:center;color:var(--ink2)">暂无审计日志</div>
      </div></div></el-tab-pane>
    </el-tabs>

    <!-- 新增/编辑用户弹窗 -->
    <el-dialog v-model="userDialog" :title="editingUser?'编辑用户':'新增用户'" width="500px">
      <el-form label-position="top" :model="userForm">
        <el-form-item label="姓名"><el-input v-model="userForm.displayName" placeholder="姓名" /></el-form-item>
        <el-form-item label="账号"><el-input v-model="userForm.username" placeholder="手机号 / 账号" :disabled="editingUser" /></el-form-item>
        <el-form-item v-if="!editingUser" label="初始密码"><el-input v-model="userForm.password" type="password" placeholder="至少 8 位" show-password /></el-form-item>
        <el-form-item v-else label="重置密码（留空不改）"><el-input v-model="userForm.password" type="password" placeholder="留空则保持原密码" show-password /></el-form-item>
        <el-form-item label="角色"><el-select v-model="userForm.roleCode" style="width:100%"><el-option v-for="r in roles" :key="r.code" :label="r.name" :value="r.code" /></el-select></el-form-item>
        <el-form-item label="可访问门店"><el-select v-model="userForm.storeIds" multiple style="width:100%"><el-option v-for="s in stores" :key="s.id" :label="s.name" :value="s.id" /></el-select></el-form-item>
        <el-form-item v-if="editingUser" label="状态"><el-select v-model="userForm.status" style="width:100%"><el-option label="正常" value="active" /><el-option label="停用" value="disabled" /></el-select></el-form-item>
      </el-form>
      <template #footer><el-button @click="userDialog=false">取消</el-button><el-button type="primary" :loading="savingUser" @click="submitUser">{{ editingUser?'保存修改':'创建用户' }}</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import { api } from '../api';

const router = useRouter();
const tab = ref('users');
const users = ref<any[]>([]);
const roles = ref<any[]>([]);
const stores = ref<any[]>([]);
const audit = ref<any[]>([]);
const userLinks = ref<any[]>([]);
const rolePerms = ref<Record<string, Record<string, number>>>({});
const savingRole = ref(false);
const savingUser = ref(false);
const userDialog = ref(false);
const editingUser = ref(false);
const userForm = ref<any>({ id: '', displayName: '', username: '', password: '', roleCode: 'staff', storeIds: [], status: 'active' });

const moduleDefs = [
  { key: 'overview', label: '总览驾驶舱' }, { key: 'store', label: '店铺看板' },
  { key: 'reconcile', label: '每日对账' }, { key: 'ads', label: '投流看板' },
  { key: 'service', label: 'AI 客服' }, { key: 'social', label: '自媒体' }, { key: 'system', label: '系统设置' },
];
const permDefs = [
  { bit: 1, label: 'V' }, { bit: 2, label: 'E' }, { bit: 4, label: 'A' }, { bit: 8, label: 'X' },
];

function roleName(code: string) { return ({ super_admin: '总管理员', store_manager: '店长', staff: '员工', auditor: '只读审计' } as any)[code] || code; }
function storeNames(userId: string) {
  const ids = userLinks.value.filter((l) => l.userId === userId).map((l) => l.storeId);
  if (!ids.length) return '全部门店';
  return ids.map((id) => stores.value.find((s) => s.id === id)?.name || id).join('、');
}
const kpis = computed(() => [
  { lb: '用户总数', v: String(users.value.length) },
  { lb: '角色数', v: String(roles.value.length) },
  { lb: '门店数', v: String(stores.value.length) },
  { lb: '审计日志', v: String(audit.value.length) },
]);

async function load() {
  try {
    const [u, r, s, a] = await Promise.all([
      api.get('/users'), api.get('/users/roles'), api.get('/stores'), api.get('/audit'),
    ]);
    users.value = Array.isArray(u) ? u : [];
    roles.value = Array.isArray(r) ? r : [];
    stores.value = Array.isArray(s) ? s : [];
    audit.value = Array.isArray(a) ? a : [];
    for (const role of roles.value) {
      try {
        const perms = typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions;
        rolePerms.value[role.code] = perms || {};
      } catch { rolePerms.value[role.code] = {}; }
    }
    // 用户-门店关联从用户对象带出（列表接口未返回时按 storeIds 字段兜底）
    userLinks.value = users.value.flatMap((usr: any) => (usr.storeIds || []).map((sid: string) => ({ userId: usr.id, storeId: sid })));
  } catch (e: any) { ElMessage.error(e.message || '加载失败'); }
}
onMounted(load);

function openCreateUser() {
  editingUser.value = false;
  userForm.value = { id: '', displayName: '', username: '', password: '', roleCode: 'staff', storeIds: [], status: 'active' };
  userDialog.value = true;
}
function openEditUser(u: any) {
  editingUser.value = true;
  userForm.value = { id: u.id, displayName: u.displayName, username: u.username, password: '', roleCode: u.roleCode, storeIds: u.storeIds || [], status: u.status || 'active' };
  userDialog.value = true;
}
async function submitUser() {
  if (!userForm.value.displayName || (!editingUser.value && !userForm.value.username)) return ElMessage.warning('请填写姓名和账号');
  if (!editingUser.value && (!userForm.value.password || userForm.value.password.length < 8)) return ElMessage.warning('初始密码至少 8 位');
  savingUser.value = true;
  try {
    if (editingUser.value) {
      const { id, ...body } = userForm.value;
      if (!body.password) delete body.password;
      await api.updateUser(id, body);
      ElMessage.success('用户已更新');
    } else {
      await api.post('/users', userForm.value);
      ElMessage.success('用户已创建');
    }
    userDialog.value = false;
    await load();
  } catch (e: any) { ElMessage.error(e.message || '操作失败'); }
  finally { savingUser.value = false; }
}
async function removeUser(u: any) {
  try { await ElMessageBox.confirm(`确定删除用户「${u.displayName}」吗？`, '删除用户', { type: 'warning' }); } catch { return; }
  try { await api.deleteUser(u.id); ElMessage.success('用户已删除'); await load(); }
  catch (e: any) { ElMessage.error(e.message || '删除失败'); }
}
function togglePerm(code: string, module: string, bit: number) {
  const cur = rolePerms.value[code]?.[module] || 0;
  if (!rolePerms.value[code]) rolePerms.value[code] = {};
  rolePerms.value[code][module] = cur & bit ? cur & ~bit : cur | bit;
}
async function saveRoles() {
  savingRole.value = true;
  try {
    for (const code of Object.keys(rolePerms.value)) await api.updateRole(code, rolePerms.value[code]);
    ElMessage.success('权限矩阵已保存');
    await load();
  } catch (e: any) { ElMessage.error(e.message || '保存失败'); }
  finally { savingRole.value = false; }
}
function goStores() { router.push('/storefile'); }
function fmtTime(ts: number) { return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '—'; }
function exportAudit() {
  if (!audit.value.length) return ElMessage.warning('暂无日志可导出');
  const head = '时间,操作,模块,结果';
  const rows = audit.value.map((a) => [fmtTime(a.createdAt), a.action, a.module, a.result].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','));
  const blob = new Blob(['\ufeff' + [head, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `审计日志_${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
  ElMessage.success('已导出审计日志');
}
</script>
