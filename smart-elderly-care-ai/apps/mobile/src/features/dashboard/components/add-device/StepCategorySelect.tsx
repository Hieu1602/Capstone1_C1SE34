import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';

interface StepCategorySelectProps {
  styles: any;
  isDarkMode: boolean;
  colors: any;
  onSelectCategory: (category: 'camera' | 'watch') => void;
}

export const StepCategorySelect: React.FC<StepCategorySelectProps> = ({
  styles,
  isDarkMode,
  colors,
  onSelectCategory,
}) => {
  return (
    <View>
      <LocalizedText style={[styles.stepHeaderTitle, isDarkMode && { color: colors.textPrimary }]}>
        Chọn Loại Thiết Bị Cần Thêm
      </LocalizedText>
      <LocalizedText style={[styles.stepHeaderDesc, isDarkMode && { color: colors.textSecondary }]}>
        Chọn loại thiết bị bạn muốn kết nối để bắt đầu theo dõi sức khỏe và an toàn:
      </LocalizedText>

      {/* Option 1: Camera */}
      <TouchableOpacity
        style={[styles.categoryCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => onSelectCategory('camera')}
        activeOpacity={0.8}
      >
        <View style={[styles.categoryIconBox, { backgroundColor: isDarkMode ? colors.surfaceSubtle : '#FFF7ED' }]}>
          <Ionicons name="videocam" size={30} color="#EA580C" />
        </View>
        <View style={styles.categoryInfo}>
          <View style={styles.categoryBadgeRow}>
            <LocalizedText style={[styles.categoryName, isDarkMode && { color: colors.textPrimary }]}>
              Thiết bị Camera
            </LocalizedText>
            <View style={[styles.protoBadge, { backgroundColor: '#FFEDD5' }]}>
              <LocalizedText style={[styles.protoBadgeText, { color: '#C2410C' }]}>Wi-Fi</LocalizedText>
            </View>
          </View>
          <LocalizedText style={[styles.categoryDesc, isDarkMode && { color: colors.textSecondary }]}>
            Camera AI quan sát, tự động phát hiện té ngã và đàm thoại 2 chiều.
          </LocalizedText>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
      </TouchableOpacity>

      {/* Option 2: Đồng hồ thông minh */}
      <TouchableOpacity
        style={[styles.categoryCard, isDarkMode && { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => onSelectCategory('watch')}
        activeOpacity={0.8}
      >
        <View style={[styles.categoryIconBox, { backgroundColor: isDarkMode ? colors.surfaceSubtle : '#ECFDF5' }]}>
          <Ionicons name="watch" size={30} color="#059669" />
        </View>
        <View style={styles.categoryInfo}>
          <View style={styles.categoryBadgeRow}>
            <LocalizedText style={[styles.categoryName, isDarkMode && { color: colors.textPrimary }]}>
              Đồng hồ thông minh
            </LocalizedText>
            <View style={[styles.protoBadge, { backgroundColor: '#D1FAE5' }]}>
              <LocalizedText style={[styles.protoBadgeText, { color: '#047857' }]}>Bluetooth</LocalizedText>
            </View>
          </View>
          <LocalizedText style={[styles.categoryDesc, isDarkMode && { color: colors.textSecondary }]}>
            Theo dõi nhịp tim, SpO₂, thân nhiệt và cảnh báo sức khỏe người cao tuổi.
          </LocalizedText>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
      </TouchableOpacity>
    </View>
  );
};

