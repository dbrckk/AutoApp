import type { ReactNode } from "react";

export function WorkspaceLayout({
  sidebar,
  header,
  children,
  inspector,
}: {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
  inspector?: ReactNode;
}) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute left-[-20%] top-[-10%] h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-10%] top-[10%] h-[360px] w-[360px] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[30%] h-[520px] w-[520px] rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
        <aside className="hidden w-[292px] shrink-0 border-r border-white/10 bg-black/35 backdrop-blur-xl lg:block">
          <div className="sticky top-0 h-screen overflow-y-auto p-4">
            {sidebar}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-30 border-b border-white/10 bg-black/75 px-3 py-3 backdrop-blur-xl md:px-5 lg:px-6">
            {header}
          </div>

          <div className="grid min-h-0 flex-1 gap-5 px-3 pb-28 pt-4 md:px-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-6 lg:pb-6">
            <section className="min-w-0 space-y-5">{children}</section>

            {inspector ? (
              <aside className="hidden min-w-0 space-y-5 lg:block">{inspector}</aside>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
