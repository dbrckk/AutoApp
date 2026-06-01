const TABS = [
  { id: "overview", label: "Overview" },
  { id: "files", label: "Files" },
  { id: "timeline", label: "Timeline" },
  { id: "release", label: "Release" },
  { id: "github", label: "GitHub" },
  { id: "logs", label: "Logs" },
];

export function ProjectTabs({
  activeView,
  onViewChange,
}: {
  activeView: string;
  onViewChange: (view: string) => void;
}) {
  return (
    <div className="sticky top-[92px] z-20 overflow-x-auto border-b border-white/10 bg-[#050505]/85 py-2 backdrop-blur-xl lg:top-[104px]">
      <div className="flex min-w-max gap-2">
        {TABS.map((tab) => {
          const active = activeView === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onViewChange(tab.id)}
              className={`min-h-10 rounded-2xl px-4 text-xs font-black transition active:scale-[0.98] ${
                active
                  ? "bg-white text-black"
                  : "border border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
