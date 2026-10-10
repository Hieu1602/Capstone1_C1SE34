// ==============================================================================
// AIStarIcon.tsx – Lớp bọc tương thích ngược (Backward Compatibility Shim)
// ------------------------------------------------------------------------------
// Hệ thống giám sát người cao tuổi Smart Elderly Care AI (C1SE.34)
//
// Lịch sử thiết kế:
// - Ban đầu dự án sử dụng icon AI dạng ngôi sao bốn cánh (AIStarIcon).
// - Sau khi khảo sát trải nghiệm người dùng, nhóm đã chuyển toàn bộ nhận diện AI
//   sang hình tượng Robot 3D đội tai nghe (AIBotIcon).
// - File này đóng vai trò Adapter / Proxy trung gian để nếu có màn hình cũ nào
//   vẫn import AIStarIcon thì vẫn tự động hiển thị AIBotIcon mà không gây lỗi runtime.
// ==============================================================================

import React from 'react';
import AIBotIcon from './AIBotIcon';

/**
 * Props cho AIStarIcon:
 * @property {number} [size=52] - Kích thước của biểu tượng.
 */
interface Props {
  size?: number;
}

/**
 * @deprecated Khuyến nghị import trực tiếp component AIBotIcon thay vì AIStarIcon.
 */
export default function AIStarIcon({ size = 52 }: Props) {
  // Chuyển tiếp toàn bộ việc render sang AIBotIcon
  return <AIBotIcon size={size} />;
}

