import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
  ViewStyle,
  StyleProp,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface SlideRightModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  isDarkMode?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export const SlideRightModal: React.FC<SlideRightModalProps> = ({
  visible,
  onClose,
  children,
  isDarkMode,
  containerStyle,
}) => {
  const { width } = useWindowDimensions();
  const screenWidth = width || 450;

  const [rendered, setRendered] = useState(visible);
  const renderedRef = useRef(visible);
  const translateX = useRef(new Animated.Value(visible ? 0 : screenWidth)).current;

  useEffect(() => {
    let raf1: number | null = null;
    let raf2: number | null = null;
    let cancelled = false;

    if (visible) {
      translateX.stopAnimation();
      translateX.setValue(screenWidth);
      renderedRef.current = true;
      setRendered(true);

      // Đợi Modal gắn vào native tree rồi mới chạy animation trượt từ phải sang trái mượt mà
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          if (cancelled) return;
          Animated.timing(translateX, {
            toValue: 0,
            duration: 250,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: Platform.OS !== "web",
          }).start();
        });
      });
    } else if (renderedRef.current) {
      translateX.stopAnimation();
      Animated.timing(translateX, {
        toValue: screenWidth,
        duration: 210,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }).start(({ finished }) => {
        if (finished && !cancelled) {
          renderedRef.current = false;
          setRendered(false);
        }
      });
    }

    return () => {
      cancelled = true;
      if (raf1 !== null) cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, [visible, screenWidth, translateX]);

  if (!rendered && !visible) {
    return null;
  }

  return (
    <Modal
      transparent
      statusBarTranslucent
      visible={rendered}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: isDarkMode ? "#0B0F19" : "#FFFFFF",
            transform: [{ translateX }],
          },
          containerStyle,
        ]}
      >
        <SafeAreaView
          edges={["top", "bottom"]}
          style={[
            styles.safeArea,
            { backgroundColor: isDarkMode ? "#0B0F19" : "#FFFFFF" },
          ]}
        >
          {children}
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  safeArea: {
    flex: 1,
  },
});
