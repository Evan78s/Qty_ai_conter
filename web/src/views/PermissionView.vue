<template>
  <div>
    <div class="page-head"><div><div class="page-title">权限管理</div><div class="page-desc">多店连锁 · 角色与门店数据权限精细化管控</div></div><el-button type="primary" @click="userDialog=true"><el-icon><Plus /></el-icon>新增用户</el-button></div>
    <div class="grid g4"><div v-for="k in kpis" :key="k.lb" class="card kpi"><div class="top"><span class="lb">{{k.lb}}</span><span class="ic">🔐</span></div><div class="val num">{{k.v}}</div></div></div>
    <el-tabs v-model="tab" style="margin-top:16px">
      <el-tab-pane label="用户管理" name="users"><div class="card" style="margin-top:14px"><div class="card-h"><h3>用户列表</h3></div><div class="card-b" style="padding:0">
        <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['姓名','账号','角色','可访问门店','状态','操作']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
          <tr v-for="u in users" :key="u[1]"><td v-for="(c,i) in u" :key="i" style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span v-if="i===2" class="tag" :class="c==='总管理员'?'r':c==='店长'?'g':c==='员工'?'y':'gray'">{{c}}</span><span v-else-if="i===4" class="tag g">{{c}}</span><span v-else>{{c}}</span></td><td style="padding:11px 12px;border-bottom:1px solid var(--line2)"><el-button size="small" text @click="ElMessage.success('编辑用户（演示）')">编辑</el-button></td></tr>
        </tbody></table>
      </div></div></el-tab-pane>
      <el-tab-pane label="角色权限矩阵" name="matrix"><div class="card" style="margin-top:14px"><div class="card-h"><h3>RBAC 权限矩阵</h3><span class="page-desc">V查看 E编辑 A审批 X导出</span></div><div class="card-b" style="padding:0;overflow-x:auto">
        <table style="width:100%;min-width:680px;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left;padding:11px 12px;background:#FAFBF9">功能板块</th><th v-for="h in ['总管理员','店长','员工','只读审计']" :key="h" style="text-align:center;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
          <tr v-for="r in matrix" :key="r[0]"><td style="padding:11px 12px;border-bottom:1px solid var(--line2);font-weight:600">{{r[0]}}</td><td v-for="(v,i) in r[1]" :key="i" style="text-align:center;padding:11px 12px;border-bottom:1px solid var(--line2)"><span class="tag" :class="v?'g':'gray'" style="cursor:pointer" @click="ElMessage.success('权限已更新（演示）')">{{v||'—'}}</span></td></tr>
        </tbody></table>
      </div></div></el-tab-pane>
      <el-tab-pane label="门店管理" name="stores"><div class="card" style="margin-top:14px"><div class="card-h"><h3>门店管理（管理员可自助添加）</h3><el-button size="small" @click="ElMessage.success('添加门店（演示）')">添加门店</el-button></div><div class="card-b" style="padding:0">
        <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['门店','地址','店长','员工数','状态']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
          <tr v-for="s in storeRows" :key="s[0]"><td v-for="(c,i) in s" :key="i" style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span v-if="i===4" class="tag g">{{c}}</span><span v-else>{{c}}</span></td></tr>
        </tbody></table>
      </div></div></el-tab-pane>
      <el-tab-pane label="审计日志" name="audit"><div class="card" style="margin-top:14px"><div class="card-h"><h3>操作审计日志</h3><el-button size="small" @click="ElMessage.success('已导出审计日志')">导出</el-button></div><div class="card-b" style="padding:0">
        <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th v-for="h in ['时间','用户','门店','操作','模块','结果']" :key="h" style="text-align:left;padding:11px 12px;background:#FAFBF9">{{h}}</th></tr></thead><tbody>
          <tr v-for="a in audit" :key="a[0]"><td v-for="(c,i) in a" :key="i" style="padding:11px 12px;border-bottom:1px solid var(--line2)"><span v-if="i===5" class="chip up">{{c}}</span><span v-else>{{c}}</span></td></tr>
        </tbody></table>
      </div></div></el-tab-pane>
    </el-tabs>

    <el-dialog v-model="userDialog" title="新增用户" width="500px"><el-form label-position="top"><el-form-item label="姓名"><el-input placeholder="姓名"/></el-form-item><el-form-item label="账号"><el-input placeholder="手机号 / 账号"/></el-form-item><el-form-item label="角色"><el-select style="width:100%"><el-option label="总管理员" value="a"/><el-option label="店长" value="b"/><el-option label="员工" value="c"/><el-option label="只读审计" value="d"/></el-select></el-form-item><el-form-item label="可访问门店"><el-select multiple style="width:100%"><el-option label="鵲太醫·总店" value="s1"/><el-option label="鵲太醫·静安店" value="s2"/><el-option label="鵲太醫·浦东店" value="s3"/></el-select></el-form-item></el-form><template #footer><el-button @click="userDialog=false">取消</el-button><el-button type="primary" @click="userDialog=false;ElMessage.success('用户已创建')">创建用户</el-button></template></el-dialog>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
const tab=ref('users'); const userDialog=ref(false);
const kpis=[{lb:'用户总数',v:'12'},{lb:'角色数',v:'4'},{lb:'门店数',v:'3'},{lb:'本月操作日志',v:'248'}];
const users=[['林成安','admin','总管理员','全部门店','正常'],['张敏','zhangmin','店长','鵲太醫·总店','正常'],['李娜','lina','店长','鵲太醫·静安店','正常'],['王芳','wangfang','店长','鵲太醫·浦东店','正常'],['陈晓','chenxiao','员工','鵲太醫·总店','正常'],['审计员','auditor','只读审计','全部门店','正常']];
const matrix: Array<[string, string[]]>=[['总览驾驶舱',['V E A X','V E','V','V']],['店铺看板',['V E A X','V E','V','V']],['每日对账录入',['V E A','V E A','V E','—']],['投流看板/分析',['V E A X','V','—','V']],['AI 客服接待',['V E A','V E','V E','V']],['用户/门店/全局Key',['V E A','—','—','—']],['审计日志',['V','—','—','V']]];
const storeRows=[['鵲太醫·总店','静安区南京西路1266号','张敏','12','营业中'],['鵲太醫·静安店','静安区愚园路88号','李娜','9','营业中'],['鵲太醫·浦东店','浦东新区世纪大道200号','王芳','10','营业中']];
const audit=[['11-21 15:42','林成安','全部门店','修改 AI 场景绑定模型','AI 设置','成功'],['11-21 14:18','张敏','总店','确认每日对账并写入飞书','对账录入','成功'],['11-21 11:03','李娜','静安店','回复客户咨询','AI 客服','成功'],['11-20 18:30','林成安','全部门店','新增门店「浦东店」','权限管理','成功']];
</script>
