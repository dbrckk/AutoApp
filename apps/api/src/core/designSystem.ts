export type DesignSystemPlan = {
  theme: {
    background: string[];
    surfaces: string[];
    text: string[];
    accent: string[];
    danger: string[];
    success: string[];
  };
  typography: {
    pageTitle: string;
    sectionTitle: string;
    body: string;
    meta: string;
  };
  spacing: string[];
  radius: string[];
  rules: string[];
};

export function createDesignSystemPlan(): DesignSystemPlan {
  return {
    theme: {
      background: ["#05070c", "#070b15", "#0b1020"],
      surfaces: ["rgba(255,255,255,0.075)", "rgba(255,255,255,0.045)", "rgba(0,0,0,0.24)"],
      text: ["#ffffff", "#cbd5e1", "#64748b"],
      accent: ["#7c5cff", "#4cc9ff"],
      danger: ["#ff6b6b"],
      success: ["#1ed7a5"],
    },
    typography: {
      pageTitle: "28-40px, 900 weight, tight tracking",
      sectionTitle: "18-24px, 800-900 weight",
      body: "14-16px, 400-600 weight, 1.55 line height",
      meta: "10-12px, uppercase when useful",
    },
    spacing: ["8px", "12px", "16px", "20px", "24px", "32px"],
    radius: ["16px", "20px", "28px", "32px"],
    rules: [
      "One primary action per visible screen.",
      "Every card must have a clear title and purpose.",
      "Mobile layout must work without horizontal scroll.",
      "Avoid dense debug panels in primary UX.",
      "Use skeleton or empty states instead of blank sections.",
      "Use consistent rounded panels and clear focus states.",
    ],
  };
}

export function designSystemToPrompt(plan: DesignSystemPlan) {
  return [
    "DESIGN SYSTEM",
    "",
    "Theme:",
    "- background: " + plan.theme.background.join(", "),
    "- surfaces: " + plan.theme.surfaces.join(", "),
    "- text: " + plan.theme.text.join(", "),
    "- accent: " + plan.theme.accent.join(", "),
    "- danger: " + plan.theme.danger.join(", "),
    "- success: " + plan.theme.success.join(", "),
    "",
    "Typography:",
    "- page title: " + plan.typography.pageTitle,
    "- section title: " + plan.typography.sectionTitle,
    "- body: " + plan.typography.body,
    "- meta: " + plan.typography.meta,
    "",
    "Spacing:",
    ...plan.spacing.map((item) => "- " + item),
    "",
    "Radius:",
    ...plan.radius.map((item) => "- " + item),
    "",
    "Rules:",
    ...plan.rules.map((rule) => "- " + rule),
  ].join("\n");
}

export function createBaseCss() {
  return ':root { color-scheme: dark; background: #05070c; color: #ffffff; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }\n' +
    '* { box-sizing: border-box; }\n' +
    'html, body, #root { width: 100%; min-height: 100%; margin: 0; }\n' +
    'html, body { overflow-x: hidden; overflow-y: auto; background: #05070c; }\n' +
    'body { min-width: 320px; min-height: 100dvh; -webkit-font-smoothing: antialiased; }\n' +
    'button, input, textarea, select { font: inherit; }\n' +
    'button { touch-action: manipulation; }\n' +
    '.app-bg { min-height: 100dvh; background: radial-gradient(circle at top left, rgba(124, 92, 255, 0.25), transparent 30rem), linear-gradient(180deg, #05070c 0%, #070b15 52%, #05070c 100%); }\n' +
    '.glass-panel { border: 1px solid rgba(255,255,255,0.09); background: rgba(7,10,18,0.86); box-shadow: 0 28px 100px rgba(0,0,0,0.40); backdrop-filter: blur(20px); }\n' +
    '.soft-card { border: 1px solid rgba(255,255,255,0.075); background: rgba(255,255,255,0.045); }\n' +
    '.input-premium { border: 1px solid rgba(255,255,255,0.09); background: rgba(0,0,0,0.32); color: #ffffff; outline: none; }\n';
    }
    
