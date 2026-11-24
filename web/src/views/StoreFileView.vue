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
            📍 {{ s.address || '—' }}<br>👤 店长：{{ s.managerName || '—' }}<br>👥 员工：{{ s.staffCount }} 人
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
      <div class="card-h"><h3>项目价目表 · {{ firstStoreName }}</h3><el-button v-if="canEdit" size="small" @click="openPrice('')"><el-icon><Plus /></el-icon>新增项目</el-button></div>
      <div class="card-b" style="padding:0">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr><th v-for="h in ['项目名称','类别','售价','耗卡价','时长','状态','操作']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead>
          <tbody>
            <tr v-for="p in prices" :key="p.id">
              <td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{p.title}}</td>
              <td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{p.payload?.category}}</td>
              <td style="padding:11px 12px;border-bottom:1px solid var(--line2)">¥{{p.payload?.price}}</td>
              <td style="padding:11px 12px;border-bottom:1px solid var(--line2)">¥{{p.payload?.cardPrice}}</td>
              <td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{p.payload?.duration}}</td>
              <td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag" :class="p.status==='active'?'g':'gray'">{{p.status==='active'?'在售':'下架'}}</span></td>
              <td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><el-button size="small" text @click="openPrice(p)">编辑</el-button><el-button size="small" text type="danger" @click="removePrice(p)">删除</el-button></td>
            </tr>
          </tbody>
        </table>
        <div v-if="!prices.length" style="padding:24px;text-align:center;color:var(--ink2)">暂无价目项目，点「新增项目」添加。</div>
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

    <!-- 新增/编辑价目项目弹窗 -->
    <el-dialog v-model="priceDialog" :title="editingPrice ? '编辑项目' : '新增项目'" width="460px">
      <el-form label-position="top" :model="priceForm">
        <el-form-item label="项目名称"><el-input v-model="priceForm.name" placeholder="如：肩颈理疗·单次" /></el-form-item>
        <el-form-item label="类别"><el-select v-model="priceForm.category" style="width:100%"><el-option label="理疗" value="理疗"/><el-option label="SPA" value="SPA"/><el-option label="艾灸" value="艾灸"/><el-option label="美容" value="美容"/><el-option label="其他" value="其他"/></el-select></el-form-item>
        <div class="grid g2">
          <el-form-item label="售价(¥)"><el-input-number v-model="priceForm.price" :min="0" style="width:100%"/></el-form-item>
          <el-form-item label="耗卡价(¥)"><el-input-number v-model="priceForm.cardPrice" :min="0" style="width:100%"/></el-form-item>
        </div>
        <el-form-item label="时长"><el-input v-model="priceForm.duration" placeholder="如：60分钟 / 10次"/></el-form-item>
        <el-form-item label="状态"><el-select v-model="priceForm.status" style="width:100%"><el-option label="在售" value="active"/><el-option label="下架" value="disabled"/></el-select></el-form-item>
      </el-form>
      <template #footer><el-button @click="priceDialog=false">取消</el-button><el-button type="primary" :loading="saving" @click="submitPrice">保存</el-button></template>
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
const canEdit = computed(() => app.can('system', 2));
const stores = ref<any[]>([]);
const prices = ref<any[]>([]);
const dialog = ref(false); const editing = ref(false); const saving = ref(false);
const priceDialog = ref(false); const editingPrice = ref('');
const form = ref<any>({ id: '', name: '', address: '', managerName: '', staffCount: 0 });
const priceForm = ref<any>({ name: '', category: '理疗', price: 0, cardPrice: 0, duration: '', status: 'active' });
const firstStoreName = computed(() => app.stores.find((s: any) => s.id === app.currentStore)?.name || (stores.value[0]?.name || '公司'));

async function load() {
  try {
    const [s, p] = await Promise.all([api.get('/stores'), api.bizList('price')]);
    stores.value = Array.isArray(s) ? s : [];
    prices.value = p;
  } catch (e: any) { ElMessage.error(e.message || '加载失败'); }
}
onMounted(load);

function openCreate() { editing.value = false; form.value = { id: '', name: '', address: '', managerName: '', staffCount: 0 }; dialog.value = true; }
function openEdit(s: any) { editing.value = true; form.value = { id: s.id, name: s.name, address: s.address || '', managerName: s.managerName || '', staffCount: s.staffCount || 0 }; dialog.value = true; }
async function submit() {
  if (!form.value.name.trim()) return ElMessage.warning('请填写门店名称');
  saving.value = true;
  try {
    const { id, ...body } = form.value;
    if (editing.value) { await api.patch(`/stores/${id}`, body); ElMessage.success('门店信息已保存'); }
    else { await api.post('/stores', body); ElMessage.success('门店已创建'); }
    dialog.value = false; await load();
    window.dispatchEvent(new CustomEvent('stores-changed'));
  } catch (e: any) { ElMessage.error(e.message || '保存失败'); }
  finally { saving.value = false; }
}
async function removeStore(s: any) {
  try { await ElMessageBox.confirm(`确定删除门店「${s.name}」吗？此操作不可撤销。`, '删除门店', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }); } catch { return; }
  saving.value = true;
  try { await api.del(`/stores/${s.id}`); ElMessage.success('门店已删除'); await load(); window.dispatchEvent(new CustomEvent('stores-changed')); }
  catch (e: any) { ElMessage.error(e.message || '删除失败'); }
  finally { saving.value = false; }
}
function openPrice(p: any) {
  editingPrice.value = p?.id || '';
  priceForm.value = p ? { name: p.title, category: p.payload?.category || '理疗', price: p.payload?.price || 0, cardPrice: p.payload?.cardPrice || 0, duration: p.payload?.duration || '', status: p.status || 'active' } : { name: '', category: '理疗', price: 0, cardPrice: 0, duration: '', status: 'active' };
  priceDialog.value = true;
}
async function submitPrice() {
  if (!priceForm.value.name) return ElMessage.warning('请填写项目名称');
  saving.value = true;
  try {
    const body = { storeId: '', title: priceForm.value.name, payload: { category: priceForm.value.category, price: priceForm.value.price, cardPrice: priceForm.value.cardPrice, duration: priceForm.value.duration }, status: priceForm.value.status };
    if (editingPrice.value) await api.bizUpdate('price', editingPrice.value, body);
    else await api.bizCreate('price', body);
    priceDialog.value = false; ElMessage.success('项目已保存'); await load();
  } catch (e: any) { ElMessage.error(e.message || '保存失败'); }
  finally { saving.value = false; }
}
async function removePrice(p: any) {
  try { await ElMessageBox.confirm(`确定删除项目「${p.title}」吗？`, '删除', { type: 'warning' }); } catch { return; }
  try { await api.bizDelete('price', p.id); ElMessage.success('已删除'); await load(); }
  catch (e: any) { ElMessage.error(e.message || '删除失败'); }
}
</script>
