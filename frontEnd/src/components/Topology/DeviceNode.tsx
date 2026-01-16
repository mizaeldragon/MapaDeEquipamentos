import React from "react";
import { Handle, Position } from "reactflow";
import type { DeviceStatus, DeviceType } from "@/api/topology";

export type DeviceNodeData = {
  name: string;
  type: DeviceType;
  ip?: string;
  status: DeviceStatus;
};

const statusClasses: Record<DeviceStatus, { dot: string; border: string; bg: string }> = {
  up:   { dot: "bg-emerald-500", border: "border-emerald-600", bg: "from-emerald-500/10 to-white/5" },
  warn: { dot: "bg-amber-500",   border: "border-amber-600",   bg: "from-amber-500/10 to-white/5" },
  down: { dot: "bg-rose-500",    border: "border-rose-600",    bg: "from-rose-500/10 to-white/5" },
};

const iconByType: Record<DeviceType, string> = {
  hub: "🌐",
  switch: "🔀",
  router: "📡",
  ap: "📶",
  server: "🖥️",
};

export default function DeviceNode({ data }: { data: DeviceNodeData }) {
  const s = statusClasses[data.status];

  return (
    <div
      className={`min-w-[200px] rounded-2xl border ${s.border} bg-gradient-to-b ${s.bg} px-3 py-2 shadow-[0_12px_30px_rgba(0,0,0,.12)] dark:from-slate-900/60 dark:to-slate-950/60`}
      title={`${data.name}${data.ip ? ` • ${data.ip}` : ""}`}
    >
      <Handle type="target" position={Position.Top} className={`h-2.5 w-2.5 ${s.dot}`} />
      <Handle type="source" position={Position.Bottom} className={`h-2.5 w-2.5 ${s.dot}`} />

      <div className="flex items-center gap-2.5">
        <div className="w-8 text-center text-xl">{iconByType[data.type]}</div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-extrabold text-slate-900 dark:text-slate-100">{data.name}</div>
          <div className="truncate text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            {data.type.toUpperCase()}
            {data.ip ? ` • ${data.ip}` : ""}
          </div>
        </div>

        <div className={`h-2.5 w-2.5 rounded-full ${s.dot} shadow-[0_0_0_4px_rgba(0,0,0,.05)]`} />
      </div>
    </div>
  );
}
