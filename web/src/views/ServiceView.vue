<template>
  <div>
    <div class="page-head"><div><div class="page-title">AI 客服接待管理</div><div class="page-desc">知识库维护 · AI 自动回复 · 人工接待协同 · 飞书群每日推送</div></div><el-button type="primary" @click="kbDialog=true"><el-icon><Plus /></el-icon>新增知识条目</el-button></div>
    <div class="grid g4">
      <div v-for="k in kpis" :key="k.lb" class="card kpi"><div class="top"><span class="lb">{{k.lb}}</span><span class="ic">🤖</span></div><div class="val num">{{k.v}}</div><div class="ft"><span class="chip" :class="k.up?'up':'down'">{{k.ch}}</span>较昨日</div></div>
    </div>
    <div style="margin-top:16px"><el-tabs v-model="tab">
      <el-tab-pane label="待人工接待" name="queue">
        <div class="card"><div class="card-h"><h3>待人工接待队列</h3><span class="tag r">{{QUEUE.length}} 条待处理</span></div><div class="card-b" style="padding:0">
          <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['客户','问题摘要','来源','AI置信度','等待时长','状态','操作']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
            <tr v-for="q in QUEUE" :key="q.name"><td style="padding:11px 12px;border-bottom:1px solid var(--line2);font-weight:600">{{q.name}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2);max-width:220px">{{q.q}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag gray">{{q.src}}</span></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="chip" :class="q.conf<60?'down':'flat'">{{q.conf}}%</span></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{q.wait}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag r">待接待</span></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><el-button type="primary" size="small" @click="reply(q)">回复</el-button></td></tr>
          </tbody></table>
        </div></div>
      </el-tab-pane>
      <el-tab-pane label="知识库" name="kb">
        <div class="card"><div class="card-h"><h3>知识库（存储于飞书表格，可在线编辑）</h3><el-button size="small" @click="ElMessage.success('已同步至飞书表格')">同步飞书</el-button></div><div class="card-b" style="padding:0">
          <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['标准问法','答案摘要','标签','命中次数','状态','操作']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
            <tr v-for="k in KB" :key="k.q"><td style="padding:11px 12px;border-bottom:1px solid var(--line2);font-weight:600">{{k.q}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2);color:var(--ink2)">{{k.a}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag g">{{k.tag}}</span></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)">{{k.hit}}</td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag" :class="k.on?'g':'gray'">{{k.on?'启用':'停用'}}</span></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><el-button size="small" text @click="kbDialog=true">编辑</el-button></td></tr>
          </tbody></table>
        </div></div>
      </el-tab-pane>
      <el-tab-pane label="AI 回复记录" name="replies">
        <div class="card"><div class="card-h"><h3>AI 回复记录</h3><span class="page-desc">写入飞书「AI 回复表」</span></div><div class="card-b" style="padding:0">
          <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['时间','客户','客户问题','AI 回复','结果']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
            <tr v-for="r in replies" :key="r[0]"><td v-for="(c,i) in r" :key="i" style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span v-if="i===4" class="tag" :class="c==='已解决'?'g':'y'">{{c}}</span><span v-else>{{c}}</span></td></tr>
          </tbody></table>
        </div></div>
      </el-tab-pane>
      <el-tab-pane label="飞书推送配置" name="push">
        <div class="grid g2"><div class="card"><div class="card-h"><h3>每日定时推送</h3><span class="tag g">已启用</span></div><div class="card-b">
          <el-form label-position="top"><el-form-item label="推送时间"><el-time-picker v-model="pushTime" format="HH:mm" style="width:100%"/></el-form-item><el-form-item label="推送内容"><el-select model-value="待人工接待信息汇总" style="width:100%"><el-option label="待人工接待信息汇总" value="a"/></el-select></el-form-item><el-form-item label="飞书群机器人 Webhook"><el-input model-value="https://open.feishu.cn/open-apis/bot/v2/hook/••••••"/></el-form-item><el-form-item label="目标飞书群"><el-input model-value="客服接待群 · 鵲太醫总部"/></el-form-item></el-form>
          <el-button type="primary" @click="ElMessage.success('推送配置已保存')">保存配置</el-button>
        </div></div>
        <div class="card"><div class="card-h"><h3>推送预览</h3><el-button size="small" @click="ElMessage.success('测试消息已发送到飞书群')">发送测试</el-button></div><div class="card-b">
          <div style="border:1px solid var(--line);border-radius:10px;overflow:hidden"><div style="background:var(--green);color:#fff;padding:10px 14px;font-weight:600;font-size:13px">🤖 客服接待日报 · 11/21</div><div style="padding:14px;font-size:12.5px;line-height:1.9;background:#FAFBF9">今日接待 <b>186</b> 次，AI 解决率 <b>82.4%</b><br>待人工接待 <b style="color:var(--up)">4</b> 条：<br><span style="padding-left:12px;color:var(--ink2)">· 林女士：肩颈理疗套餐咨询<br>· Anonymous：营业时间与英文服务<br>· 陈先生：会员卡转让问题<br>· Ms. Wang：周末双人预约</span></div></div>
        </div></div></div>
      </el-tab-pane>
    </el-tabs></div>

    <el-dialog v-model="kbDialog" title="新增知识条目" width="500px"><el-form label-position="top"><el-form-item label="标准问法"><el-input placeholder="客户最常问的问题"/></el-form-item><el-form-item label="答案"><el-input type="textarea" :rows="4" placeholder="标准答案内容"/></el-form-item><el-form-item label="标签"><el-select style="width:100%"><el-option label="门店信息" value="a"/><el-option label="价格套餐" value="b"/></el-select></el-form-item></el-form><template #footer><el-button @click="kbDialog=false">取消</el-button><el-button type="primary" @click="kbDialog=false;ElMessage.success('已保存并同步飞书')">保存并同步飞书</el-button></template></el-dialog>
    <el-dialog v-model="replyDialog" :title="'回复客户 · '+replyName" width="500px"><el-form label-position="top"><el-form-item label="客户问题"><el-input type="textarea" :rows="2" model-value="咨询详情，AI 置信度较低已转人工" readonly/></el-form-item><el-form-item label="输入回复"><el-input v-model="replyText" type="textarea" :rows="4" placeholder="输入人工回复内容…"/></el-form-item></el-form><template #footer><el-button @click="replyDialog=false">取消</el-button><el-button type="primary" @click="replyDialog=false;ElMessage.success('回复已发送并同步飞书')">发送回复</el-button></template></el-dialog>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { QUEUE, KB } from '../api/mock';
const tab=ref('queue'); const kbDialog=ref(false); const replyDialog=ref(false); const replyName=ref(''); const replyText=ref(''); const pushTime=ref(new Date(2026,10,21,9,0));
const kpis=[{lb:'今日接待量',v:'186',ch:'+9.2%',up:true},{lb:'AI 解决率',v:'82.4%',ch:'+3.1pp',up:true},{lb:'转人工率',v:'17.6%',ch:'-3.1pp',up:true},{lb:'平均响应',v:'12s',ch:'-4s',up:true}];
const replies=[['11-21 14:32','刘女士','你们有精油SPA吗？','有的，多种精油SPA套餐可预约～','已解决'],['11-21 13:58','赵先生','停车方便吗？','周边有停车场，消费享2小时免费停车','已解决'],['11-21 11:20','Amy','Do you accept credit card?','（置信度低，已转人工）','转人工'],['11-21 10:05','周女士','新客有优惠吗？','新客肩颈理疗体验价 ¥168','已解决']];
function reply(q:any){replyName.value=q.name;replyDialog.value=true;replyText.value='';}
</script>
