import type { VirtualFile } from "../types";

type Props = {
  files: VirtualFile[];
  selectedPath?: string;
  onSelect?: (path: string) => void;
  onSelectFile?: (path: string) => void;
};

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function getIcon(path: string) {
  if (path.endsWith(".tsx") || path.endsWith(".jsx")) return "tsx";
  if (path.endsWith(".ts") || path.endsWith(".js")) return "ts";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "md";
  if (path.endsWith(".html")) return "html";
  return "file";
}

export function FileTree({
  files,
  selectedPath,
  onSelect,
  onSelectFile,
}: Props) {
  const handleSelect = onSelect || onSelectFile;

  return (
    <div className="space-y-1">
      {files.map((file) => {
        const normalized = normalizePath(file.path);
        const isSelected = normalizePath(selectedPath || "") === normalized;

        return (
          <button
            key={normalized}
            type="button"
            onClick={() => handleSelect?.(normalized)}
            className={`group flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition ${
              isSelected
                ? "bg-white text-black"
                : "text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${
                isSelected ? "bg-black/10 text-black" : "bg-white/10 text-zinc-300"
              }`}
            >
              {getIcon(normalized)}
            </span>

            <span className="min-w-0 truncate">{normalized}</span>
          </button>
        );
      })}
    </div>
  );
}
