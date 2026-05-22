export type BuildIssue = {
  type:
    | "typescript"
    | "vite"
    | "missing_dependency"
    | "import_export"
    | "syntax"
    | "runtime"
    | "json"
    | "css"
    | "unknown";
  file?: string;
  line?: number;
  column?: number;
  code?: string;
  message: string;
  raw: string;
};

export function parseBuildErrors(log: string): BuildIssue[] {
  const issues: BuildIssue[] = [];

  const normalizedLog = String(log || "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\r/g, "");

  const lines = normalizedLog.split("\n");

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const block = lines.slice(index, index + 6).join("\n");
    const lower = line.toLowerCase();

    const fileLocation = extractFileLocation(line) || extractFileLocation(block);

    if (isNoise(line)) continue;

    if (
      lower.includes("cannot find module") ||
      lower.includes("failed to resolve import") ||
      lower.includes("module not found") ||
      lower.includes("could not resolve")
    ) {
      issues.push({
        type: "missing_dependency",
        file: fileLocation?.file,
        line: fileLocation?.line,
        column: fileLocation?.column,
        message: compact(line),
        raw: compact(block),
      });
      continue;
    }

    if (
      lower.includes("is not exported by") ||
      lower.includes("does not provide an export") ||
      lower.includes("has no exported member") ||
      lower.includes("no matching export")
    ) {
      issues.push({
        type: "import_export",
        file: fileLocation?.file,
        line: fileLocation?.line,
        column: fileLocation?.column,
        message: compact(line),
        raw: compact(block),
      });
      continue;
    }

    const tsCode = extractTsCode(line);

    if (
      tsCode ||
      lower.includes("type error") ||
      lower.includes("typescript error") ||
      lower.includes("typecheck") ||
      lower.includes("property") && lower.includes("does not exist") ||
      lower.includes("type") && lower.includes("is not assignable")
    ) {
      issues.push({
        type: "typescript",
        code: tsCode,
        file: fileLocation?.file,
        line: fileLocation?.line,
        column: fileLocation?.column,
        message: compact(line),
        raw: compact(block),
      });
      continue;
    }

    if (
      lower.includes("syntaxerror") ||
      lower.includes("unexpected token") ||
      lower.includes("unterminated") ||
      lower.includes("expected") && lower.includes("but found")
    ) {
      issues.push({
        type: "syntax",
        file: fileLocation?.file,
        line: fileLocation?.line,
        column: fileLocation?.column,
        message: compact(line),
        raw: compact(block),
      });
      continue;
    }

    if (
      lower.includes("json.parse") ||
      lower.includes("unexpected string in json") ||
      lower.includes("bad control character in string literal") ||
      lower.includes("package.json") && lower.includes("json")
    ) {
      issues.push({
        type: "json",
        file: fileLocation?.file || "/package.json",
        line: fileLocation?.line,
        column: fileLocation?.column,
        message: compact(line),
        raw: compact(block),
      });
      continue;
    }

    if (
      lower.includes("postcss") ||
      lower.includes("tailwind") ||
      lower.includes("unknown at rule") ||
      lower.includes("css syntax error")
    ) {
      issues.push({
        type: "css",
        file: fileLocation?.file,
        line: fileLocation?.line,
        column: fileLocation?.column,
        message: compact(line),
        raw: compact(block),
      });
      continue;
    }

    if (
      lower.includes("vite") ||
      lower.includes("rollup") ||
      lower.includes("[plugin:") ||
      lower.includes("build failed")
    ) {
      issues.push({
        type: "vite",
        file: fileLocation?.file,
        line: fileLocation?.line,
        column: fileLocation?.column,
        message: compact(line),
        raw: compact(block),
      });
    }
  }

  if (issues.length === 0 && normalizedLog.trim()) {
    issues.push({
      type: "unknown",
      message: compact(lines.find((line) => line.trim()) || "Unknown build error"),
      raw: normalizedLog.slice(0, 4000),
    });
  }

  return dedupeIssues(issues).slice(0, 40);
}

function extractFileLocation(text: string) {
  const patterns = [
    /([A-Za-z0-9_./@-]+\.(?:tsx|ts|jsx|js|css|json|html|md|yml|yaml)):(\d+):(\d+)/,
    /([A-Za-z0-9_./@-]+\.(?:tsx|ts|jsx|js|css|json|html|md|yml|yaml))\((\d+),(\d+)\)/,
    /(?:src|app|pages|components|lib|server)\/[^\s:)]+/,
    /\/src\/[^\s:)]+/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match) continue;

    if (match[1]?.includes(".")) {
      return {
        file: normalizeFile(match[1]),
        line: match[2] ? Number(match[2]) : undefined,
        column: match[3] ? Number(match[3]) : undefined,
      };
    }

    return {
      file: normalizeFile(match[0]),
      line: undefined,
      column: undefined,
    };
  }

  return null;
}

function extractTsCode(line: string) {
  const match = line.match(/\bTS\d{4}\b/);
  return match?.[0];
}

function normalizeFile(file: string) {
  const cleaned = file.replace(/^file:\/\//, "").replace(process.cwd(), "");

  if (cleaned.startsWith("/")) return cleaned;
  return `/${cleaned}`;
}

function compact(value: string) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

function isNoise(line: string) {
  const lower = line.toLowerCase().trim();

  return (
    !lower ||
    lower.startsWith("> ") ||
    lower.startsWith("npm notice") ||
    lower.startsWith("npm warn") ||
    lower.includes("found 0 vulnerabilities") ||
    lower.includes("packages are looking for funding")
  );
}

function dedupeIssues(issues: BuildIssue[]) {
  const seen = new Set<string>();

  return issues.filter((issue) => {
    const key = [
      issue.type,
      issue.code,
      issue.file,
      issue.line,
      issue.column,
      issue.message,
    ].join(":");

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
        }
