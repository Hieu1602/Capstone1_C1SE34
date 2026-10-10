// ============================================================================
// BIỂU ĐỒ NHỊP TIM THỜI GIAN THỰC (HEART RATE CHART)
// Hệ thống: Smart Elderly Care AI (SECA)
// Thư viện: Victory Native (Line Chart + Area Gradient)
// Chức năng:
//   - Tải lịch sử đo nhịp tim gần nhất từ backend thông qua vitalsApi.getHistory
//   - Lắng nghe dữ liệu sinh hiệu thời gian thực từ WebSocket (qua useVitalStore)
//   - Tự động duy trì bộ đệm tối đa 60 điểm đo mới nhất (FIFO rolling window)
//   - Hiển thị trục thời gian (giờ:phút) và khoảng nhịp tim chuẩn (40 - 140 bpm)
// ============================================================================

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { VictoryChart, VictoryLine, VictoryArea, VictoryAxis, VictoryTheme } from 'victory-native';

import { vitalsApi } from '../../../services/api';
import { useVitalStore } from '../../../store/useVitalStore';

// Lấy chiều rộng màn hình để tính toán độ co giãn responsive cho biểu đồ
const SCREEN_WIDTH = Dimensions.get('window').width;

/**
 * Cấu trúc điểm dữ liệu trên biểu đồ nhịp tim
 * - x: Mốc thời gian timestamp tính bằng giây (epoch seconds)
 * - y: Chỉ số nhịp tim thực tế (bpm)
 */
interface DataPoint {
  x: number;   // Timestamp (giây)
  y: number;   // Nhịp tim (bpm)
}

export default function HeartRateChart() {
  // Lấy thông tin thiết bị đang kích hoạt và dữ liệu sinh hiệu thời gian thực từ Store
  const { activeDevice, currentVitals } = useVitalStore();

  // Danh sách các điểm dữ liệu hiển thị trên biểu đồ
  const [data, setData] = useState<DataPoint[]>([]);

  // Trạng thái đang tải dữ liệu lịch sử ban đầu
  const [loading, setLoading] = useState(true);

  // Tải lại lịch sử khi thiết bị theo dõi được thay đổi
  useEffect(() => {
    loadHistory();
  }, [activeDevice]);

  // Cập nhật điểm dữ liệu mới từ luồng phát sinh hiệu thời gian thực (WebSocket)
  useEffect(() => {
    if (currentVitals.heart_rate && currentVitals.timestamp) {
      setData((prev: DataPoint[]) => {
        const next = [
          ...prev,
          { x: currentVitals.timestamp!, y: currentVitals.heart_rate! },
        ].slice(-60); // Duy trì tối đa 60 điểm đo gần nhất trên biểu đồ
        return next;
      });
    }
  }, [currentVitals.heart_rate, currentVitals.timestamp]);

  /**
   * Tải lịch sử 50 bản ghi nhịp tim gần nhất từ Backend API
   * Sử dụng mã thiết bị thực tế từ activeDevice, không dùng mã giả định
   */
  const loadHistory = async () => {
    const devId = activeDevice?.device_id || activeDevice?.id;

    // Nếu người dùng chưa liên kết hoặc chưa kích hoạt thiết bị đo, không truy vấn mã giả định
    if (!devId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      const res = await vitalsApi.getHistory(devId, 50);
      if (res.data && Array.isArray(res.data)) {
        // Lọc các bản ghi có giá trị nhịp tim hợp lệ và chuẩn hóa định dạng thời gian
        const points: DataPoint[] = res.data
          .filter((v: any) => v.heart_rate != null && !isNaN(Number(v.heart_rate)))
          .map((v: any) => ({
            x: new Date(v.time).getTime() / 1000,
            y: Number(v.heart_rate),
          }))
          .reverse(); // Đảo chiều để hiển thị theo thứ tự từ quá khứ đến hiện tại
        setData(points);
      } else {
        setData([]);
      }
    } catch (e) {
      console.warn('[HeartRateChart] Không thể tải lịch sử nhịp tim:', e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Trạng thái đang tải dữ liệu
  if (loading) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Đang tải biểu đồ nhịp tim thực tế...</Text>
      </View>
    );
  }

  // Trạng thái chưa có dữ liệu đo thực tế từ vòng đeo tay
  if (data.length === 0) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Chưa có bản ghi nhịp tim thực tế từ vòng đeo tay.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Vùng vẽ biểu đồ VictoryChart */}
      <VictoryChart
        width={SCREEN_WIDTH - 32}
        height={200}
        padding={{ top: 20, bottom: 40, left: 50, right: 20 }}
        theme={VictoryTheme.material}
      >
        {/* Trục hoành (Thời gian): Hiển thị dạng Giờ:Phút */}
        <VictoryAxis
          style={{
            axis: { stroke: '#334155' },
            tickLabels: { fill: '#64748B', fontSize: 10 },
          }}
          tickFormat={(t: number) => {
            const d = new Date(t * 1000);
            return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
          }}
          tickCount={5}
        />

        {/* Trục tung (Chỉ số nhịp tim): Giới hạn hiển thị từ 40 đến 140 bpm */}
        <VictoryAxis
          dependentAxis
          style={{
            axis: { stroke: '#334155' },
            tickLabels: { fill: '#64748B', fontSize: 10 },
            grid: { stroke: '#1E293B' },
          }}
          domain={[40, 140]}
        />

        {/* Vùng bóng đổ mờ bên dưới đường nhịp tim */}
        <VictoryArea
          data={data}
          style={{
            data: {
              fill: '#EF4444',
              fillOpacity: 0.1,
              stroke: 'transparent',
            },
          }}
          interpolation="catmullRom"
        />

        {/* Đường biểu diễn nhịp tim chính (Màu đỏ cảnh báo y tế) */}
        <VictoryLine
          data={data}
          style={{ data: { stroke: '#EF4444', strokeWidth: 2 } }}
          interpolation="catmullRom"
        />
      </VictoryChart>

      {/* Chú thích biểu đồ (Legend) */}
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
        <Text style={styles.legendText}>Nhịp tim thực tế (bpm)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  placeholder: {
    height: 200,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#64748B',
    fontSize: 14,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: '#94A3B8',
    fontSize: 12,
  },
});
