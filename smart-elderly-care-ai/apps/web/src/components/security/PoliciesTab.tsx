import React from 'react';
import { SecurityPolicy } from '../../types';

interface PoliciesTabProps {
  policies: SecurityPolicy[];
  onTogglePolicy: (id: string) => void;
}

export const PoliciesTab: React.FC<PoliciesTabProps> = ({ policies, onTogglePolicy }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {policies.map((p) => (
        <div
          key={p.id}
          className="glass-card p-5 flex flex-col justify-between hover:border-sky-200 dark:hover:border-[#FF6B35]/40 transition-all"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-[#F5F6F8]">
                {p.name}
              </span>
              <div className="flex items-center gap-2">
                {p.is_immutable && (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    BẮT BUỘC HỆ THỐNG
                  </span>
                )}
                <button
                  disabled={p.is_immutable}
                  onClick={() => onTogglePolicy(p.id)}
                  className={`relative inline-flex h-5 w-10 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    p.is_immutable
                      ? 'opacity-60 cursor-not-allowed bg-emerald-600'
                      : p.enabled
                      ? 'cursor-pointer bg-sky-500 dark:bg-[#FF6B35]'
                      : 'cursor-pointer bg-slate-300 dark:bg-[#202329] dark:border dark:border-[#454A53]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                      p.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-[#A1A7B1] leading-relaxed font-sans">
              {p.description}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-sky-100 dark:border-[#454A53] flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-[#727984]">
              {p.category}
            </span>
            {p.value && (
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-sky-50 dark:bg-[#202329] text-sky-700 dark:text-[#F5F6F8] border border-sky-200 dark:border-[#454A53]">
                Giá trị: {p.value}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
