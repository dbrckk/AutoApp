export type AppTab = "home" | "projects" | "editor" | "github" | "tools";

const TABS: {

id: AppTab;

label: string;

icon: string;

}[] = [

{ id: "home", label: "Home", icon: "●" },

{ id: "projects", label: "Projects", icon: "◆" },

{ id: "editor", label: "Editor", icon: "▣" },

{ id: "github", label: "GitHub", icon: "◇" },

{ id: "tools", label: "Tools", icon: "▤" },

];

export function MobileTabBar({

activeTab,

onChange,

}: {

activeTab: AppTab;

onChange: (tab: AppTab) => void;

}) {

return (

<nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/90 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">

<div className="mx-auto grid max-w-lg grid-cols-5 gap-1">

{TABS.map((tab) => {

const active = activeTab === tab.id;

return (

<button

key={tab.id}

onClick={() => onChange(tab.id)}

className={`min-h-14 rounded-2xl text-center transition active:scale-[0.96] ${

active ? "bg-white text-black" : "text-zinc-500 hover:bg-white/10"

}`}

>

<span className="block text-base leading-none">{tab.icon}</span>

<span className="mt-1 block text-[10px] font-black">

{tab.label}

</span>

</button>

);

})}

</div>

</nav>

);

}
