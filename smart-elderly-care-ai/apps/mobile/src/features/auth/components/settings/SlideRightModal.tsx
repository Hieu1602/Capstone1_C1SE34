import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
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
  const [rendered, setRendered] = useState(visible);
  const screenWidth = Dimensions.get("window").width || 450;
  const translateX = useRef(new Animated.Value(visible ? 0 : screenWidth)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      translateX.setValue(screenWidth);
      const raf = requestAnimationFrame(() => {
        Animated.timing(translateX, {
          toValue: 0,
          duration: 260,
          useNativeDriver: Platform.OS !== "web",
        }).start();
      });
      return () => cancelAnimationFrame(raf);
    } else if (rendered) {
      Animated.timing(translateX, {
        toValue: screenWidth,
        duration: 220,
        useNativeDriver: Platform.OS !== "web",
      }).start(() => {
        setRendered(false);
      });
    }
  }, [visible, screenWidth, translateX, rendered]);

  if (!rendered && !visible) {
    return null;
  }

  return (
    <Modal
      transparent
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
