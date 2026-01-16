import React, { useEffect, useState } from "react";
import { ReactFlowProvider } from "reactflow";
import TopologyCanvas from "@/components/Topology/TopologyCanvas";
import logoMp from "@/assets/logo-mapa.png";


export default function TopologyPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") setTheme("dark");
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="flex h-full flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex h-14 items-center justify-between border-b border-slate-900/10 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center">
          <img src={logoMp} alt="logo" width={100} height={100} />
          <h1 className="text-sm font-extrabold">Mapa de Equipamentos</h1>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
          Zoom: scroll • Pan: arrastar • DragStop salva • Delete remove • Ctrl+K busca
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-[11px] font-extrabold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            {theme === "dark" ? "Modo light" : "Modo dark"}
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <ReactFlowProvider>
          <TopologyCanvas />
        </ReactFlowProvider>
      </main>
    </div>
  );
}
