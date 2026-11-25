import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import App from './App.vue';
import router from './router';
import { useAppStore } from './stores/app';
import './styles.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(ElementPlus, { locale: zhCn });
// 关键：必须先恢复登录态，再安装路由。
// Vue Router 4 在 app.use(router) 时就会触发「初始导航」，路由守卫会读取 app.user。
// 若此时 init() 尚未完成、user 仍为 null，守卫会立即把页面重定向到 /login，
// 之后即使 refresh 成功、user 已恢复，页面也已经停在登录页——这就是刷新跳登录的根因。
useAppStore(pinia).init().finally(() => {
  app.use(router);
  app.mount('#app');
});
