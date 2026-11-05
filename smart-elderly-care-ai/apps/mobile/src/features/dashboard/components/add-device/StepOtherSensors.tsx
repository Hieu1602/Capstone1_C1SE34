import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText, LocalizedTextInput } from '../../../../i18n/LocalizedComponents';
import { FlowStep } from './types';

interface StepOtherSensorsProps {
  currentStep: FlowStep;
  styles: any;
  selectedOtherSensor: string;
  setSelectedOtherSensor: (id: string) => void;
  otherSensorLocation: string;
  setOtherSensorLocation: (loc: string) => void;
  onAddOtherSensor: () => void;
}

export const StepOtherSensors: React.FC<StepOtherSensorsProps> = ({
  currentStep,
  styles,
  selectedOtherSensor,
  setSelectedOtherSensor,
  otherSensorLocation,
  setOtherSensorLocation,
  onAddOtherSensor,
}) => {
  if (currentStep !== 'OTHER_LIST') return null;

  return (
    <View>
      <LocalizedText style={styles.stepHeaderTitle}>Cảm Biến IoT & Edge Hub</LocalizedText>
      <LocalizedText style={styles.stepHeaderDesc}>
        Kết nối cảm biến chuyên sâu qua Edge Hub Orange Pi 5 (EMQX Broker port 1883):
      </LocalizedText>

      {[
        {
          id: 'amg8833',
          name: 'Cảm biến hồng ngoại AMG8833',
          sub: 'Ma trận nhiệt 8x8 IR • Sàng lọc sốt vùng trán',
          icon: 'thermometer',
          color: '#F59E0B',
        },
        {
          id: 'yamnet',
          name: 'Micro AI âm thanh YAMNet',
          sub: 'Phát hiện tiếng kêu cứu, ngã đập mạnh',
          icon: 'mic',
          color: '#8B5CF6',
        },
        {
          id: 'speaker',
          name: 'Loa thông minh Hub Voice Reminder',
          sub: 'Giọng nói tiếng Việt nhắc nhở người cao tuổi',
          icon: 'volume-high',
          color: '#EC4899',
        },
        {
          id: 'sos',
          name: 'Nút bấm khẩn cấp SOS',
          sub: 'Nút bấm 1 chạm gắn đầu giường/nhà tắm',
          icon: 'alert-circle',
          color: '#EF4444',
        },
        {
          id: 'door',
          name: 'Cảm biến cửa ra vào Zigbee',
          sub: 'Cảnh báo người già đi lạc ban đêm',
          icon: 'enter-outline',
          color: '#06B6D4',
        },
      ].map((s) => (
        <TouchableOpacity
          key={s.id}
          style={[
            styles.otherSensorCard,
            selectedOtherSensor === s.id && styles.otherSensorCardActive,
          ]}
          onPress={() => setSelectedOtherSensor(s.id)}
          activeOpacity={0.8}
        >
          <View style={[styles.sensorIconBox, { backgroundColor: `${s.color}15` }]}>
            <Ionicons name={s.icon as any} size={22} color={s.color} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <LocalizedText style={styles.sensorCardTitle}>{s.name}</LocalizedText>
            <LocalizedText style={styles.sensorCardSub}>{s.sub}</LocalizedText>
          </View>
          <Ionicons
            name={selectedOtherSensor === s.id ? 'radio-button-on' : 'radio-button-off'}
            size={20}
            color={selectedOtherSensor === s.id ? '#7C3AED' : '#94A3B8'}
          />
        </TouchableOpacity>
      ))}

      <View style={styles.inputGroup}>
        <LocalizedText style={styles.inputLabel}>Vị trí lắp đặt:</LocalizedText>
        <LocalizedTextInput
          style={styles.textInput}
          value={otherSensorLocation}
          onChangeText={setOtherSensorLocation}
          placeholder="Ví dụ: Phòng khách, Đầu giường Cụ..."
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryActionButton, { backgroundColor: '#7C3AED' }]}
        onPress={onAddOtherSensor}
        activeOpacity={0.85}
      >
        <LocalizedText style={styles.primaryActionButtonText}>
          Thêm Cảm Biến Vào Hệ Thống
        </LocalizedText>
        <Ionicons name="add-circle" size={20} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
};

