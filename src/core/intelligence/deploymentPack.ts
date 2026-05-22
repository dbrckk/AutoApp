import type { VirtualFile } from "../engine/types";
import { inspectProject } from "./projectInspector";

export function createDeploymentPack(files: VirtualFile[]): VirtualFile[] {
  const existing = new Set(files.map((file) => normalize(file.path)));
  const inspection = inspectProject(files);
  const additions: VirtualFile[] = [];

  if (!existing.has("/README.md")) {
    additions.push({
      path: "/README.md",
      content: createReadme(files, inspection),
    });
  }

  if (!existing.has("/.env.example")) {
    additions.push({
      path: "/.env.example",
      content: createEnvExample(inspection.framework),
    });
  }

  if (!existing.has("/vercel.json")) {
    additions.push({
      path: "/vercel.json",
      content: JSON.stringify(createVercelConfig(inspection.framework), null, 2),
    });
  }

  if (!existing.has("/Dockerfile")) {
    additions.push({
      path: "/Dockerfile",
      content: createDockerfile(inspection.framework),
    });
  }

  if (!existing.has("/.github/workflows/deploy.yml")) {
    additions.push({
      path: "/.github/workflows/deploy.yml",
      content: createGithubWorkflow(inspection.packageManager),
    });
  }

  if (!existing.has("/robots.txt")) {
    additions.push({
      path: "/robots.txt",
      content: `User-agent: *\nAllow: /\n\nSitemap: /sitemap.xml\n`,
    });
  }

  if (!existing.has("/sitemap.xml")) {
    additions.push({
      path: "/sitemap.xml",
      content: createSitemap(),
    });
  }

  return additions;
}

function normalize(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function getProjectName(files: VirtualFile[]) {
  const packageFile = files.find((file) => normalize(file.path) === "/package.json");

  if (!packageFile?.content) return "Forge Generated App";

  try {
    const json = JSON.parse(packageFile.content);
    return json.name || "Forge Generated App";
  } catch {
    return "Forge Generated App";
  }
}

function createReadme(files: VirtualFile[], inspection: ReturnType<typeof inspectProject>) {
  const name = getProjectName(files);

  return `# ${name}

Production-ready application generated with Forge AI App Builder.

## Stack

- Framework: ${inspection.framework}
- Language: ${inspection.language}
- Package manager: ${inspection.packageManager}

## Install

\`\`\`bash
${inspection.packageManager} install
\`\`\`

## Development

\`\`\`bash
${runCommand(inspection.packageManager, "dev")}
\`\`\`

## Production build

\`\`\`bash
${runCommand(inspection.packageManager, "build")}
\`\`\`

## Preview

\`\`\`bash
${runCommand(inspection.packageManager, "preview")}
\`\`\`

## Deploy on Vercel

Recommended settings:

- Build command: \`${runCommand(inspection.packageManager, "build")}\`
- Output directory: \`${getOutputDirectory(inspection.framework)}\`
- Install command: \`${inspection.packageManager} install\`

## Environment

Copy:

\`\`\`bash
cp .env.example .env
\`\`\`

Then fill the required values.
`;
}

function createEnvExample(framework: string) {
  if (framework === "Next.js") {
    return `NEXT_PUBLIC_APP_NAME="Forge Generated App"
NEXT_PUBLIC_SITE_URL="https://example.com"
NEXT_PUBLIC_API_BASE_URL=""
`;
  }

  return `VITE_APP_NAME="Forge Generated App"
VITE_PUBLIC_SITE_URL="https://example.com"
VITE_API_BASE_URL=""
`;
}

function createVercelConfig(framework: string) {
  if (framework === "Next.js") {
    return {
      framework: "nextjs",
    };
  }

  return {
    buildCommand: "npm run build",
    outputDirectory: getOutputDirectory(framework),
    installCommand: "npm install",
    framework: "vite",
    rewrites: [{ source: "/(.*)", destination: "/" }],
  };
}

function createDockerfile(framework: string) {
  if (framework === "Next.js") {
    return `FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "start"]
`;
  }

  return `FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/${getOutputDirectory(framework)} /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
}

function createGithubWorkflow(packageManager: string) {
  return `name: Build

on:
  push:
    branches:
      - main
      - master
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install
        run: ${packageManager} install

      - name: Build
        run: ${runCommand(packageManager, "build")}
`;
}

function createSitemap() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <priority>1.0</priority>
  </url>
</urlset>
`;
}

function getOutputDirectory(framework: string) {
  if (framework === "Next.js") return ".next";
  if (framework === "Astro") return "dist";
  return "dist";
}

function runCommand(packageManager: string, script: string) {
  if (packageManager === "yarn") return `yarn ${script}`;
  if (packageManager === "pnpm") return `pnpm ${script}`;
  return `npm run ${script}`;
                   }
