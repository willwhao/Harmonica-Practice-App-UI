export interface PerformanceBudget {
  maxInitialJsKb: number;
  maxInitialCssKb: number;
  maxAudioAnalysisMsPerFrame: number;
  maxStoredHistoryEntries: number;
}

export const PERFORMANCE_BUDGET: PerformanceBudget = {
  maxInitialJsKb: 470,
  maxInitialCssKb: 110,
  maxAudioAnalysisMsPerFrame: 12,
  maxStoredHistoryEntries: 20,
};

export interface BuildAsset {
  name: string;
  sizeKb: number;
  type: 'js' | 'css' | 'other';
}

export function evaluatePerformanceBudget(assets: BuildAsset[], budget = PERFORMANCE_BUDGET) {
  const jsKb = assets.filter((asset) => asset.type === 'js').reduce((total, asset) => total + asset.sizeKb, 0);
  const cssKb = assets.filter((asset) => asset.type === 'css').reduce((total, asset) => total + asset.sizeKb, 0);
  const violations: string[] = [];
  if (jsKb > budget.maxInitialJsKb) violations.push(`JS ${Math.round(jsKb)}KB 超过预算 ${budget.maxInitialJsKb}KB`);
  if (cssKb > budget.maxInitialCssKb) violations.push(`CSS ${Math.round(cssKb)}KB 超过预算 ${budget.maxInitialCssKb}KB`);
  return { passed: violations.length === 0, jsKb, cssKb, violations };
}

export function estimateAudioFrameCost({
  frameSize,
  sampleRate,
  operationsPerSample = 1,
}: {
  frameSize: number;
  sampleRate: number;
  operationsPerSample?: number;
}) {
  return {
    frameDurationMs: frameSize / sampleRate * 1000,
    estimatedOperations: frameSize * operationsPerSample,
  };
}
