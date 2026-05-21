import type { VirtualFile } from "../engine/types";

export function createDeploymentPack(files: VirtualFile[]): VirtualFile[] {
  const existing = new Set(files.map((f) => normalize(f.path)));
  const additions: VirtualFile[] = [];

  if (!existing.has("/README.md")) {
    additions.push({
      path: "/README.md",
      content: createReadme(files),
    });
  }

  if (!existing.has("/.env.example")) {
    additions.push({
      path: "/.env.example",
      content: createEnvExample(),
    });
  }

  if (!existing.has("/vercel.json")) {
    additions.push({
      path: "/vercel.json",
      content: JSON.stringify(
        {
          buildCommand: "npm run build",
          outputDirectory: "dist",
          installCommand: "npm install",
          framework: "vite",
          rewrites: [{ source: "/(.*)", destination: "/" }],
        },
        null,
        2
      ),
    });
  }

  if (!existing.has("/Dockerfile")) {
    additions.push({
      path: "/Dockerfile",
      content: createDockerfile(),
    });
  }

  if (!existing.has("/.github/workflows/deploy.yml")) {
    additions.push({
      path: "/.github/workflows/deploy.yml",
      content: createGithubWorkflow(),
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

function createReadme(files: VirtualFile[]) {
  const hasVite = files.some((f) => normalize(f.path).includes("vite.config"));

  return `# Forge Generated App

Production-ready app generated with Forge AI App Builder.

## Stack

- React
- TypeScript
- ${hasVite ? "Vite" : "Modern frontend build system"}
- Tailwind CSS

## Install

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Production build

\`\`\`bash
npm run build
npm run preview
\`\`\`

## Deploy on Vercel

This project includes a \`vercel.json\` file.

Recommended settings:

- Build command: \`npm run build\`
- Output directory: \`dist\`
- Install command: \`npm install\`

## Environment

Copy:

\`\`\`bash
cp .env.example .env
\`\`\`

Then fill the required values.
`;
}

function createEnvExample() {
  return `# App
VITE_APP_NAME="Forge Generated App"
VITE_PUBLIC_SITE_URL="https://example.com"

# Optional API keys
VITE_API_BASE_URL=""
`;
}

function createDockerfile() {
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
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
}

function createGithubWorkflow() {
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
        run: npm install

      - name: Build
        run: npm run build
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
