<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="680px"
    class="ai-chat-dialog"
    @update:model-value="$emit('update:modelValue', $event)"
    @opened="scrollBottom"
  >
    <template #header>
      <div class="chat-head">
        <div>
          <div class="chat-title">{{ title }}</div>
          <div class="chat-sub">接入系统全局默认模型 · 密钥由后端代理，不暴露到浏览器</div>
        </div>
        <span class="model-tag">{{ modelLabel || '系统全局默认模型' }}</span>
      </div>
    </template>

    <div ref="bodyRef" class="chat-body">
      <div v-if="!messages.length" class="chat-empty">
        <div class="empty-icon">✦</div>
        <div class="empty-title">有什么可以帮你？</div>
        <div class="empty-desc">写文案、想选题、改回复，直接问就行。</div>
        <div class="quick-list">
          <button v-for="q in quickPrompts" :key="q" class="quick" @click="input = q">{{ q }}</button>
        </div>
      </div>

      <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
        <div class="avatar">{{ m.role === 'user' ? '我' : 'AI' }}</div>
        <div class="bubble">
          <div class="role">{{ m.role === 'user' ? '你' : 'AI 助手' }}</div>
          <div class="content">{{ m.content }}</div>
        </div>
      </div>
      <div v-if="sending" class="msg assistant">
        <div class="avatar">AI</div>
        <div class="bubble"><div class="typing">正在思考…</div></div>
      </div>
    </div>

    <div class="chat-input">
      <el-input
        v-model="input"
        type="textarea"
        :rows="2"
        :disabled="sending"
        resize="none"
        :placeholder="placeholder"
        @keydown.enter.exact.prevent="send"
      />
      <div class="input-actions">
        <span class="tip">Enter 发送 · Shift + Enter 换行</span>
        <el-button size="small" :disabled="sending || !messages.length" @click="clear">清空记录</el-button>
        <el-button size="small" type="primary" :loading="sending" :disabled="!input.trim()" @click="send">发送</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../api';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  title?: string;
  system?: string;
  placeholder?: string;
}>(), {
  title: 'AI 助手',
  system: '你是养生馆连锁品牌的自媒体运营助手，输出专业、简洁、可直接使用的中文内容。',
  placeholder: '例如：帮我写一条新店开业的小红书笔记…',
});
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

interface Msg { role: 'user' | 'assistant'; content: string }
const messages = ref<Msg[]>([]);
const input = ref('');
const sending = ref(false);
const modelLabel = ref('');
const bodyRef = ref<HTMLElement | null>(null);
const quickPrompts = [
  '帮我写一条小红书种草笔记',
  '给这条评论写 3 条回复',
  '给我 5 个本周选题',
];

function scrollBottom() {
  nextTick(() => { if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight; });
}

function clear() {
  messages.value = [];
  modelLabel.value = '';
  scrollBottom();
}

async function send() {
  const text = input.value.trim();
  if (!text || sending.value) return;
  input.value = '';
  messages.value.push({ role: 'user', content: text });
  sending.value = true;
  scrollBottom();
  try {
    // 不传 scene，也不传个人 Key：强制走系统全局默认模型。
    const data = await api.aiChat({
      messages: messages.value.map((m) => ({ role: m.role, content: m.content })),
      system: props.system,
      preferGlobal: true,
    });
    if (data?.model) modelLabel.value = data.model;
    messages.value.push({ role: 'assistant', content: data?.content || '（模型未返回内容）' });
  } catch (e: any) {
    const msg = e?.message || '请求失败';
    messages.value.push({ role: 'assistant', content: `⚠️ ${msg}` });
    if (String(msg).includes('Key')) ElMessage.warning('请先到「AI 模型与密钥」页配置全局 Key');
  } finally {
    sending.value = false;
    scrollBottom();
  }
}
</script>

<style scoped>
.chat-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.chat-title { font-size: 17px; font-weight: 700; color: var(--ink); }
.chat-sub { font-size: 12px; color: var(--ink2); margin-top: 3px; }
.model-tag { font-size: 12px; padding: 4px 10px; border-radius: 20px; color: var(--green-d); background: var(--green-l); white-space: nowrap; }
.chat-body { height: 420px; overflow-y: auto; padding: 8px 4px 4px; }
.chat-empty { text-align: center; padding: 42px 12px; color: var(--ink2); }
.empty-icon { font-size: 38px; color: var(--green-d); }
.empty-title { font-size: 16px; font-weight: 700; color: var(--ink); margin-top: 8px; }
.empty-desc { font-size: 13px; margin-top: 4px; }
.quick-list { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 20px; }
.quick { border: 1px solid var(--line2); background: transparent; color: var(--ink2); border-radius: 18px; padding: 7px 13px; font-size: 12px; cursor: pointer; }
.quick:hover { border-color: var(--green-d); color: var(--green-d); }
.msg { display: flex; gap: 10px; margin: 12px 0; align-items: flex-start; }
.msg.user { flex-direction: row-reverse; }
.avatar { width: 30px; height: 30px; flex: 0 0 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; background: var(--green-d); }
.msg.user .avatar { background: #8a94a6; }
.bubble { max-width: 78%; background: var(--green-l); border: 1px solid var(--line2); border-radius: 10px; padding: 9px 12px; }
.msg.user .bubble { background: #f2f4f7; }
.role { font-size: 11px; color: var(--ink2); margin-bottom: 4px; }
.content { font-size: 13px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; color: var(--ink); }
.typing { font-size: 13px; color: var(--ink2); }
.chat-input { border-top: 1px solid var(--line2); padding-top: 12px; }
.input-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 8px; }
.tip { margin-right: auto; font-size: 11px; color: var(--ink2); }
</style>
