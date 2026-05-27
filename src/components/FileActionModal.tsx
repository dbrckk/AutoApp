export type FileActionMode = "create" | "rename";

export function FileActionModal({
  mode,
  value,
  onChange,
  onCancel,
  onConfirm,
}: {
  mode: FileActionMode | null;
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!mode) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#090909] p-5 shadow-2xl">
        <h2 className="text-lg font-black text-white">
          {mode === "create" ? "Create file" : "Rename file"}
        </h2>

        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Enter a project-relative path. Example: /src/components/Button.tsx
        </p>

        <input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-4 w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none focus:border-white/30"
          placeholder="/src/new-file.ts"
        />

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-black text-white hover:bg-white/10"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-black hover:bg-zinc-200"
          >
            Confirm
          </button>
        </div>
      </section>
    </div>
  );
      }
