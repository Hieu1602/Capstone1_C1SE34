// src/components/AIBotIcon.tsx
// Biểu tượng Robot Trợ lý AI đội tai nghe theo đúng hình ảnh người dùng cung cấp

import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

interface Props {
  size?: number;
  focused?: boolean;
}

export default function AIBotIcon({ size = 48, focused = false }: Props) {
  return (
    <View style={[styles.wrapper, { width: size, height: size }, focused && styles.wrapperFocused]}>
      {/* Hiển thị hình ảnh Robot AI đeo tai nghe đúng như ảnh bạn đưa */}
      <Image
        source={require('../assets/ai_operator_bot.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapperFocused: {
    transform: [{ scale: 1.08 }],
  },
});
