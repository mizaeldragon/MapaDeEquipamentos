import type { DeviceStatus } from "@/api/topology";

const map = {
  up:   { label: "UP",   dot: "bg-emerald-500", ring: "ring-emerald-500/20", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  warn: { label: "WARN", dot: "bg-amber-500",   ring: "ring-amber-500/20",   bg: "bg-amber-500/10",   border: "border-amber-500/30" },
  down: { label: "DOWN", dot: "bg-rose-500",    ring: "ring-rose-500/20",    bg: "bg-rose-500/10",    border: "border-rose-500/30" },
} as const;

export default function StatusPill({ status }: { status: DeviceStatus }) {
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-extrabold text-slate-900 dark:text-slate-100 ${s.bg} ${s.border} ring-4 ${s.ring}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
