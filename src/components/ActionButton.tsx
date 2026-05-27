export function ActionButton({
  children,
  onClick,
  disabled,
  variant = "secondary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  const classes = {
    primary:
      "bg-white text-black hover:bg-zinc-200 disabled:bg-white/40 disabled:text-black/60",
    secondary:
      "border border-white/10 bg-black/40 text-white hover:bg-white/10 disabled:text-zinc-600",
    danger:
      "border border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 disabled:text-red-900",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed ${classes[variant]}`}
    >
      {children}
    </button>
  );
}
