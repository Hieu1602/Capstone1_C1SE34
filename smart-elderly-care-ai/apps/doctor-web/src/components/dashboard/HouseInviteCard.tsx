// src/components/dashboard/HouseInviteCard.tsx
// Card Lời mời tham gia hộ gia đình người cao tuổi cho Bác sĩ

import React, { useState } from 'react';
import { HouseInvite } from '../../types';
import { Home, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface HouseInviteCardProps {
  invite: HouseInvite;
  onRespond: (inviteId: string, action: 'accept' | 'reject') => Promise<void>;
}

export const HouseInviteCard: React.FC<HouseInviteCardProps> = ({ invite, onRespond }) => {
  const [loadingAction, setLoadingAction] = useState<'accept' | 'reject' | null>(null);

  const handleAction = async (action: 'accept' | 'reject') => {
    setLoadingAction(action);
    try {
      await onRespond(invite.id, action);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 transition-all hover:bg-amber-50">
      <div className="flex items-start space-x-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-xs">
          <Home className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h4 className="text-sm font-bold text-slate-900">
              Lời mời Bác sĩ gia đình
            </h4>
            <span className="rounded-full bg-amber-200/60 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              Chờ xác nhận
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-600">
            {invite.message ||
              `Chủ hộ ${invite.inviter_name || 'Gia đình'} đã gửi lời mời bạn phụ trách theo dõi sức khỏe cho ${invite.house_name}.`}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2.5 self-end sm:self-auto shrink-0">
        {/* Nút Từ chối */}
        <button
          onClick={() => handleAction('reject')}
          disabled={loadingAction !== null}
          className="flex items-center space-x-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
        >
          {loadingAction === 'reject' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          <span>Từ chối</span>
        </button>

        {/* Nút Đồng ý vào nhà */}
        <button
          onClick={() => handleAction('accept')}
          disabled={loadingAction !== null}
          className="flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {loadingAction === 'accept' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          <span>Đồng ý vào nhà</span>
        </button>
      </div>
    </div>
  );
};

