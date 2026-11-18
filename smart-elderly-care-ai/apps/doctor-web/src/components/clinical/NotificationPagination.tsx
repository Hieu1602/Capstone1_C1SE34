// src/components/clinical/NotificationPagination.tsx
// Thanh phân trang cho danh sách thông báo

import React from 'react';

interface NotificationPaginationProps {
  page: number;
  totalPages: number;
  startIdx: number;
  endIdx: number;
  totalCount: number;
  onPageChange: (nextPage: number) => void;
}

export const NotificationPagination: React.FC<NotificationPaginationProps> = ({
  page,
  totalPages,
  startIdx,
  endIdx,
  totalCount,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 px-2 border-t border-slate-200/80 dark:border-slate-800">
      <p className="text-xs text-slate-500 font-medium">
        Hiển thị <span className="font-bold text-slate-800 dark:text-slate-200">{startIdx + 1}–{endIdx}</span> trên{' '}
        <span className="font-bold text-slate-800 dark:text-slate-200">{totalCount}</span> thông báo
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
        >
          Trước
        </button>

        {Array.from({ length: totalPages }).map((_, idx) => {
          const pNum = idx + 1;
          if (pNum === 1 || pNum === totalPages || (pNum >= page - 1 && pNum <= page + 1)) {
            return (
              <button
                key={pNum}
                type="button"
                onClick={() => onPageChange(pNum)}
                className={`h-7 w-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  page === pNum
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {pNum}
              </button>
            );
          }
          if (pNum === page - 2 || pNum === page + 2) {
            return (
              <span key={pNum} className="px-1 text-xs text-slate-400">
                ...
              </span>
            );
          }
          return null;
        })}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
        >
          Sau
        </button>
      </div>
    </div>
  );
};
