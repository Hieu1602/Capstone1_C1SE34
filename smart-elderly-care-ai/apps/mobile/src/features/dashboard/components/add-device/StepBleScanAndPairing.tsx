import React from 'react';
import { View, TouchableOpacity, Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';
import { FlowStep, DiscoveredBleItem } from './types';

interface StepBleScanAndPairingProps {
  currentStep: FlowStep;
  styles: any;
  pulseAnim: Animated.Value;
  isBleScanning: boolean;
  discoveredBleList: DiscoveredBleItem[];
  onTriggerBleScan: () => void;
  onSelectBleDevice: (item: DiscoveredBleItem) => void;
  isBlePairing: boolean;
  isBlePairingSuccess: boolean;
  bleErrorMessage: string;
  onConfirmPairing: () => void;
  onBackToScan: () => void;
}

export const StepBleScanAndPairing: React.FC<StepBleScanAndPairingProps> = ({
  currentStep,
  styles,
  pulseAnim,
  isBleScanning,
  discoveredBleList,
  onTriggerBleScan,
  onSelectBleDevice,
  isBlePairing,
  isBlePairingSuccess,
  bleErrorMessage,
  onConfirmPairing,
  onBackToScan,
}) => {
  return (
    <>
      {/* 5B. STATE: BLE_SCAN */}
      {currentStep === 'BLE_SCAN' && (
        <View>
          <LocalizedText style={styles.stepHeaderTitle}>Màn Hình Radar Quét Thiết Bị</LocalizedText>
          <LocalizedText style={styles.stepHeaderDesc}>
            Đang tìm kiếm các thiết bị xung quanh điện thoại:
          </LocalizedText>

          <View style={styles.radarContainer}>
            <Animated.View
              style={[
                styles.radarCircleOuter,
                {
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
            <View style={styles.radarCircleMid} />
            <View style={styles.radarCenter}>
              <Ionicons name="bluetooth" size={28} color="#FFF" />
            </View>
            <LocalizedText style={styles.radarStatusText}>
              {isBleScanning
                ? 'Đang tìm kiếm thiết bị xung quanh...'
                : discoveredBleList.length > 0
                ? 'Đã tìm thấy thiết bị lân cận'
                : 'Hoàn tất quét radar'}
            </LocalizedText>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 }}>
            <LocalizedText style={styles.sectionHeader}>Thiết bị tìm thấy ({discoveredBleList.length}):</LocalizedText>
            <TouchableOpacity
              onPress={onTriggerBleScan}
              disabled={isBleScanning}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 6,
                paddingHorizontal: 12,
                backgroundColor: isBleScanning ? '#F1F5F9' : '#ECFDF5',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: isBleScanning ? '#E2E8F0' : '#A7F3D0',
              }}
              activeOpacity={0.7}
            >
              {isBleScanning ? (
                <ActivityIndicator size="small" color="#059669" style={{ marginRight: 6 }} />
              ) : (
                <Ionicons name="refresh" size={16} color="#059669" style={{ marginRight: 6 }} />
              )}
              <LocalizedText style={{ fontSize: 13, color: '#059669', fontWeight: '600' }}>
                {isBleScanning ? 'Đang quét...' : 'Quét lại'}
              </LocalizedText>
            </TouchableOpacity>
          </View>

          {discoveredBleList.length === 0 && !isBleScanning && (
            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 24, alignItems: 'center', marginVertical: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Ionicons name="bluetooth-outline" size={48} color="#94A3B8" />
              <LocalizedText style={{ fontSize: 15, fontWeight: '700', color: '#334155', marginTop: 10, textAlign: 'center' }}>
                Chưa tìm thấy thiết bị Bluetooth nào ở gần
              </LocalizedText>
              <LocalizedText style={{ fontSize: 13, color: '#64748B', marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
                Vui lòng bật Bluetooth trên đồng hồ, kiểm tra pin trên 20% và đặt đồng hồ trong phạm vi 1 mét cạnh điện thoại.
              </LocalizedText>
              <TouchableOpacity
                style={{ marginTop: 16, backgroundColor: '#059669', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}
                onPress={onTriggerBleScan}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <LocalizedText style={{ color: '#FFF', fontWeight: '600', fontSize: 14 }}>
                  Thử quét lại
                </LocalizedText>
              </TouchableOpacity>
            </View>
          )}

          {discoveredBleList.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.bleDeviceCard}
              onPress={() => onSelectBleDevice(item)}
              activeOpacity={0.8}
            >
              <View style={[styles.bleIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="watch" size={24} color="#059669" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <LocalizedText style={styles.bleDeviceName}>{item.name}</LocalizedText>
                <LocalizedText style={styles.bleDeviceSub}>Sẵn sàng kết nối</LocalizedText>
                <LocalizedText style={styles.bleServicesText}>{item.services}</LocalizedText>
              </View>
              <View style={styles.bleRssiBox}>
                <LocalizedText style={styles.bleRssiText}>{item.rssi.split(' ')[0]}</LocalizedText>
                <Ionicons name="wifi" size={14} color="#059669" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 6B. STATE: BLE_PAIRING */}
      {currentStep === 'BLE_PAIRING' && (
        <View style={styles.guideContainer}>
          <View style={[styles.visualGraphicBox, { backgroundColor: isBlePairing ? '#ECFDF5' : (isBlePairingSuccess ? '#ECFDF5' : '#FEE2E2') }]}>
            {isBlePairing ? (
              <ActivityIndicator size="large" color="#059669" />
            ) : isBlePairingSuccess ? (
              <Ionicons name="checkmark-circle" size={54} color="#059669" />
            ) : (
              <Ionicons name="close-circle" size={54} color="#DC2626" />
            )}
            <LocalizedText style={[styles.ledText, { marginTop: 12, color: isBlePairing ? '#059669' : (isBlePairingSuccess ? '#059669' : '#DC2626'), fontSize: 16 }]}>
              {isBlePairing
                ? 'Đang kết nối với thiết bị...'
                : isBlePairingSuccess
                ? 'Kết nối thành công!'
                : 'Kết nối thất bại!'}
            </LocalizedText>
          </View>

          <LocalizedText style={styles.guideMainTitle}>
            {isBlePairing
              ? 'Đang Ghép Nối Thiết Bị...'
              : isBlePairingSuccess
              ? 'Ghép Nối Thành Công'
              : 'Không Thể Kết Nối'}
          </LocalizedText>
          <LocalizedText style={styles.guideSubtitle}>
            {isBlePairing
              ? 'Đang đồng bộ dữ liệu sức khỏe từ đồng hồ...'
              : isBlePairingSuccess
              ? 'Đồng hồ đã kết nối thành công và sẵn sàng theo dõi sức khỏe cho người cao tuổi.'
              : (bleErrorMessage || 'Không thể thiết lập kết nối Bluetooth với thiết bị.')}
          </LocalizedText>

          {!isBlePairing && isBlePairingSuccess && (
            <TouchableOpacity
              style={[styles.primaryActionButton, { backgroundColor: '#059669' }]}
              onPress={onConfirmPairing}
              activeOpacity={0.85}
            >
              <LocalizedText style={styles.primaryActionButtonText}>
                Hoàn Tất Ghép Nối → Xem Kết Quả
              </LocalizedText>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
          )}

          {!isBlePairing && !isBlePairingSuccess && (
            <TouchableOpacity
              style={[styles.primaryActionButton, { backgroundColor: '#DC2626' }]}
              onPress={onBackToScan}
              activeOpacity={0.85}
            >
              <LocalizedText style={styles.primaryActionButtonText}>
                Quay Lại Màn Hình Quét Radar
              </LocalizedText>
              <Ionicons name="refresh" size={20} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </>
  );
};

