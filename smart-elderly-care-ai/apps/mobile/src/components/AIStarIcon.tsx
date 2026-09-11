// src/components/AIStarIcon.tsx
// Đã đồng bộ biểu tượng AI sang hình ảnh Robot đội tai nghe theo yêu cầu người dùng

import React from 'react';
import AIBotIcon from './AIBotIcon';

interface Props {
  size?: number;
}

export default function AIStarIcon({ size = 52 }: Props) {
  return <AIBotIcon size={size} />;
}
