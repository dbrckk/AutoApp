import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
      <div className="mb-4">
        <h2 className="text-lg font-black text-white">{title}</h2>

        {subtitle ? (
          <p className="mt-1 text-sm leading-6 text-zinc-500">{subtitle}</p>
        ) : null}
      </div>

      {children}
    </section>
  );
}
