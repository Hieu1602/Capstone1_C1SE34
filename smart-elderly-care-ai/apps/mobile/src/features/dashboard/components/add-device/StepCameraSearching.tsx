import React from 'react';
import { View, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';

interface StepCameraSearchingProps {
  styles: any;
  searchingPulseAnim1: Animated.Value;
  searchingPulseAnim2: Animated.Value;
  onClose: () => void;
}

export const StepCameraSearching: React.FC<StepCameraSearchingProps> = ({
  styles,
  searchingPulseAnim1,
  searchingPulseAnim2,
  onClose,
}) => {
  return (
    <SafeAreaView style={styles.searchingContainer} edges={['top', 'bottom']}>
      <View style={styles.searchingHeader}>
        <TouchableOpacity
          style={styles.searchingCloseBtn}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
      </View>

      <LocalizedText style={styles.searchingTitle}>
        SECA đang tìm kiếm thiết bị của bạn...
      </LocalizedText>

      <View style={styles.searchingCenter}>
        {/* Sóng radar tỏa ra 1 */}
        <Animated.View
          style={[
            styles.radarPulseCircle,
            {
              transform: [
                {
                  scale: searchingPulseAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 2.3],
                  }),
                },
              ],
              opacity: searchingPulseAnim1.interpolate({
                inputRange: [0, 0.4, 1],
                outputRange: [0.55, 0.25, 0],
              }),
            },
          ]}
        />

        {/* Sóng radar tỏa ra 2 */}
        <Animated.View
          style={[
            styles.radarPulseCircle,
            {
              transform: [
                {
                  scale: searchingPulseAnim2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 2.3],
                  }),
                },
              ],
              opacity: searchingPulseAnim2.interpolate({
                inputRange: [0, 0.4, 1],
                outputRange: [0.55, 0.25, 0],
              }),
            },
          ]}
        />

        <View style={styles.searchingCameraCircleOuter}>
          <View style={styles.searchingCameraCircleInner}>
            <Ionicons name="videocam" size={44} color="#0284C7" />
          </View>
        </View>

        <View style={styles.searchingPlusBadge}>
          <LocalizedText style={styles.searchingPlusText}>+</LocalizedText>
        </View>
        <View style={styles.searchingStreakLine1} />
        <View style={styles.searchingStreakLine2} />
        <View style={styles.searchingStreakLine3} />

        <View style={styles.searchingPhoneCircleOuter}>
          <View style={styles.searchingPhoneBody}>
            <View style={styles.searchingPhoneSpeaker} />
            <View style={styles.searchingPhoneScreen}>
              <Ionicons name="wifi" size={32} color="#FFF" />
            </View>
            <View style={styles.searchingPhoneHomeButton} />
          </View>
        </View>
      </View>

      <View style={styles.searchingFooter}>
        <LocalizedText style={styles.searchingFooterText}>
          Đảm bảo rằng bạn đã kết nối với Wi-Fi của thiết bị SECA của mình:{' '}
          <LocalizedText style={{ fontWeight: 'bold' }}>SECA_001</LocalizedText>.
        </LocalizedText>
      </View>
    </SafeAreaView>
  );
};

