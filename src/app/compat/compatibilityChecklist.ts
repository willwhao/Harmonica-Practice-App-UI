export interface CompatibilityChecklistItem {
  id: string;
  label: string;
  status: 'implemented' | 'partial' | 'planned';
  detail: string;
}

export function getCompatibilityChecklist(): CompatibilityChecklistItem[] {
  return [
    {
      id: 'mobile-viewport',
      label: '移动端视口适配',
      status: 'implemented',
      detail: '使用 100dvh/100svh、窄屏全屏布局和桌面手机外框，覆盖移动端与桌面预览。',
    },
    {
      id: 'keyboard-focus',
      label: '键盘焦点可见',
      status: 'implemented',
      detail: '按钮、输入、选择框和可聚焦元素提供 focus-visible 高亮。',
    },
    {
      id: 'reduced-motion',
      label: '减少动画偏好',
      status: 'implemented',
      detail: '遵守 prefers-reduced-motion，减少过渡和动画时间。',
    },
    {
      id: 'screen-reader-status',
      label: '屏幕阅读器状态播报',
      status: 'partial',
      detail: '练习页提供当前目标音、孔位、吹吸和判定状态；复杂谱面仍需更多语义分组。',
    },
    {
      id: 'browser-e2e',
      label: '跨浏览器移动端 E2E',
      status: 'partial',
      detail: '已覆盖 Chrome 与 Edge 移动视口；Safari、Firefox 和真机麦克风仍需专门测试。',
    },
  ];
}

export function summarizeCompatibilityReadiness(items = getCompatibilityChecklist()) {
  return {
    total: items.length,
    implemented: items.filter((item) => item.status === 'implemented').length,
    partial: items.filter((item) => item.status === 'partial').length,
    planned: items.filter((item) => item.status === 'planned').length,
  };
}
