import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';
import { FlowStep, SetupSuccessInfo } from './types';

interface StepSetupSuccessProps {
  currentStep: FlowStep;
  styles: any;
  successInfo: SetupSuccessInfo;
  onNavigateDevices: () => void;
  onNavigateHome: () => void;
  onNavigateCamera?: () => void;
}

export const StepSetupSuccess: React.FC<StepSetupSuccessProps> = ({
  currentStep,
  styles,
  successInfo,
  onNavigateDevices,
  onNavigateHome,
  onNavigateCamera,
}) => {
  if (currentStep !== 'SETUP_SUCCESS') return null;

  const isCamera = successInfo.icon === 'videocam' || successInfo.type.toLowerCase().includes('camera');

  return (
    <View style={styles.successContainer}>
      <View style={styles.successIconOuter}>
        <View style={styles.successIconInner}>
          <Ionicons name="checkmark" size={48} color="#FFF" />
        </View>
      </View>

      <LocalizedText style={styles.successTitle}>Cấu Hình Thành Công!</LocalizedText>
      <LocalizedText style={styles.successSubtitle}>
        Thiết bị đã được kết nối và tích hợp vào hệ sinh thái giám sát an sinh người cao tuổi.
      </LocalizedText>

      <View style={styles.successDetailCard}>
        <View style={styles.successHeaderRow}>
          <View style={[styles.successBadgeIcon, { backgroundColor: `${successInfo.color}20` }]}>
            <Ionicons name={successInfo.icon as any} size={24} color={successInfo.color} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <LocalizedText style={styles.successDeviceName}>{successInfo.name}</LocalizedText>
            <LocalizedText style={styles.successDeviceType}>{successInfo.type}</LocalizedText>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.successRow}>
          <LocalizedText style={styles.successLabel}>Kiểu kết nối:</LocalizedText>
          <LocalizedText style={styles.successValue}>{successInfo.protocol}</LocalizedText>
        </View>

        <View style={styles.successRow}>
          <LocalizedText style={styles.successLabel}>Chi tiết:</LocalizedText>
          <LocalizedText style={styles.successValue}>{successInfo.details}</LocalizedText>
        </View>

        <View style={styles.successRow}>
          <LocalizedText style={styles.successLabel}>Vị trí / Người đeo:</LocalizedText>
          <LocalizedText style={[styles.successValue, { color: '#059669', fontWeight: 'bold' }]}>
            {successInfo.location}
          </LocalizedText>
        </View>

        <View style={styles.successRow}>
          <LocalizedText style={styles.successLabel}>Trạng thái:</LocalizedText>
          <LocalizedText style={[styles.successValue, { color: '#10B981', fontWeight: 'bold' }]}>
            ● Trực tuyến & Hoạt động tốt
          </LocalizedText>
        </View>
      </View>

      {isCamera && onNavigateCamera && (
        <TouchableOpacity
          style={[styles.primaryActionButton, { backgroundColor: '#1D4ED8', marginBottom: 12 }]}
          onPress={onNavigateCamera}
          activeOpacity={0.85}
        >
          <Ionicons name="videocam" size={20} color="#FFF" />
          <LocalizedText style={styles.primaryActionButtonText}>
            Xem Camera Trực Tiếp Ngay
          </LocalizedText>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.primaryActionButton, { backgroundColor: '#0284C7', marginBottom: 12 }]}
        onPress={onNavigateDevices}
        activeOpacity={0.85}
      >
        <Ionicons name="list" size={20} color="#FFF" />
        <LocalizedText style={styles.primaryActionButtonText}>
          Xem Danh Sách Thiết Bị
        </LocalizedText>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.primaryActionButton, { backgroundColor: '#F1F5F9' }]}
        onPress={onNavigateHome}
        activeOpacity={0.85}
      >
        <Ionicons name="home" size={20} color="#1E293B" />
        <LocalizedText style={[styles.primaryActionButtonText, { color: '#1E293B' }]}>
          Về Màn Hình Chính (Home)
        </LocalizedText>
      </TouchableOpacity>
    </View>
  );
};
