import type { VirtualFile } from "../types";

type Props = {
  file?: VirtualFile | null;
  onChange?: (content: string) => void;
};

export function CodeEditor({ file, onChange }: Props) {
  if (!file) {
    return (
      <div className="flex h-[620px] items-center justify-center bg-black/40 p-6 text-sm text-zinc-500">
        Select a file.
      </div>
    );
  }

  return (
    <textarea
      value={file.content || ""}
      onChange={(event) => onChange?.(event.target.value)}
      spellCheck={false}
      className="h-[620px] w-full resize-none bg-black/60 p-4 font-mono text-xs leading-relaxed text-zinc-100 outline-none"
    />
  );
}
