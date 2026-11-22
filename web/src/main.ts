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
app.use(router);
app.use(ElementPlus, { locale: zhCn });
// 先恢复登录态（refresh），再挂载，避免刷新后被误重定向到登录页
useAppStore(pinia).init().finally(() => app.mount('#app'));
