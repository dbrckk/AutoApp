export function detectTarget(prompt: string) {
  const text = String(prompt || "").toLowerCase();

  const has = (...words: string[]) => words.some((word) => text.includes(word));

  if (
    has(
      "jeu",
      "game",
      "gaming",
      "addictif",
      "arcade",
      "sprite",
      "enemy",
      "score",
      "level",
      "boss"
    )
  ) {
    if (has("android", "apk", "play store", "mobile app")) {
      return "android-web-game";
    }

    return "web-game";
  }

  if (has("android", "apk", "play store", "capacitor")) {
    return "android-capacitor";
  }

  if (has("saas", "subscription", "pricing", "tenant", "workspace", "billing")) {
    return "saas";
  }

  if (has("dashboard", "analytics", "admin", "metrics", "kpi", "charts")) {
    return "dashboard";
  }

  if (has("ecommerce", "shop", "store", "cart", "checkout", "product page")) {
    return "ecommerce";
  }

  if (has("affiliate", "amazon", "deal", "deals", "coupon", "commission")) {
    return "affiliate";
  }

  if (has("trading", "forex", "crypto", "signals", "backtest", "portfolio")) {
    return "trading";
  }

  if (has("ai", "gpt", "gemini", "prompt", "chatbot", "agent", "automation")) {
    return "ai-tool";
  }

  if (has("landing", "website", "site vitrine", "portfolio")) {
    return "landing-page";
  }

  if (has("crm", "lead", "pipeline", "customer")) {
    return "crm";
  }

  if (has("todo", "kanban", "task", "productivity", "planner")) {
    return "productivity";
  }

  if (has("learn", "course", "quiz", "education", "flashcard")) {
    return "education";
  }

  return "web-app";
}

export function getTargetProfile(target: string) {
  const profiles: Record<
    string,
    {
      label: string;
      requiredFeatures: string[];
      recommendedFiles: string[];
      forbiddenWeaknesses: string[];
    }
  > = {
    "web-game": {
      label: "Web Game",
      requiredFeatures: [
        "start screen",
        "game loop",
        "score system",
        "difficulty progression",
        "game over",
        "restart flow",
        "mobile controls",
        "animated feedback",
        "local best score",
      ],
      recommendedFiles: [
        "/src/App.tsx",
        "/src/style.css",
        "/src/assets/player.svg",
        "/src/assets/enemy.svg",
        "/src/assets/coin.svg",
        "/src/assets/sprite-manifest.json",
      ],
      forbiddenWeaknesses: [
        "static landing page",
        "no gameplay",
        "no scoring",
        "no controls",
        "no animations",
      ],
    },

    "android-web-game": {
      label: "Android-ready Web Game",
      requiredFeatures: [
        "touch-first controls",
        "PWA manifest",
        "Capacitor-ready structure",
        "game loop",
        "score system",
        "difficulty progression",
        "restart flow",
        "mobile viewport optimization",
        "offline-friendly assets",
      ],
      recommendedFiles: [
        "/manifest.webmanifest",
        "/capacitor.config.ts",
        "/src/App.tsx",
        "/src/style.css",
        "/src/assets/player.svg",
        "/src/assets/enemy.svg",
        "/src/assets/coin.svg",
      ],
      forbiddenWeaknesses: [
        "desktop-only layout",
        "no touch controls",
        "no mobile viewport",
        "no game loop",
      ],
    },

    "android-capacitor": {
      label: "Android Capacitor App",
      requiredFeatures: [
        "mobile-first UI",
        "Capacitor config",
        "PWA manifest",
        "installable app shell",
        "settings screen",
        "offline state",
        "touch-friendly controls",
      ],
      recommendedFiles: [
        "/capacitor.config.ts",
        "/manifest.webmanifest",
        "/src/App.tsx",
        "/src/style.css",
      ],
      forbiddenWeaknesses: [
        "desktop-only app",
        "missing mobile flow",
        "missing install instructions",
      ],
    },

    saas: {
      label: "SaaS",
      requiredFeatures: [
        "hero",
        "pricing",
        "dashboard preview",
        "onboarding flow",
        "testimonials",
        "FAQ",
        "CTA",
        "settings/account mock",
      ],
      recommendedFiles: [
        "/src/App.tsx",
        "/src/style.css",
        "/README.md",
        "/.env.example",
      ],
      forbiddenWeaknesses: [
        "no pricing",
        "no conversion flow",
        "no dashboard",
        "generic landing page",
      ],
    },

    dashboard: {
      label: "Dashboard",
      requiredFeatures: [
        "sidebar/navigation",
        "metric cards",
        "activity feed",
        "filters",
        "status indicators",
        "responsive tables/cards",
        "empty/loading/error states",
      ],
      recommendedFiles: ["/src/App.tsx", "/src/style.css"],
      forbiddenWeaknesses: [
        "no metrics",
        "no data visualization",
        "no navigation",
      ],
    },

    ecommerce: {
      label: "Ecommerce",
      requiredFeatures: [
        "product grid",
        "product detail",
        "cart state",
        "checkout mock",
        "filters",
        "search",
        "pricing",
        "reviews",
      ],
      recommendedFiles: ["/src/App.tsx", "/src/style.css"],
      forbiddenWeaknesses: ["no cart", "no products", "no checkout"],
    },

    affiliate: {
      label: "Affiliate Deals",
      requiredFeatures: [
        "deal cards",
        "deal score",
        "category filters",
        "affiliate CTA",
        "comparison section",
        "SEO sections",
        "disclaimer",
      ],
      recommendedFiles: [
        "/src/App.tsx",
        "/src/style.css",
        "/robots.txt",
        "/sitemap.xml",
      ],
      forbiddenWeaknesses: ["no products", "no CTA", "no SEO"],
    },

    trading: {
      label: "Trading Scanner",
      requiredFeatures: [
        "signal cards",
        "risk panel",
        "portfolio state",
        "watchlist",
        "trade journal",
        "confidence score",
        "market warnings",
      ],
      recommendedFiles: ["/src/App.tsx", "/src/style.css"],
      forbiddenWeaknesses: [
        "no risk management",
        "no signals",
        "no disclaimer",
      ],
    },

    "ai-tool": {
      label: "AI Tool",
      requiredFeatures: [
        "prompt input",
        "generation output",
        "history",
        "settings",
        "model selector",
        "loading/error states",
        "copy/export actions",
      ],
      recommendedFiles: [
        "/src/App.tsx",
        "/src/style.css",
        "/.env.example",
      ],
      forbiddenWeaknesses: [
        "no prompt input",
        "no output panel",
        "no history",
      ],
    },

    "landing-page": {
      label: "Landing Page",
      requiredFeatures: [
        "hero",
        "features",
        "social proof",
        "CTA",
        "FAQ",
        "SEO metadata",
        "responsive sections",
      ],
      recommendedFiles: [
        "/src/App.tsx",
        "/src/style.css",
        "/README.md",
      ],
      forbiddenWeaknesses: ["weak CTA", "no SEO", "generic copy"],
    },

    crm: {
      label: "CRM",
      requiredFeatures: [
        "lead list",
        "pipeline",
        "deal cards",
        "contact detail",
        "task reminders",
        "filters",
        "status tracking",
      ],
      recommendedFiles: ["/src/App.tsx", "/src/style.css"],
      forbiddenWeaknesses: ["no pipeline", "no contacts", "no statuses"],
    },

    productivity: {
      label: "Productivity App",
      requiredFeatures: [
        "task creation",
        "kanban/list view",
        "priority",
        "progress tracking",
        "filters",
        "empty state",
        "local sample data",
      ],
      recommendedFiles: ["/src/App.tsx", "/src/style.css"],
      forbiddenWeaknesses: ["no task flow", "no state", "no progress"],
    },

    education: {
      label: "Education App",
      requiredFeatures: [
        "lesson cards",
        "quiz flow",
        "progress tracking",
        "feedback states",
        "score summary",
        "review mode",
      ],
      recommendedFiles: ["/src/App.tsx", "/src/style.css"],
      forbiddenWeaknesses: ["no quiz", "no progress", "no learning flow"],
    },

    "web-app": {
      label: "Web App",
      requiredFeatures: [
        "clear navigation",
        "main workflow",
        "sample data",
        "states",
        "settings",
        "responsive layout",
      ],
      recommendedFiles: ["/src/App.tsx", "/src/style.css"],
      forbiddenWeaknesses: ["generic app", "no workflow", "no state"],
    },
  };

  return profiles[target] || profiles["web-app"];
}
