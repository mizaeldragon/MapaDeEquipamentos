import React from "react";

export default function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close modal overlay"
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-900/10 bg-white p-4 shadow-[0_30px_80px_rgba(0,0,0,.35)] dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-900/10 bg-white px-3 py-2 text-xs font-extrabold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
