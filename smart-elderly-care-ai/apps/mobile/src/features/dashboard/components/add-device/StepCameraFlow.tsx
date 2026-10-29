import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText } from '../../../../i18n/LocalizedComponents';
import { FlowStep } from './types';

interface StepCameraFlowProps {
  currentStep: FlowStep;
  styles: any;
  onSelectCameraModel: (model: string) => void;
  onGoToWifiGuide: () => void;
  onPressAlreadyConnected: () => void;
  onOpenResetGuide: () => void;
}

export const StepCameraFlow: React.FC<StepCameraFlowProps> = ({
  currentStep,
  styles,
  onSelectCameraModel,
  onGoToWifiGuide,
  onPressAlreadyConnected,
  onOpenResetGuide,
}) => {
  return (
    <>
      {/* 2A. STATE: CAMERA_LIST */}
      {currentStep === 'CAMERA_LIST' && (
        <View>
          <LocalizedText style={styles.stepHeaderTitle}>Chọn Model Camera</LocalizedText>
          <LocalizedText style={styles.stepHeaderDesc}>
            Danh sách camera giám sát thông minh:
          </LocalizedText>

          <TouchableOpacity
            style={[styles.modelCard, styles.modelCardActive]}
            onPress={() => onSelectCameraModel('SECA_001')}
            activeOpacity={0.8}
          >
            <View style={[styles.modelIconBox, { backgroundColor: '#FFEDD5' }]}>
              <Ionicons name="videocam" size={26} color="#EA580C" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.modelHeaderRow}>
                <LocalizedText style={styles.modelTitle}>SECA_001</LocalizedText>
                <View style={styles.activeTag}>
                  <LocalizedText style={styles.activeTagText}>Hiện có</LocalizedText>
                </View>
              </View>
              <LocalizedText style={styles.modelDesc}>
                Tự động nhận diện té ngã, đàm thoại 2 chiều và quan sát ban đêm
              </LocalizedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#EA580C" />
          </TouchableOpacity>

          <View style={styles.protocolCheckBanner}>
            <Ionicons name="flash" size={18} color="#0284C7" />
            <LocalizedText style={styles.protocolCheckText}>
              Hệ thống sẽ hướng dẫn bạn kết nối điện thoại với Camera.
            </LocalizedText>
          </View>
        </View>
      )}

      {/* 3A. STATE: WIFI_POWER_CHECK */}
      {currentStep === 'WIFI_POWER_CHECK' && (
        <View style={styles.guideContainer}>
          <View style={styles.visualGraphicBox}>
            <Ionicons name="power" size={54} color="#EA580C" />
            <View style={styles.ledIndicatorRow}>
              <View style={[styles.ledDot, styles.ledRed]} />
              <View style={[styles.ledDot, styles.ledGreen]} />
              <LocalizedText style={styles.ledText}>Đèn LED chớp Đỏ & Xanh</LocalizedText>
            </View>
          </View>

          <LocalizedText style={styles.guideMainTitle}>Cắm Nguồn & Kiểm Tra Đèn LED</LocalizedText>
          <LocalizedText style={styles.guideSubtitle}>
            Thực hiện theo các bước kiểm tra nguồn ban đầu:
          </LocalizedText>

          <View style={styles.instructionsList}>
            <View style={styles.instItem}>
              <View style={styles.instNumber}>
                <LocalizedText style={styles.instNumberText}>1</LocalizedText>
              </View>
              <LocalizedText style={styles.instText}>
                Cắm dây nguồn vào cổng nguồn Camera và kết nối ổ điện gia đình.
              </LocalizedText>
            </View>

            <View style={styles.instItem}>
              <View style={styles.instNumber}>
                <LocalizedText style={styles.instNumberText}>2</LocalizedText>
              </View>
              <LocalizedText style={styles.instText}>
                Đợi khoảng 30 giây cho Camera hoàn tất tiến trình tự kiểm tra ban đầu.
              </LocalizedText>
            </View>

            <View style={styles.instItem}>
              <View style={styles.instNumber}>
                <LocalizedText style={styles.instNumberText}>3</LocalizedText>
              </View>
              <LocalizedText style={styles.instText}>
                Quan sát đèn LED ở mặt trước: Đèn phải{' '}
                <LocalizedText style={{ fontWeight: 'bold', color: '#EA580C' }}>
                  nhấp nháy luân phiên Đỏ và Xanh
                </LocalizedText>{' '}
                (Báo hiệu Camera đang ở chế độ SoftAP chờ kết nối).
              </LocalizedText>
            </View>
          </View>

          <TouchableOpacity
            style={styles.ledHelpQuestionCard}
            onPress={onOpenResetGuide}
            activeOpacity={0.8}
          >
            <View style={styles.ledHelpIconCircle}>
              <Ionicons name="help" size={18} color="#0284C7" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <LocalizedText style={styles.ledHelpQuestionTitle}>
                Đèn LED không nhấp nháy Đỏ / Xanh?
              </LocalizedText>
              <LocalizedText style={styles.ledHelpQuestionSubtitle}>
                Bấm vào đây để xem hướng dẫn reset thủ công Camera SECA_001
              </LocalizedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#0284C7" />
          </TouchableOpacity>

          <View style={[styles.continueButtonSection, { width: '100%', alignSelf: 'stretch' }]}>
            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={onGoToWifiGuide}
              activeOpacity={0.85}
            >
              <LocalizedText style={styles.primaryActionButtonText}>Tiếp Tục</LocalizedText>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 4A. STATE: WIFI_GUIDE */}
      {currentStep === 'WIFI_GUIDE' && (
        <View style={styles.softApGuideContainer}>
          <LocalizedText style={styles.softApGuideTitle}>Kết nối đến thiết bị SECA của bạn</LocalizedText>

          <LocalizedText style={styles.softApGuideSubtitle}>
            Đi tới cài đặt Wi-Fi của điện thoại hoặc máy tính bảng và tham gia mạng thiết bị SECA của bạn:{' '}
            <LocalizedText style={{ fontWeight: 'bold', color: '#0F172A' }}>SECA_001</LocalizedText>. Sau đó quay lại ứng dụng này.
          </LocalizedText>

          <LocalizedText style={styles.guideDetailText}>
            001 là ba chữ số cuối cùng của địa chỉ MAC duy nhất của thiết bị SECA. Bạn có thể tìm thấy nó dưới đế thiết bị SECA của mình.
          </LocalizedText>

          <View style={styles.barcodeGraphicWrapper}>
            <View style={styles.enlargedBarcodeCard}>
              <View style={styles.barcodeBarsRow}>
                {[3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 4, 2, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3].map((w, idx) => (
                  <View
                    key={idx}
                    style={{
                      width: w,
                      height: 26,
                      backgroundColor: '#0F172A',
                      marginRight: idx % 4 === 0 ? 3 : 1.5,
                    }}
                  />
                ))}
              </View>
              <LocalizedText style={styles.barcodeMacText}>MAC: AC-67-B2-3F-00-01</LocalizedText>
              <LocalizedText style={styles.barcodeSsidBadge}>SSID: SECA_001</LocalizedText>
            </View>

            <View style={styles.projectionCone} />

            <View style={styles.cameraBaseCircle}>
              <View style={[styles.rubberFoot, styles.rubberFootTop]} />
              <View style={[styles.rubberFoot, styles.rubberFootLeft]} />
              <View style={[styles.rubberFoot, styles.rubberFootRight]} />

              <View style={styles.cameraBaseInnerRing}>
                <View style={styles.cameraBaseCenterHole} />
              </View>

              <View style={styles.miniBarcodeSticker}>
                <View style={styles.miniBarcodeBars}>
                  {[2, 1, 2, 1, 3, 1, 2, 1, 2, 1, 3, 1].map((w, i) => (
                    <View
                      key={i}
                      style={{
                        width: w,
                        height: 10,
                        backgroundColor: '#64748B',
                        marginRight: 1,
                      }}
                    />
                  ))}
                </View>
                <LocalizedText style={styles.miniBarcodeText}>MAC:••-••-••-00-01</LocalizedText>
              </View>
            </View>
          </View>

          <View style={styles.bottomActionSection}>
            <TouchableOpacity
              style={styles.primaryPillBtn}
              onPress={onPressAlreadyConnected}
              activeOpacity={0.85}
            >
              <LocalizedText style={styles.primaryPillBtnText}>Tôi đã kết nối</LocalizedText>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );
};

