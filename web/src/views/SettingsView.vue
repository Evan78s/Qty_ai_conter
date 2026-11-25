<template>
  <div class="page-wrap">
    <div class="page-head">
      <div><h2>系统设置</h2><p class="sub">飞书授权、门店表格绑定、品牌与数据库</p></div>
    </div>

    <el-tabs v-model="tab" class="settings-tabs">
      <!-- 飞书授权 -->
      <el-tab-pane label="飞书授权" name="feishu">
        <div class="panel">
          <div class="panel-head">
            <div><h3>统一飞书凭证</h3><p class="hint">一把钥匙管所有表格。授权后全系统写入飞书都用它，各店再绑定各自的表格。</p></div>
            <el-button type="primary" size="small" @click="openCred()">+ 添加凭证</el-button>
          </div>
          <el-table :data="credentials" size="small" v-loading="loading">
            <el-table-column prop="appId" label="App ID" />
            <el-table-column prop="credentialsMasked" label="App Secret" />
            <el-table-column prop="scope" label="范围"><template #default="{ row }">{{ row.scope === 'platform' ? '公司默认' : '门店专用' }}</template></el-table-column>
            <el-table-column prop="status" label="状态"><template #default="{ row }"><el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">{{ row.status === 'active' ? '启用' : '停用' }}</el-tag></template></el-table-column>
            <el-table-column label="操作" width="140">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openCred(row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="delCred(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="help-box">
            <b>如何授权</b>
            <ol>
              <li>到飞书开放平台创建企业自建应用，拿到 App ID 和 App Secret</li>
              <li>开通「多维表格」相关权限（bitable:app）</li>
              <li>在这里填入凭证，并把应用添加为各店多维表格的协作者</li>
            </ol>
          </div>
        </div>
      </el-tab-pane>

      <!-- 门店绑定 -->
      <el-tab-pane label="门店表格绑定" name="binding">
        <div class="panel">
          <div class="panel-head">
            <div><h3>一店一表</h3><p class="hint">每个分店绑定一个飞书多维表格，该店所有业务数据存在这个表格的不同子表里。</p></div>
            <el-button type="primary" size="small" @click="openBinding()">+ 绑定门店</el-button>
          </div>
          <el-table :data="bindings" size="small" v-loading="loading">
            <el-table-column prop="storeName" label="门店" width="140" />
            <el-table-column prop="appToken" label="app_token" />
            <el-table-column label="子表" ><template #default="{ row }"><span class="tag-list"><el-tag v-for="(v,k) in row.tableIds" :key="k" size="small" type="info">{{ k }}</el-tag></span></template></el-table-column>
            <el-table-column prop="ownerName" label="授权人" width="100" />
            <el-table-column prop="status" label="状态" width="90"><template #default="{ row }"><el-tag size="small" :type="row.status === 'active' ? 'success' : 'warning'">{{ row.status === 'active' ? '正常' : '已断开' }}</el-tag></template></el-table-column>
            <el-table-column label="操作" width="140">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openBinding(row)">编辑</el-button>
                <el-button link size="small" @click="openBase(row)">打开表格</el-button>
                <el-button link type="danger" size="small" @click="delBinding(row)">解绑</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- 品牌 -->
      <el-tab-pane label="平台品牌" name="brand">
        <div class="panel narrow">
          <h3>平台标识</h3>
          <p class="hint">修改后所有端刷新即生效。</p>
          <el-form label-position="top" class="brand-form">
            <el-form-item label="平台名称"><el-input v-model="brandForm.platformName" /></el-form-item>
            <el-form-item label="Logo 文字"><el-input v-model="brandForm.logoText" maxlength="4" /></el-form-item>
            <el-form-item label="Logo 图片地址（可选）">
              <el-input v-model="brandForm.logoUrl" placeholder="/logo.ico 或 https://..." />
              <img v-if="brandForm.logoUrl" :src="brandForm.logoUrl" alt="logo 预览" style="width:40px;height:40px;object-fit:contain;background:#fff;border:1px solid var(--line,#e5e7eb);border-radius:8px;margin-top:8px;padding:2px" />
            </el-form-item>
            <el-form-item label="副标题"><el-input v-model="brandForm.subtitle" /></el-form-item>
            <el-button type="primary" :loading="saving" @click="saveBrand">保存</el-button>
          </el-form>
        </div>
      </el-tab-pane>

      <!-- 数据库 -->
      <el-tab-pane label="数据库" name="database">
        <div class="panel">
          <h3>数据库连接状态</h3>
          <div v-if="dbInfo" class="db-grid">
            <div><span>状态</span><b :class="dbInfo.reachable ? 'ok' : 'bad'">{{ dbInfo.reachable ? '● 已连接' : '● 未连接' }}</b></div>
            <div><span>地址</span><b>{{ dbInfo.config?.host }}:{{ dbInfo.config?.port }}</b></div>
            <div><span>库名</span><b>{{ dbInfo.config?.name }}</b></div>
            <div><span>用户</span><b>{{ dbInfo.config?.user }}</b></div>
            <div><span>数据表</span><b>{{ dbInfo.tableCount }} 张（系统表 {{ dbInfo.systemTables }}）</b></div>
          </div>
          <div class="table-list"><el-tag v-for="t in dbInfo?.tables || []" :key="t" size="small" type="info">{{ t }}</el-tag></div>
          <div class="help-box">
            <b>说明</b>
            <p>数据库连接信息在系统安装时配置，存于服务器 <code>data/install.json</code>。如需更换数据库，请修改该文件后重启服务，或在安装向导首次配置时填入。</p>
          </div>
        </div>
      </el-tab-pane>

      <!-- Meta 投流 -->
      <el-tab-pane label="Meta 投流" name="meta">
        <div class="panel">
          <h3>Meta 广告数据对接</h3>
          <p class="hint">配一次长期 Token，境外推广看板即可自动拉取 Meta 广告数据；不配也可用 CSV 导入。</p>
          <el-form label-position="top" style="max-width:620px">
            <el-form-item label="Access Token（长期令牌）">
              <el-input v-model="metaForm.accessToken" type="password" show-password :placeholder="metaInfo?.accessTokenMasked ? ('已配置 ' + metaInfo.accessTokenMasked + '，留空保持') : 'EAAxxxx…'" />
            </el-form-item>
            <div class="grid g2">
              <el-form-item label="广告账户 ID（URL 里 act= 后的数字）"><el-input v-model="metaForm.accountId" placeholder="2041926046723925" /></el-form-item>
              <el-form-item label="商务管理 ID（URL 里 business_id=）"><el-input v-model="metaForm.businessId" placeholder="944158525162622" /></el-form-item>
            </div>
            <div class="grid g2">
              <el-form-item label="美元→人民币汇率"><el-input-number v-model="metaForm.exchangeRate" :min="0.01" :step="0.01" :precision="4" style="width:100%" /></el-form-item>
              <el-form-item label="转化事件（可选，留空自动识别）"><el-input v-model="metaForm.conversionAction" placeholder="purchase / lead / …" /></el-form-item>
            </div>
          </el-form>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <el-button type="primary" :loading="metaSaving" @click="saveMeta">保存配置</el-button>
            <el-button :loading="metaTesting" :disabled="!metaInfo?.configured" @click="testMeta">测试连接</el-button>
            <el-tag v-if="metaInfo?.configured" type="success" size="small">已配置</el-tag>
            <el-tag v-else type="warning" size="small">未配置</el-tag>
          </div>
          <div v-if="metaTestResult" class="help-box">连接正常：{{ metaTestResult.name }} · 币种 {{ metaTestResult.currency }} · 状态 {{ metaTestResult.accountStatus }}</div>
          <div class="help-box">
            <b>怎么拿到这三项</b>
            <ol>
              <li>打开 <code>business.facebook.com</code> → 商务设置 → 应用，创建或选一个应用。</li>
              <li>在系统用户里生成令牌，权限勾选 <code>ads_read</code>，复制长期 Access Token。</li>
              <li>把广告账户（ID 见上方 URL 的 <code>act=</code>）授权给该系统用户，权限 <code>查看/读取</code>。</li>
              <li>回到本页填入 Token、广告账户 ID、商务 ID，点保存，再点测试连接。</li>
            </ol>
            <p>Token 加密存在服务器，不会下发到浏览器；汇率用于把美元花费换算成看板显示的人民币。</p>
          </div>
        </div>
      </el-tab-pane>

      <!-- 系统升级 -->
      <el-tab-pane label="系统升级" name="upgrade">
        <div class="panel narrow">
          <h3>在线升级</h3>
          <p class="hint">从 GitHub 拉取最新版本并自动重建、重启，数据不会丢失。升级期间服务会短暂中断约 1 分钟，请在空闲时操作。</p>

          <div v-if="!upgradeInfo?.upgradeAvailable" class="help-box" style="border-color:#e6a23c">
            <b>当前部署方式不支持在线升级</b>
            <p>在线升级需要在首次部署时安装升级组件。请在服务器执行升级命令（见文档），或重新运行部署脚本安装升级组件后即可在此一键升级。</p>
          </div>

          <template v-else>
            <div class="upgrade-grid">
              <div><span>当前版本</span><b>{{ upgradeInfo?.version || '—' }}</b></div>
              <div><span>本地提交</span><b>{{ upgradeInfo?.commit || '—' }}</b></div>
              <div><span>远程最新</span><b>{{ upgradeInfo?.remoteCommit || '检测失败' }}</b></div>
              <div><span>组件状态</span><b :class="upgradeInfo?.hasUpdate ? 'warn' : 'ok'">{{ upgradeInfo?.hasUpdate ? '● 有新版本' : (upgradeInfo?.hasUpdate === false ? '● 已是最新' : '—') }}</b></div>
            </div>

            <div v-if="upgradeInfo && upgradeInfo.state !== 'idle'" class="upgrade-progress" :class="upgradeInfo.state">
              <p><b>{{ upgradeInfo.state === 'running' ? '升级进行中' : (upgradeInfo.state === 'success' ? '升级完成' : '升级失败') }}</b> · {{ upgradeInfo.stage }} · {{ upgradeInfo.message }}</p>
              <el-progress v-if="upgradeInfo.state === 'running'" :percentage="upgradeStagePercent(upgradeInfo.stage)" :stroke-width="8" />
            </div>

            <div style="display:flex;gap:8px;margin:16px 0;flex-wrap:wrap">
              <el-button size="small" :loading="upgrading" @click="refreshUpgrade">刷新状态</el-button>
              <el-button size="small" @click="openUpgradeLog">查看日志</el-button>
              <el-button v-if="app.isSuper" type="primary" size="small" :disabled="upgradeInfo?.state === 'running'" :loading="upgrading" @click="doUpgrade">
                {{ upgradeInfo?.hasUpdate ? '一键升级到最新版' : '重新拉取并升级' }}
              </el-button>
            </div>

            <div v-if="upgradeInfo?.state === 'success'" class="help-box" style="border-color:#67c23a">
              <b>升级成功</b>
              <p>请按 Ctrl+F5 强制刷新浏览器以加载新版前端。若页面异常，请先清浏览器缓存。</p>
            </div>
            <div v-if="upgradeInfo?.state === 'error'" class="help-box" style="border-color:#f56c6c">
              <b>升级未完成</b>
              <p>{{ upgradeInfo.message }}。点「查看日志」了解详情，或按文档用命令行升级。</p>
            </div>
          </template>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 飞书凭证弹窗 -->
    <el-dialog v-model="credDialog" :title="credForm.id ? '编辑飞书凭证' : '添加飞书凭证'" width="480px">
      <el-form label-position="top">
        <el-form-item label="App ID"><el-input v-model="credForm.appId" placeholder="cli_xxx" /></el-form-item>
        <el-form-item label="App Secret"><el-input v-model="credForm.appSecret" type="password" show-password placeholder="不填则保持原值" /></el-form-item>
        <el-form-item label="范围"><el-select v-model="credForm.scope" style="width:100%"><el-option label="公司默认" value="platform" /><el-option label="门店专用" value="tenant" /></el-select></el-form-item>
      </el-form>
      <template #footer><el-button @click="credDialog = false">取消</el-button><el-button type="primary" :loading="saving" @click="saveCred">保存</el-button></template>
    </el-dialog>

    <!-- 门店绑定弹窗 -->
    <el-dialog v-model="bindDialog" :title="bindForm.id ? '编辑门店绑定' : '绑定门店表格'" width="560px">
      <el-form label-position="top">
        <el-form-item label="门店"><el-select v-model="bindForm.storeId" style="width:100%" :disabled="!!bindForm.id" @change="loadLedgerTables"><el-option v-for="s in storeList" :key="s.id" :label="s.name" :value="s.id" /></el-select></el-form-item>
        <el-form-item label="多维表格 app_token"><el-input v-model="bindForm.appToken" placeholder="bascnxxx" /></el-form-item>
        <el-form-item label="表格链接（可选，便于跳转）"><el-input v-model="bindForm.baseUrl" placeholder="https://xxx.feishu.cn/base/..." /></el-form-item>
        <el-form-item label="使用凭证"><el-select v-model="bindForm.credentialId" style="width:100%" clearable placeholder="公司默认"><el-option v-for="c in credentials" :key="c.id" :label="c.appId" :value="c.id" /></el-select></el-form-item>
        <el-form-item label="对账子表（门店每日台账）">
          <el-select v-model="bindForm.tableIds.ledger" style="width:100%" clearable filterable :loading="loadingLedger" @focus="loadLedgerTables" placeholder="默认自动匹配「门店每日台账」">
            <el-option v-for="t in ledgerTables" :key="t.tableId" :label="t.name" :value="t.tableId" />
          </el-select>
          <div class="mini-note">留空时系统自动匹配名为「门店每日台账」的子表；每日对账的读取与写回都走这里。</div>
        </el-form-item>
        <el-divider content-position="left">其它子表 table_id</el-divider>
        <div class="grid2">
          <el-form-item v-for="k in tableKeys" :key="k" :label="tableLabel(k)"><el-input v-model="bindForm.tableIds[k]" size="small" placeholder="tblxxx" /></el-form-item>
        </div>
      </el-form>
      <template #footer><el-button @click="bindDialog = false">取消</el-button><el-button type="primary" :loading="saving" @click="saveBinding">保存绑定</el-button></template>
    </el-dialog>

    <!-- 升级日志弹窗 -->
    <el-dialog v-model="logDialog" title="升级日志" width="720px">
      <pre class="upgrade-log">{{ upgradeLog }}</pre>
      <template #footer><el-button @click="logDialog = false">关闭</el-button><el-button size="small" @click="loadUpgradeLog">刷新</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';
import { useAppStore } from '../stores/app';
const app = useAppStore();

const tab = ref('feishu');
const loading = ref(false);
const saving = ref(false);
const credentials = ref<any[]>([]);
const bindings = ref<any[]>([]);
const storeList = ref<any[]>([]);
const brandForm = reactive<any>({ platformName: '', logoUrl: '', logoText: '', subtitle: '' });
const dbInfo = ref<any>(null);
const metaForm = reactive<any>({ accessToken: '', accountId: '', businessId: '', exchangeRate: 7.2, conversionAction: '' });
const metaInfo = ref<any>(null);
const metaSaving = ref(false); const metaTesting = ref(false); const metaTestResult = ref<any>(null);

const tableKeys = ['performance', 'dsp', 'kb', 'replies', 'queue', 'social', 'materials', 'push'];
const tableLabel = (k: string) => ({ performance: '每日业绩', dsp: '投流洞察', kb: '客服知识库', replies: 'AI回复', queue: '待人工接待', social: '自媒体', materials: '素材', push: '推送配置' } as any)[k] || k;

async function load() {
  loading.value = true;
  try {
    const [c, b, s, br, d, m] = await Promise.all([
      api.feishuCredentials(), api.bindings(), api.settingStores(), api.brand(), api.dbStatus(), api.metaConfig(),
    ]);
    credentials.value = c; bindings.value = b; storeList.value = s;
    Object.assign(brandForm, br);
    dbInfo.value = d;
    metaInfo.value = m;
    Object.assign(metaForm, {
      accountId: m?.accountId || '', businessId: m?.businessId || '',
      exchangeRate: m?.exchangeRate || 7.2, conversionAction: m?.conversionAction || '',
    });
  } catch (e: any) { ElMessage.error(e.message || '加载失败'); }
  finally { loading.value = false; }
}
onMounted(load);

/* Meta 投流配置 */
async function saveMeta() {
  metaSaving.value = true;
  try {
    metaInfo.value = await api.saveMetaConfig({ ...metaForm });
    metaForm.accessToken = '';
    metaTestResult.value = null;
    ElMessage.success('Meta 配置已保存');
  } catch (e: any) { ElMessage.error(e.message || '保存失败'); }
  finally { metaSaving.value = false; }
}
async function testMeta() {
  metaTesting.value = true;
  try {
    metaTestResult.value = await api.metaTest();
    ElMessage.success('Meta 连接正常');
  } catch (e: any) { metaTestResult.value = null; ElMessage.error(e.message || '连接失败'); }
  finally { metaTesting.value = false; }
}

/* 凭证 */
const credDialog = ref(false);
const credForm = reactive<any>({ id: '', appId: '', appSecret: '', scope: 'platform' });
function openCred(row?: any) {
  Object.assign(credForm, row ? { id: row.id, appId: row.appId, appSecret: '', scope: row.scope } : { id: '', appId: '', appSecret: '', scope: 'platform' });
  credDialog.value = true;
}
async function saveCred() {
  saving.value = true;
  try { await api.saveFeishuCredential(credForm); ElMessage.success('已保存'); credDialog.value = false; await load(); }
  catch (e: any) { ElMessage.error(e.message || '保存失败'); }
  finally { saving.value = false; }
}
async function delCred(row: any) {
  await ElMessageBox.confirm(`删除凭证 ${row.appId}？`, '确认', { type: 'warning' });
  try { await api.deleteCredential(row.id); ElMessage.success('已删除'); await load(); }
  catch (e: any) { ElMessage.error(e.message || '删除失败'); }
}

/* 绑定 */
const bindDialog = ref(false);
const bindForm = reactive<any>({ id: '', storeId: '', appToken: '', baseUrl: '', credentialId: '', tableIds: {} });
const ledgerTables = ref<{ tableId: string; name: string }[]>([]);
const loadingLedger = ref(false);
async function loadLedgerTables() {
  if (!bindForm.storeId || loadingLedger.value) return;
  loadingLedger.value = true;
  try {
    const data = await api.reconcileTables(bindForm.storeId);
    ledgerTables.value = data.tables || [];
    if (!bindForm.tableIds.ledger && data.suggestedId) bindForm.tableIds.ledger = data.suggestedId;
  } catch { ledgerTables.value = []; }
  finally { loadingLedger.value = false; }
}
function openBinding(row?: any) {
  if (row) Object.assign(bindForm, { id: row.id, storeId: row.storeId, appToken: row.appToken, baseUrl: row.baseUrl, credentialId: row.credentialId, tableIds: { ...row.tableIds } });
  else Object.assign(bindForm, { id: '', storeId: '', appToken: '', baseUrl: '', credentialId: '', tableIds: {} });
  ledgerTables.value = [];
  bindDialog.value = true;
  if (bindForm.storeId) loadLedgerTables();
}
async function saveBinding() {
  saving.value = true;
  try { await api.saveBinding(bindForm); ElMessage.success('绑定已保存'); bindDialog.value = false; await load(); }
  catch (e: any) { ElMessage.error(e.message || '保存失败'); }
  finally { saving.value = false; }
}
async function delBinding(row: any) {
  await ElMessageBox.confirm(`解绑 ${row.storeName} 的表格？数据仍保留在飞书。`, '确认', { type: 'warning' });
  try { await api.deleteBinding(row.id); ElMessage.success('已解绑'); await load(); }
  catch (e: any) { ElMessage.error(e.message || '解绑失败'); }
}
function openBase(row: any) { if (row.baseUrl) window.open(row.baseUrl, '_blank'); else ElMessage.warning('未填写表格链接'); }

/* 品牌 */
async function saveBrand() {
  saving.value = true;
  try { await api.saveBrand(brandForm); ElMessage.success('品牌设置已保存'); }
  catch (e: any) { ElMessage.error(e.message || '保存失败'); }
  finally { saving.value = false; }
}

/* 系统升级 */
const upgradeInfo = ref<any>(null);
const upgrading = ref(false);
const logDialog = ref(false);
const upgradeLog = ref('');
let upgradeTimer: any = null;
const stageMap: Record<string, number> = { '准备': 5, '启动': 8, '拉取代码': 20, '构建前端': 45, '构建后端': 70, '发布前端': 88, '重启服务': 96, '完成': 100 };
function upgradeStagePercent(stage: string) { return stageMap[stage] || (stage ? 50 : 10); }

async function refreshUpgrade(silent = false) {
  try { upgradeInfo.value = await api.upgradeStatus(); }
  catch (e: any) { if (!silent) ElMessage.error(e.message || '状态获取失败'); }
}

async function doUpgrade() {
  await ElMessageBox.confirm(
    '将从 GitHub 拉取最新版本并重建系统，期间服务中断约 1 分钟、数据不会丢失。确定继续？',
    '一键升级', { type: 'warning', confirmButtonText: '开始升级', cancelButtonText: '取消' },
  );
  upgrading.value = true;
  try {
    await api.upgradeTrigger();
    ElMessage.success('升级已启动，正在跟踪进度…');
    upgradeInfo.value = { ...(upgradeInfo.value || {}), state: 'running', stage: '启动', message: '升级任务已启动…' };
    startPolling();
  } catch (e: any) { ElMessage.error(e.message || '无法启动升级'); }
  finally { upgrading.value = false; }
}

function startPolling() {
  stopPolling();
  upgradeTimer = setInterval(async () => {
    try {
      const s = await api.upgradeStatus();
      upgradeInfo.value = s;
      if (s.state === 'success') {
        stopPolling();
        ElMessage.success('升级完成，请按 Ctrl+F5 刷新页面');
      } else if (s.state === 'error') {
        stopPolling();
        ElMessage.error('升级失败，请查看日志');
      }
    } catch { /* 升级时服务会短暂中断，忽略轮询失败，下轮继续 */ }
  }, 3000);
}
function stopPolling() { if (upgradeTimer) { clearInterval(upgradeTimer); upgradeTimer = null; } }

async function openUpgradeLog() { await loadUpgradeLog(); logDialog.value = true; }
async function loadUpgradeLog() {
  try { upgradeLog.value = (await api.upgradeLog()).log || ''; }
  catch (e: any) { upgradeLog.value = '日志获取失败：' + (e.message || ''); }
}

// 进入页面时加载状态；若后台正在升级则自动续上轮询
onMounted(async () => { await refreshUpgrade(true); if (upgradeInfo.value?.state === 'running') startPolling(); });
onUnmounted(stopPolling);
</script>
<style scoped>
.upgrade-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0 18px}
.upgrade-grid>div{background:var(--panel2,#F7F9F7);border:1px solid var(--line2,#e8ece9);border-radius:10px;padding:11px 13px;display:flex;flex-direction:column;gap:4px}
.upgrade-grid span{font-size:12px;color:var(--ink2,#6B7B74)}
.upgrade-grid b{font-size:14px;color:var(--ink,#1F2A26)}
.upgrade-grid b.ok{color:#1D9E75}.upgrade-grid b.warn{color:#c98a1e}
.upgrade-progress{padding:12px 14px;border-radius:10px;background:#F4F9F7;border:1px solid #cfe6dc;margin-bottom:6px}
.upgrade-progress p{margin:0 0 10px;font-size:13px;color:var(--ink,#1F2A26)}
.upgrade-progress.error{background:#FDF3F0;border-color:#f0c4b8}
.upgrade-log{background:#1F2A26;color:#D6E4DE;padding:14px;border-radius:8px;font-size:12px;line-height:1.6;max-height:440px;overflow:auto;white-space:pre-wrap;word-break:break-all;margin:0}
</style>
