import React from 'react';
import { Check } from 'lucide-react';
import { RBAC_ROWS, ROLE_COLORS } from './securityConfig';

export const RbacMatrixTab: React.FC = () => {
  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-sky-100 dark:border-[#454A53]">
        <h3 className="text-xs font-bold text-slate-900 dark:text-[#F5F6F8]">
          Ma trận phân quyền kiểm soát truy cập (Role-Based Access Control)
        </h3>
        <p className="text-xs text-slate-500 dark:text-[#A1A7B1] mt-0.5">
          Quy định quyền xem, sửa, điều khiển thiết bị IoT và quản lý hạ tầng cho từng nhóm tài khoản
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-sky-100 dark:border-[#454A53] bg-sky-50/50 dark:bg-[#202329] font-semibold text-slate-700 dark:text-[#A1A7B1]">
              <th className="py-3 px-4">Quyền hạn / Chức năng</th>
              <th className="py-3 px-4 text-center">Quản Trị Viên (Admin)</th>
              <th className="py-3 px-4 text-center">Bác sĩ (Doctor)</th>
              <th className="py-3 px-4 text-center">Người chăm sóc (Caregiver)</th>
              <th className="py-3 px-4 text-center">Chủ nhà (Owner/User)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sky-100 dark:divide-[#454A53]">
            {RBAC_ROWS.map((row, idx) => (
              <tr key={idx} className="hover:bg-sky-50/40 dark:hover:bg-[#202329] transition-colors">
                <td className="py-3 px-4 font-medium text-slate-800 dark:text-[#F5F6F8]">{row.name}</td>
                {row.permissions.map((hasPerm, pIdx) => (
                  <td key={pIdx} className="py-3 px-4 text-center">
                    {hasPerm ? (
                      <Check className={`w-4 h-4 ${ROLE_COLORS[pIdx]} mx-auto`} />
                    ) : (
                      <span className="text-slate-300 dark:text-slate-700">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
