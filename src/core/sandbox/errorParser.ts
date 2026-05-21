export type BuildIssue = {
  type:
    | "typescript"
    | "vite"
    | "missing_dependency"
    | "import_export"
    | "syntax"
    | "runtime"
    | "unknown";
  file?: string;
  message: string;
  raw: string;
};

export function parseBuildErrors(log: string): BuildIssue[] {
  const issues: BuildIssue[] = [];
  const lines = log.split("\n");

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (
      lower.includes("cannot find module") ||
      lower.includes("failed to resolve import") ||
      lower.includes("module not found")
    ) {
      issues.push({
        type: "missing_dependency",
        file: extractFile(line),
        message: line.trim(),
        raw: line,
      });
      continue;
    }

    if (
      lower.includes("is not exported by") ||
      lower.includes("does not provide an export") ||
      lower.includes("has no exported member")
    ) {
      issues.push({
        type: "import_export",
        file: extractFile(line),
        message: line.trim(),
        raw: line,
      });
      continue;
    }

    if (
      lower.includes("syntaxerror") ||
      lower.includes("unexpected token") ||
      lower.includes("unterminated")
    ) {
      issues.push({
        type: "syntax",
        file: extractFile(line),
        message: line.trim(),
        raw: line,
      });
      continue;
    }

    if (
      lower.includes("typescript") ||
      lower.includes("ts") ||
      lower.includes("type error") ||
      lower.includes("ts2307") ||
      lower.includes("ts2322") ||
      lower.includes("ts2339")
    ) {
      issues.push({
        type: "typescript",
        file: extractFile(line),
        message: line.trim(),
        raw: line,
      });
      continue;
    }

    if (lower.includes("vite") || lower.includes("rollup")) {
      issues.push({
        type: "vite",
        file: extractFile(line),
        message: line.trim(),
        raw: line,
      });
    }
  }

  return dedupeIssues(issues).slice(0, 30);
}

function extractFile(line: string) {
  const match =
    line.match(/(?:src|app|pages|components|lib|server)\/[^\s:)]+/) ||
    line.match(/[A-Za-z0-9_\-/]+\.(tsx|ts|jsx|js|css|json)/);

  return match?.[0];
}

function dedupeIssues(issues: BuildIssue[]) {
  const seen = new Set<string>();

  return issues.filter((issue) => {
    const key = `${issue.type}:${issue.file}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
                  }
