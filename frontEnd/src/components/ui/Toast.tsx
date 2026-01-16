export default function Toast({ text }: { text: string }) {
  return (
    <div className="absolute bottom-3 left-3 z-40 max-w-[560px] rounded-2xl bg-slate-900/90 px-4 py-3 text-[12px] font-semibold text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
      {text}
    </div>
  );
}
