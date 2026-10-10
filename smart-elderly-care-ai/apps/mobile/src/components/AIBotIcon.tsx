// ==============================================================================
// AIBotIcon.tsx – Biểu tượng Robot Trợ lý AI 3D (Shared Component)
// ------------------------------------------------------------------------------
// Hệ thống giám sát người cao tuổi Smart Elderly Care AI (C1SE.34)
//
// Trách nhiệm của component:
// 1. Render hình ảnh Robot AI 3D đội tai nghe phát sáng từ thư mục assets.
// 2. Tái sử dụng ở nhiều vị trí: Nút chính giữa Bottom Tab Navigator, Avatar
//    chào mừng trong AIAssistantScreen, và avatar tin nhắn phản hồi của Bot.
// 3. Hỗ trợ hiệu ứng phóng to nhẹ (scale animation) khi tab được chọn (focused).
// ==============================================================================

import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

/**
 * Props cho component AIBotIcon:
 * @property {number}  [size=48]        - Kích thước vuông (width & height) tính theo pixel.
 * @property {boolean} [focused=false]  - Trạng thái tab đang được kích hoạt (để phóng to nhẹ).
 */
interface Props {
  size?: number;
  focused?: boolean;
}

export default function AIBotIcon({ size = 48, focused = false }: Props) {
  return (
    // Khung bao bọc icon: Cố định kích thước vuông và áp dụng hiệu ứng khi tab được focus
    <View style={[styles.wrapper, { width: size, height: size }, focused && styles.wrapperFocused]}>
      {/* Hình ảnh Robot AI lấy trực tiếp từ thư mục assets tập trung */}
      <Image
        source={require('../../assets/ai_operator_bot.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </View>
  );
}

// ------------------------------------------------------------------------------
// Stylesheet
// ------------------------------------------------------------------------------
const styles = StyleSheet.create({
  // Canh giữa biểu tượng bên trong khung chứa
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Hiệu ứng phóng to nhẹ 1.08x tạo cảm giác nổi bật khi người dùng chọn tab AI
  wrapperFocused: {
    transform: [{ scale: 1.08 }],
  },
});

