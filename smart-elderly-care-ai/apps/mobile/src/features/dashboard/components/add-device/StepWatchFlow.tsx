import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';
import { FlowStep } from './types';

interface StepWatchFlowProps {
  currentStep: FlowStep;
  styles: any;
  hasBlePermission: boolean;
  onSelectWatchModel: (model: string) => void;
  onConnectHealthConnect: () => void;
  onOpenHealthConnectSettings?: () => void;
  onContinueBlePowerCheck: () => void;
  onRequestBlePermission: () => void;
  onStartBleScan: () => void;
}

export const StepWatchFlow: React.FC<StepWatchFlowProps> = ({
  currentStep,
  styles,
  hasBlePermission,
  onSelectWatchModel,
  onConnectHealthConnect,
  onOpenHealthConnectSettings,
  onContinueBlePowerCheck,
  onRequestBlePermission,
  onStartBleScan,
}) => {
  return (
    <>
      {/* 2B. STATE: WATCH_LIST */}
      {currentStep === 'WATCH_LIST' && (
        <View>
          <LocalizedText style={styles.stepHeaderTitle}>Chọn Nguồn Dữ Liệu Sức Khỏe</LocalizedText>
          <LocalizedText style={styles.stepHeaderDesc}>
            Chọn phương thức kết nối thiết bị hoặc đồng bộ dữ liệu sức khỏe:
          </LocalizedText>

          {/* Nhánh 1: Vòng đeo tay / Đồng hồ BLE */}
          <TouchableOpacity
            style={[styles.modelCard, styles.modelCardActive, { borderColor: '#10B981' }]}
            onPress={() => onSelectWatchModel('Vòng đeo tay / Đồng hồ Bluetooth BLE')}
            activeOpacity={0.8}
          >
            <View style={[styles.modelIconBox, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="watch" size={26} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.modelHeaderRow}>
                <LocalizedText style={styles.modelTitle}>Đồng hồ / Vòng đeo tay BLE</LocalizedText>
                <View style={[styles.activeTag, { backgroundColor: '#DCFCE7' }]}>
                  <LocalizedText style={[styles.activeTagText, { color: '#15803D' }]}>Trực tiếp</LocalizedText>
                </View>
              </View>
              <LocalizedText style={styles.modelDesc}>
                Đo nhịp tim, nồng độ oxy trong máu SpO₂, thân nhiệt và đếm bước chân liên tục
              </LocalizedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#059669" />
          </TouchableOpacity>

          {/* Nhánh 2: Google Health Connect */}
          <TouchableOpacity
            style={[styles.modelCard, { borderColor: '#7C3AED' }]}
            onPress={() => onSelectWatchModel('Google Health Connect (Android)')}
            activeOpacity={0.8}
          >
            <View style={[styles.modelIconBox, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="fitness" size={26} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.modelHeaderRow}>
                <LocalizedText style={styles.modelTitle}>Google Health Connect</LocalizedText>
                <View style={[styles.activeTag, { backgroundColor: '#EDE9FE' }]}>
                  <LocalizedText style={[styles.activeTagText, { color: '#6D28D9' }]}>Android</LocalizedText>
                </View>
              </View>
              <LocalizedText style={styles.modelDesc}>
                Đồng bộ các chỉ số sức khỏe được hỗ trợ từ Health Connect
              </LocalizedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#7C3AED" />
          </TouchableOpacity>

          <View style={[styles.protocolCheckBanner, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
            <Ionicons name="bluetooth" size={18} color="#059669" />
            <LocalizedText style={[styles.protocolCheckText, { color: '#065F46' }]}>
              Đảm bảo đồng hồ đã mở nguồn và bật Bluetooth trên điện thoại trước khi quét.
            </LocalizedText>
          </View>
        </View>
      )}

      {/* 3C. STATE: HEALTH_CONNECT_SETUP */}
      {currentStep === 'HEALTH_CONNECT_SETUP' && (
        <View style={styles.guideContainer}>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View style={[styles.visualGraphicBox, { backgroundColor: '#EDE9FE', marginBottom: 8 }]}>
              <Ionicons name="fitness" size={50} color="#7C3AED" />
            </View>
            <View style={[styles.ledIndicatorRow, { backgroundColor: '#EDE9FE', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, borderWidth: 1, borderColor: '#DDD6FE', marginTop: 0 }]}>
              <Ionicons name="checkmark-circle" size={16} color="#7C3AED" style={{ marginRight: 4 }} />
              <LocalizedText style={{ fontSize: 12, fontWeight: '700', color: '#7C3AED' }}>
                Google Health Connect
              </LocalizedText>
            </View>
          </View>

          <LocalizedText style={styles.guideMainTitle}>Đồng Bộ Google Health Connect</LocalizedText>
          <LocalizedText style={styles.guideSubtitle}>
            Đồng bộ các chỉ số sức khỏe được hỗ trợ từ Health Connect, tùy thuộc vào thiết bị, ứng dụng nguồn và quyền truy cập đã cấp.
          </LocalizedText>

          <View style={styles.instructionsList}>
            <View style={styles.instItem}>
              <View style={[styles.instNumber, { backgroundColor: '#7C3AED' }]}>
                <LocalizedText style={styles.instNumberText}>1</LocalizedText>
              </View>
              <LocalizedText style={styles.instText}>
                Đảm bảo điện thoại Android của bạn đã cài đặt hoặc kích hoạt dịch vụ Health Connect.
              </LocalizedText>
            </View>

            <View style={styles.instItem}>
              <View style={[styles.instNumber, { backgroundColor: '#7C3AED' }]}>
                <LocalizedText style={styles.instNumberText}>2</LocalizedText>
              </View>
              <LocalizedText style={styles.instText}>
                Ứng dụng của đồng hồ đã hỗ trợ và bật chia sẻ dữ liệu vào Health Connect.
              </LocalizedText>
            </View>

            <View style={styles.instItem}>
              <View style={[styles.instNumber, { backgroundColor: '#7C3AED' }]}>
                <LocalizedText style={styles.instNumberText}>3</LocalizedText>
              </View>
              <LocalizedText style={styles.instText}>
                Nhấn nút bên dưới để cấp quyền đọc các chỉ số sức khỏe cho ứng dụng SECA.
              </LocalizedText>
            </View>
          </View>

          <View style={[styles.continueButtonSection, { width: '100%', alignSelf: 'stretch' }]}>
            <TouchableOpacity
              style={[styles.primaryActionButton, { backgroundColor: '#7C3AED' }]}
              onPress={onConnectHealthConnect}
              activeOpacity={0.85}
            >
              <LocalizedText style={styles.primaryActionButtonText}>
                Cấp Quyền & Đồng Bộ Ngay
              </LocalizedText>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>

            {onOpenHealthConnectSettings && (
              <TouchableOpacity
                style={{
                  marginTop: 12,
                  borderColor: '#7C3AED',
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingVertical: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#F5F3FF',
                }}
                onPress={onOpenHealthConnectSettings}
                activeOpacity={0.8}
              >
                <Ionicons name="settings-outline" size={18} color="#7C3AED" style={{ marginRight: 8 }} />
                <LocalizedText style={{ color: '#7C3AED', fontWeight: '600', fontSize: 14 }}>
                  Mở Cài Đặt Health Connect
                </LocalizedText>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}



      {/* 3B. STATE: BLE_POWER_CHECK */}
      {currentStep === 'BLE_POWER_CHECK' && (
        <View style={styles.guideContainer}>
          <View style={[styles.visualGraphicBox, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="bluetooth" size={54} color="#059669" />
            <View style={styles.ledIndicatorRow}>
              <Ionicons name="battery-charging" size={18} color="#059669" />
              <LocalizedText style={[styles.ledText, { color: '#059669' }]}>Đồng hồ đã bật nguồn</LocalizedText>
            </View>
          </View>

          <LocalizedText style={styles.guideMainTitle}>Mở Nguồn & Bật Bluetooth Đồng Hồ</LocalizedText>
          <LocalizedText style={styles.guideSubtitle}>
            Chuẩn bị thiết bị trước khi tiến hành quét sóng BLE:
          </LocalizedText>

          <View style={styles.instructionsList}>
            <View style={styles.instItem}>
              <View style={[styles.instNumber, { backgroundColor: '#10B981' }]}>
                <LocalizedText style={styles.instNumberText}>1</LocalizedText>
              </View>
              <LocalizedText style={styles.instText}>
                Nhấn giữ nút nguồn cạnh bên đồng hồ để màn hình sáng lên.
              </LocalizedText>
            </View>

            <View style={styles.instItem}>
              <View style={[styles.instNumber, { backgroundColor: '#10B981' }]}>
                <LocalizedText style={styles.instNumberText}>2</LocalizedText>
              </View>
              <LocalizedText style={styles.instText}>
                Đảm bảo pin đồng hồ còn trên 20% và biểu tượng Bluetooth đang sẵn sàng kết nối.
              </LocalizedText>
            </View>

            <View style={styles.instItem}>
              <View style={[styles.instNumber, { backgroundColor: '#10B981' }]}>
                <LocalizedText style={styles.instNumberText}>3</LocalizedText>
              </View>
              <LocalizedText style={styles.instText}>
                Đặt đồng hồ ngay cạnh điện thoại trong khoảng cách dưới 1 mét để tín hiệu ổn định nhất.
              </LocalizedText>
            </View>
          </View>

          <View style={[styles.continueButtonSection, { width: '100%', alignSelf: 'stretch' }]}>
            <TouchableOpacity
              style={[styles.primaryActionButton, { backgroundColor: '#059669' }]}
              onPress={onContinueBlePowerCheck}
              activeOpacity={0.85}
            >
              <LocalizedText style={styles.primaryActionButtonText}>Tiếp Tục</LocalizedText>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 4B. STATE: BLE_PERMISSION */}
      {currentStep === 'BLE_PERMISSION' && (
        <View>
          <LocalizedText style={styles.stepHeaderTitle}>Kiểm Tra Quyền Hệ Điều Hành (OS)</LocalizedText>
          <LocalizedText style={styles.stepHeaderDesc}>
            Để quét tìm và kết nối đồng hồ, ứng dụng cần được cấp quyền Bluetooth:
          </LocalizedText>

          <View style={styles.permissionCard}>
            <View style={styles.permRow}>
              <View style={[styles.permIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="bluetooth" size={22} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <LocalizedText style={styles.permTitle}>Quyền Bluetooth Scan & Connect</LocalizedText>
                <LocalizedText style={styles.permDesc}>Cho phép app quét tìm và kết nối kênh GATT với đồng hồ</LocalizedText>
              </View>
              <Ionicons
                name={hasBlePermission ? 'checkmark-circle' : 'alert-circle'}
                size={24}
                color={hasBlePermission ? '#10B981' : '#F59E0B'}
              />
            </View>
          </View>

          {!hasBlePermission ? (
            <View style={styles.unauthorizedBox}>
              <Ionicons name="lock-closed" size={20} color="#DC2626" />
              <LocalizedText style={styles.unauthorizedText}>
                Trạng thái: <LocalizedText style={{ fontWeight: 'bold' }}>Chưa cấp quyền</LocalizedText>. Nhấn nút bên dưới để mở popup yêu cầu quyền hệ điều hành.
              </LocalizedText>
            </View>
          ) : (
            <View style={styles.authorizedBox}>
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
              <LocalizedText style={styles.authorizedText}>
                Trạng thái: <LocalizedText style={{ fontWeight: 'bold' }}>Đã cấp quyền thành công</LocalizedText>! Bạn có thể chuyển sang quét Radar.
              </LocalizedText>
            </View>
          )}

          {!hasBlePermission ? (
            <TouchableOpacity
              style={[styles.primaryActionButton, { backgroundColor: '#2563EB' }]}
              onPress={onRequestBlePermission}
              activeOpacity={0.85}
            >
              <LocalizedText style={styles.primaryActionButtonText}>
                Cấp Quyền Bluetooth
              </LocalizedText>
              <Ionicons name="key" size={20} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryActionButton, { backgroundColor: '#059669' }]}
              onPress={onStartBleScan}
              activeOpacity={0.85}
            >
              <LocalizedText style={styles.primaryActionButtonText}>
                Bắt Đầu Quét Thiết Bị
              </LocalizedText>
              <Ionicons name="radio" size={20} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </>
  );
};

