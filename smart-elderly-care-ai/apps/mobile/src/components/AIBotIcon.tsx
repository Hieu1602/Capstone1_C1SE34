// src/components/AIBotIcon.tsx
// Cute AI Bot Icon for Center Tab Bar (Imou / SmartCare style)

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Rect, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface Props {
  size?: number;
  focused?: boolean;
}

export default function AIBotIcon({ size = 48, focused = false }: Props) {
  return (
    <View style={[styles.wrapper, focused && styles.wrapperFocused]}>
      <Svg width={size} height={size} viewBox="0 0 54 54" fill="none">
        <Defs>
          {/* Gradient cho thân bot */}
          <LinearGradient id="botGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#38BDF8" />
            <Stop offset="50%" stopColor="#0284C7" />
            <Stop offset="100%" stopColor="#2563EB" />
          </LinearGradient>
          {/* Gradient cho tai/anten cánh */}
          <LinearGradient id="earGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#7DD3FC" />
            <Stop offset="100%" stopColor="#0284C7" />
          </LinearGradient>
        </Defs>

        {/* Tai trái & Tai phải vát cánh bướm như screenshot */}
        <Path
          d="M 11 25 C 7 17, 12 11, 20 18 Z"
          fill="url(#earGrad)"
        />
        <Path
          d="M 43 25 C 47 17, 42 11, 34 18 Z"
          fill="url(#earGrad)"
        />

        {/* Đỉnh đầu ăng-ten tròn nhỏ */}
        <Circle cx="27" cy="11" r="3.5" fill="#38BDF8" />
        <Rect x="25.5" y="14" width="3" height="4" rx="1.5" fill="#0284C7" />

        {/* Khuôn mặt Bot bo tròn bầu bĩnh */}
        <Rect
          x="12"
          y="17"
          width="30"
          height="25"
          rx="12"
          fill="url(#botGrad)"
        />

        {/* Màn hình hiển thị đen bo góc mềm */}
        <Rect
          x="15"
          y="20"
          width="24"
          height="18"
          rx="8"
          fill="#090E1A"
        />

        {/* Mắt phát sáng kỹ thuật số (Mắt lấp lánh cyan) */}
        <Circle cx="22" cy="28" r="3" fill="#38BDF8" />
        <Circle cx="22" cy="27" r="1" fill="#FFFFFF" />

        <Circle cx="32" cy="28" r="3" fill="#38BDF8" />
        <Circle cx="32" cy="27" r="1" fill="#FFFFFF" />

        {/* Miệng cười công nghệ nhẹ nhàng */}
        <Path
          d="M 24 33 Q 27 36 30 33"
          stroke="#38BDF8"
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        {/* Chấm má hồng công nghệ */}
        <Circle cx="18" cy="31" r="1.2" fill="#06B6D4" opacity={0.8} />
        <Circle cx="36" cy="31" r="1.2" fill="#06B6D4" opacity={0.8} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapperFocused: {
    transform: [{ scale: 1.1 }],
  },
});
