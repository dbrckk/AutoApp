export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#090909] p-5 shadow-2xl">
        <h2 className="text-lg font-black text-white">{title}</h2>

        <p className="mt-2 text-sm leading-6 text-zinc-400">{message}</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-black text-white hover:bg-white/10"
          >
            {cancelLabel}
          </button>

          <button
            onClick={onConfirm}
            className={`rounded-2xl px-4 py-3 text-sm font-black ${
              danger
                ? "border border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                : "bg-white text-black hover:bg-zinc-200"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
