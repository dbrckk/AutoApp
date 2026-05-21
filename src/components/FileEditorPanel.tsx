import { useEffect, useState } from "react";
import type { VirtualFile } from "../types";

type Props = {
  file?: VirtualFile;
  onSave: (path: string, content: string) => void;
  onDelete: (path: string) => void;
};

export function FileEditorPanel({ file, onSave, onDelete }: Props) {
  const [content, setContent] = useState("");

  useEffect(() => {
    setContent(file?.content || "");
  }, [file?.path, file?.content]);

  if (!file) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-white">
            Editor
          </h2>
          <p className="truncate text-xs text-zinc-500">{file.path}</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onSave(file.path, content)}
            className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-black"
          >
            Save
          </button>

          <button
            onClick={() => onDelete(file.path)}
            className="rounded-xl border border-red-400/20 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/10"
          >
            Delete
          </button>
        </div>
      </div>

      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        spellCheck={false}
        className="h-[460px] w-full resize-none bg-black/50 p-4 font-mono text-xs leading-relaxed text-zinc-100 outline-none"
      />
    </section>
  );
}
