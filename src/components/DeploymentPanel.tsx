type Props = {
  loading?: boolean;
  onGenerate?: () => void;
};

export function DeploymentPanel({ loading, onGenerate }: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white">Deployment pack</h2>
        <p className="text-xs text-zinc-400">
          Add README, Vercel config, Dockerfile, GitHub Actions and SEO base files.
        </p>
      </div>

      <button
        onClick={onGenerate}
        disabled={loading}
        className="rounded-2xl bg-white px-4 py-2 text-xs font-bold text-black disabled:opacity-50"
      >
        {loading ? "Generating..." : "Add deployment files"}
      </button>
    </section>
  );
}
