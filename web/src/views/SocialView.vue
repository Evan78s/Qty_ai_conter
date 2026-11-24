<template>
  <div>
    <div class="page-head"><div><div class="page-title">自媒体 AI 工作台</div><div class="page-desc">小红书优先 · 账号监控 / 内容发布 / 互动回复（数据保存本机）</div></div><el-button type="primary" @click="$router.push('/material')"><el-icon><Sparkles /></el-icon>创作内容</el-button></div>
    <el-tabs v-model="tab">
      <el-tab-pane label="账号监控" name="account">
        <div class="grid g4" style="margin-top:14px"><div v-for="k in kpis" :key="k.lb" class="card kpi"><div class="top"><span class="lb">{{k.lb}}</span><span class="ic">📱</span></div><div class="val num">{{k.v}}</div><div class="ft"><span class="chip flat">{{k.ch}}</span>当前</div></div></div>
        <div class="grid g2" style="margin-top:16px">
          <div class="card"><div class="card-h"><h3>账号概览</h3><el-button size="small" @click="openAccount">+ 添加账号</el-button></div><div class="card-b">
            <div v-for="a in accounts" :key="a.id" style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line2)"><div style="width:38px;height:38px;border-radius:9px;background:#FF2442;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">{{ (a.payload?.platform||'小红书').slice(0,2) }}</div><div style="flex:1"><div style="font-weight:600">{{a.title}}</div><div style="font-size:12px;color:var(--ink2)">{{a.payload?.note||''}}</div></div><div class="num" style="font-weight:700">{{a.payload?.followers||0}}</div><el-button size="small" text type="danger" @click="del('social_account',a)">删</el-button></div>
            <div v-if="!accounts.length" style="padding:20px;text-align:center;color:var(--ink2)">暂无账号，点「添加账号」录入。</div>
          </div></div>
          <div class="card"><div class="card-h"><h3>发布计划</h3><el-button size="small" @click="openPost">+ 新建计划</el-button></div><div class="card-b" style="padding:0">
            <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['日期','内容主题','平台','状态']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
              <tr v-for="p in posts" :key="p.id"><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{p.payload?.date}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{p.title}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag r">{{p.payload?.platform}}</span></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag g">{{p.status==='done'?'已发布':'计划中'}}</span></td></tr>
            </tbody></table>
            <div v-if="!posts.length" style="padding:20px;text-align:center;color:var(--ink2)">暂无发布计划。</div>
          </div></div>
        </div>
      </el-tab-pane>
      <el-tab-pane label="互动回复" name="reply">
        <div class="card" style="margin-top:14px"><div class="card-h"><h3>评论与私信回复</h3><el-button size="small" @click="openReply">+ 添加互动</el-button></div><div class="card-b" style="padding:0">
          <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['平台','用户','内容','建议回复','操作']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
            <tr v-for="r in replies" :key="r.id"><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag r">{{r.payload?.platform}}</span></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{r.payload?.user}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{r.payload?.content}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2);color:var(--green-d);background:var(--green-l);border-radius:6px">{{r.payload?.suggested||'—'}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><el-button type="primary" size="small" @click="sendReply(r)">发送</el-button> <el-button size="small" @click="aiSuggest(r)">AI建议</el-button> <el-button size="small" text type="danger" @click="del('social_reply',r)">删</el-button></td></tr>
          </tbody></table>
          <div v-if="!replies.length" style="padding:20px;text-align:center;color:var(--ink2)">暂无互动，点「添加互动」录入。</div>
        </div></div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="accountDialog" title="添加账号" width="440px"><el-form label-position="top"><el-form-item label="账号名称"><el-input v-model="accountForm.name"/></el-form-item><el-form-item label="平台"><el-select v-model="accountForm.platform" style="width:100%"><el-option label="小红书" value="小红书"/><el-option label="微信公众号" value="公众号"/><el-option label="抖音" value="抖音"/></el-select></el-form-item><el-form-item label="粉丝数"><el-input-number v-model="accountForm.followers" :min="0" style="width:100%"/></el-form-item><el-form-item label="备注"><el-input v-model="accountForm.note"/></el-form-item></el-form><template #footer><el-button @click="accountDialog=false">取消</el-button><el-button type="primary" @click="submitAccount">保存</el-button></template></el-dialog>
    <el-dialog v-model="postDialog" title="新建发布计划" width="440px"><el-form label-position="top"><el-form-item label="内容主题"><el-input v-model="postForm.title"/></el-form-item><el-form-item label="计划日期"><el-date-picker v-model="postForm.date" type="date" value-format="YYYY-MM-DD" style="width:100%"/></el-form-item><el-form-item label="平台"><el-select v-model="postForm.platform" style="width:100%"><el-option label="小红书" value="小红书"/><el-option label="公众号" value="公众号"/></el-select></el-form-item></el-form><template #footer><el-button @click="postDialog=false">取消</el-button><el-button type="primary" @click="submitPost">保存</el-button></template></el-dialog>
    <el-dialog v-model="replyDialog" title="添加互动" width="460px"><el-form label-position="top"><el-form-item label="平台"><el-select v-model="replyForm.platform" style="width:100%"><el-option label="小红书" value="小红书"/><el-option label="公众号" value="公众号"/></el-select></el-form-item><el-form-item label="用户"><el-input v-model="replyForm.user"/></el-form-item><el-form-item label="内容"><el-input v-model="replyForm.content" type="textarea" :rows="3"/></el-form-item></el-form><template #footer><el-button @click="replyDialog=false">取消</el-button><el-button type="primary" @click="submitReply">保存</el-button></template></el-dialog>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api';

const tab = ref('account');
const accounts = ref<any[]>([]); const posts = ref<any[]>([]); const replies = ref<any[]>([]);
const accountDialog = ref(false); const postDialog = ref(false); const replyDialog = ref(false);
const accountForm = ref<any>({ name: '', platform: '小红书', followers: 0, note: '' });
const postForm = ref<any>({ title: '', date: '', platform: '小红书' });
const replyForm = ref<any>({ platform: '小红书', user: '', content: '' });

const totalFollowers = computed(() => accounts.value.reduce((s, a) => s + (Number(a.payload?.followers) || 0), 0));
const kpis = computed(() => [
  { lb: '账号数', v: String(accounts.value.length), ch: '个' },
  { lb: '粉丝总数', v: totalFollowers.value.toLocaleString(), ch: '人' },
  { lb: '发布计划', v: String(posts.value.length), ch: '条' },
  { lb: '互动待回', v: String(replies.value.filter((r) => r.status !== 'done').length), ch: '条' },
]);

async function load() {
  try {
    const [a, p, r] = await Promise.all([api.bizList('social_account'), api.bizList('social_post'), api.bizList('social_reply')]);
    accounts.value = a; posts.value = p; replies.value = r;
  } catch (e: any) { ElMessage.error(e.message || '加载失败'); }
}
onMounted(load);

function openAccount() { accountForm.value = { name: '', platform: '小红书', followers: 0, note: '' }; accountDialog.value = true; }
async function submitAccount() {
  if (!accountForm.value.name) return ElMessage.warning('请填写账号名称');
  try { await api.bizCreate('social_account', { storeId: '', title: accountForm.value.name, payload: { ...accountForm.value } }); accountDialog.value = false; ElMessage.success('账号已添加'); await load(); }
  catch (e: any) { ElMessage.error(e.message || '保存失败'); }
}
function openPost() { postForm.value = { title: '', date: new Date().toISOString().slice(0, 10), platform: '小红书' }; postDialog.value = true; }
async function submitPost() {
  if (!postForm.value.title || !postForm.value.date) return ElMessage.warning('请填写主题和日期');
  try { await api.bizCreate('social_post', { storeId: '', title: postForm.value.title, payload: { ...postForm.value }, status: 'pending' }); postDialog.value = false; ElMessage.success('发布计划已保存'); await load(); }
  catch (e: any) { ElMessage.error(e.message || '保存失败'); }
}
function openReply() { replyForm.value = { platform: '小红书', user: '', content: '' }; replyDialog.value = true; }
async function submitReply() {
  if (!replyForm.value.user || !replyForm.value.content) return ElMessage.warning('请填写用户和内容');
  try { await api.bizCreate('social_reply', { storeId: '', title: replyForm.value.user, payload: { ...replyForm.value } }); replyDialog.value = false; ElMessage.success('互动已添加'); await load(); }
  catch (e: any) { ElMessage.error(e.message || '保存失败'); }
}
async function sendReply(r: any) {
  try { await api.bizUpdate('social_reply', r.id, { status: 'done' }); ElMessage.success('已标记为已回复'); await load(); }
  catch (e: any) { ElMessage.error(e.message || '操作失败'); }
}
async function aiSuggest(r: any) {
  try {
    const data = await api.aiChat({
      prompt: `用户评论：${r.payload?.content}。请给出一条简短、亲切、专业的中文回复建议（适合养生馆品牌）。`,
      system: '你是小红书运营，回复要真实自然、不夸大、不违规，50 字以内。',
      scene: 'social',
    });
    await api.bizUpdate('social_reply', r.id, { payload: { ...r.payload, suggested: data.content } });
    ElMessage.success('AI 建议已生成'); await load();
  } catch (e: any) {
    if ((e.message || '').includes('Key')) ElMessage.warning('请先到「AI 模型与密钥」配置 Key');
    else ElMessage.error(e.message || '生成失败');
  }
}
async function del(type: string, item: any) {
  try { await ElMessageBox.confirm('确定删除吗？', '删除', { type: 'warning' }); } catch { return; }
  try { await api.bizDelete(type, item.id); ElMessage.success('已删除'); await load(); }
  catch (e: any) { ElMessage.error(e.message || '删除失败'); }
}
</script>
