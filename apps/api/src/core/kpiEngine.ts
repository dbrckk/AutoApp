import type { QualityGateResult } from "./qualityGate";

export type ProductKpis = {
  build: number;
  ux: number;
  ui: number;
  mobile: number;
  performance: number;
  accessibility: number;
  security: number;
  architecture: number;
  autonomy: number;
  overall: number;
};

export function calculateKpis(input: {
  quality: QualityGateResult;
  buildOk: boolean;
  hasTests?: boolean;
  hasGitHub?: boolean;
  hasPersistence?: boolean;
}): ProductKpis {
  const q = input.quality.categories;

  const build = input.buildOk && input.quality.blockers.length === 0 ? 100 : 55;
  const ux = average([q.uiUx, q.productDepth, q.resilience]);
  const ui = q.uiUx;
  const mobile = q.mobile;
  const performance = inferPerformance(input.quality);
  const accessibility = inferAccessibility(input.quality);
  const security = inferSecurity(input.quality);
  const architecture = average([q.structure, q.buildability, q.resilience]);
  const autonomy = average([
    input.quality.total,
    input.hasGitHub ? 90 : 60,
    input.hasTests ? 85 : 55,
    input.hasPersistence ? 85 : 60,
  ]);

  const overall = average([
    build,
    ux,
    ui,
    mobile,
    performance,
    accessibility,
    security,
    architecture,
    autonomy,
  ]);

  return {
    build,
    ux,
    ui,
    mobile,
    performance,
    accessibility,
    security,
    architecture,
    autonomy,
    overall,
  };
}

export function kpisToPrompt(kpis: ProductKpis) {
  return [
    "PRODUCT KPIS",
    "Build: " + kpis.build,
    "UX: " + kpis.ux,
    "UI: " + kpis.ui,
    "Mobile: " + kpis.mobile,
    "Performance: " + kpis.performance,
    "Accessibility: " + kpis.accessibility,
    "Security: " + kpis.security,
    "Architecture: " + kpis.architecture,
    "Autonomy: " + kpis.autonomy,
    "Overall: " + kpis.overall,
  ].join("\n");
}

function inferPerformance(quality: QualityGateResult) {
  return clamp(quality.categories.buildability * 0.5 + quality.categories.structure * 0.5);
}

function inferAccessibility(quality: QualityGateResult) {
  return clamp(quality.categories.uiUx * 0.65 + quality.categories.mobile * 0.35);
}

function inferSecurity(quality: QualityGateResult) {
  return quality.blockers.length ? 65 : 86;
}

function average(values: number[]) {
  return clamp(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
  }
  
