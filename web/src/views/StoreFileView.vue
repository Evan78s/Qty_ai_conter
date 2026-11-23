<template>
  <div>
    <div class="page-head">
      <div><div class="page-title">门店档案</div><div class="page-desc">门店基础信息、员工与项目价目表（数据保存至 MySQL）</div></div>
      <el-button v-if="canEdit" type="primary" @click="openCreate"><el-icon><Plus /></el-icon>新增门店</el-button>
    </div>

    <div class="grid g3">
      <div v-for="s in stores" :key="s.id" class="card">
        <div class="card-h"><h3>{{ s.name }}</h3><span class="tag g">{{ s.status === 'active' ? '营业中' : '已停用' }}</span></div>
        <div class="card-b">
          <div style="font-size:12.5px;color:var(--ink2);line-height:2">
            📍 {{ s.address || '—' }}<br>👤 店长：{{ s.managerName || '—' }}<br>👥 员工：{{ s.staffCount }} 人<br>🏷 会员：{{ (s as any).member || 0 }} 人
          </div>
          <div v-if="canEdit" style="margin-top:12px;display:flex;gap:8px">
            <el-button size="small" @click="openEdit(s)">编辑</el-button>
            <el-button size="small" type="danger" plain @click="removeStore(s)">删除</el-button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="!stores.length" style="padding:32px;text-align:center;color:var(--ink2)">暂无门店数据，点右上角「新增门店」添加。</div>

    <div class="card" style="margin-top:16px">
      <div class="card-h"><h3>项目价目表 · {{ firstStoreName }}</h3><el-button size="small" @click="ElMessage.success('新增项目（演示）')"><el-icon><Plus /></el-icon>新增项目</el-button></div>
      <div class="card-b" style="padding:0">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr><th v-for="h in ['项目名称','类别','售价','耗卡价','时长','状态']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead>
          <tbody>
            <tr v-for="p in prices" :key="p[0]"><td v-for="(c,i) in p" :key="i" style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span v-if="i===5" class="tag" :class="c?'g':'gray'">{{c?'在售':'下架'}}</span><span v-else>{{c}}</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 新增/编辑门店弹窗 -->
    <el-dialog v-model="dialog" :title="editing ? '编辑门店' : '新增门店'" width="480px" :close-on-click-modal="false">
      <el-form label-position="top" :model="form">
        <el-form-item label="门店名称" required><el-input v-model="form.name" placeholder="如：鵲太醫·静安店" maxlength="128" /></el-form-item>
        <el-form-item label="地址"><el-input v-model="form.address" placeholder="门店详细地址" maxlength="255" /></el-form-item>
        <el-form-item label="店长"><el-input v-model="form.managerName" placeholder="店长姓名" maxlength="64" /></el-form-item>
        <el-form-item label="员工人数"><el-input-number v-model="form.staffCount" :min="0" :max="9999" style="width:100%" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">{{ editing ? '保存修改' : '创建门店' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';
import { ref, onMounted, computed } from 'vue';
import { useAppStore } from '../stores/app';
import { Plus } from '@element-plus/icons-vue';

const app = useAppStore();
const canEdit = computed(() => app.can('system', 2)); // 需要 system 编辑权限
const stores = ref<any[]>([]);
const dialog = ref(false);
const editing = ref(false);
const saving = ref(false);
const form = ref({ id: '', name: '', address: '', managerName: '', staffCount: 0 });

async function load() {
  try {
    const list = await api.get('/stores');
    stores.value = Array.isArray(list) ? list : [];
  } catch (e: any) { ElMessage.error(e.message || '加载门店失败'); stores.value = []; }
}
onMounted(load);

function openCreate() {
  editing.value = false;
  form.value = { id: '', name: '', address: '', managerName: '', staffCount: 0 };
  dialog.value = true;
}
function openEdit(s: any) {
  editing.value = true;
  form.value = { id: s.id, name: s.name, address: s.address || '', managerName: s.managerName || '', staffCount: s.staffCount || 0 };
  dialog.value = true;
}
async function submit() {
  if (!form.value.name.trim()) return ElMessage.warning('请填写门店名称');
  saving.value = true;
  try {
    const { id, ...body } = form.value;
    if (editing.value) {
      await api.patch(`/stores/${id}`, body);
      ElMessage.success('门店信息已保存');
    } else {
      await api.post('/stores', body);
      ElMessage.success('门店已创建');
    }
    dialog.value = false;
    await load();
    // 通知侧栏/顶栏的门店下拉刷新
    window.dispatchEvent(new CustomEvent('stores-changed'));
  } catch (e: any) { ElMessage.error(e.message || '保存失败'); }
  finally { saving.value = false; }
}
async function removeStore(s: any) {
  try {
    await ElMessageBox.confirm(`确定删除门店「${s.name}」吗？此操作不可撤销。`, '删除门店', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' });
    } catch { return; }
  saving.value = true;
  try {
    await api.del(`/stores/${s.id}`);
    ElMessage.success('门店已删除');
    await load();
    window.dispatchEvent(new CustomEvent('stores-changed'));
  } catch (e: any) { ElMessage.error(e.message || '删除失败'); }
  finally { saving.value = false; }
}

const firstStoreName = computed(() => stores.value[0]?.name || '全部门店');
const prices = [['肩颈理疗·单次','理疗','¥298','¥198','60分钟',1],['精油SPA·90分钟','SPA','¥498','¥358','90分钟',1],['艾灸养生·疗程','艾灸','¥1,280','¥980','10次',1],['面部护理·单次','美容','¥368','¥258','70分钟',1],['拔罐刮痧·单次','理疗','¥188','¥128','45分钟',0]];
</script>
