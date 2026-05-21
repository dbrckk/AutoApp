import { useEffect, useState } from "react";
import { applyTemplate, listTemplates } from "../lib/api";

type Props = {
  onApply: (template: any) => void;
};

export function TemplatesPanel({ onApply }: Props) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);

      try {
        const result = await listTemplates();
        if (alive) setTemplates(result);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  async function handleApply(id: string) {
    const template = await applyTemplate(id);
    onApply(template);
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white">Templates</h2>
        <p className="text-xs text-zinc-400">
          Start from a structured project foundation.
        </p>
      </div>

      {loading && <p className="text-xs text-zinc-500">Loading templates...</p>}

      <div className="space-y-2">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => handleApply(template.id)}
            className="w-full rounded-2xl border border-white/10 bg-black/25 p-3 text-left hover:bg-white/10"
          >
            <p className="text-xs font-bold text-white">{template.name}</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              {template.description}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
