import * as echarts from 'echarts';
import { onMounted, onBeforeUnmount, ref, type Ref } from 'vue';

/** ECharts 容器绑定：响应式 + 自动销毁。 */
export function useChart(elRef: Ref<HTMLElement | null>, option: () => any) {
  let chart: echarts.ECharts | null = null;
  const render = () => {
    if (!elRef.value) return;
    if (!chart) chart = echarts.init(elRef.value);
    chart.setOption(option(), true);
  };
  const resize = () => chart?.resize();
  onMounted(() => { render(); window.addEventListener('resize', resize); });
  onBeforeUnmount(() => { window.removeEventListener('resize', resize); chart?.dispose(); chart = null; });
  return { render, resize };
}

export const axis = {
  axisLine: { lineStyle: { color: '#E7ECE8' } },
  axisTick: { show: false },
  axisLabel: { color: '#9AA8A2', fontSize: 11 },
  splitLine: { lineStyle: { color: '#F0F3F0' } },
};
