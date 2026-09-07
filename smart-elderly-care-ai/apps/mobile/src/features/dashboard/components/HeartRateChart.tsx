// HeartRateChart.tsx
// Biểu đồ nhịp tim dạng đường (line chart) với Victory Native

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { VictoryChart, VictoryLine, VictoryArea, VictoryAxis, VictoryTheme } from 'victory-native';

import { vitalsApi } from '../../../services/api';
import { useVitalStore } from '../../../store/useVitalStore';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface DataPoint {
  x: number;   // timestamp
  y: number;   // heart_rate
}

export default function HeartRateChart() {
  const { activeDevice, currentVitals } = useVitalStore();
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [activeDevice]);

  // Append real-time data point
  useEffect(() => {
    if (currentVitals.heart_rate && currentVitals.timestamp) {
      setData((prev: DataPoint[]) => {
        const next = [
          ...prev,
          { x: currentVitals.timestamp!, y: currentVitals.heart_rate! },
        ].slice(-60); // Last 60 data points
        return next;
      });
    }
  }, [currentVitals.heart_rate, currentVitals.timestamp]);

  const loadHistory = async () => {
    if (!activeDevice) return;
    try {
      const res = await vitalsApi.getHistory(activeDevice.device_id, 50);
      const points: DataPoint[] = res.data
        .filter((v: any) => v.heart_rate != null)
        .map((v: any) => ({
          x: new Date(v.time).getTime() / 1000,
          y: v.heart_rate,
        }))
        .reverse();
      setData(points);
    } catch (e) {
      // Sử dụng mock data khi không có API
      setData(
        Array.from({ length: 20 }, (_, i) => ({
          x: Date.now() / 1000 - (20 - i) * 60,
          y: 65 + Math.random() * 20,
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading || data.length === 0) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Đang tải biểu đồ...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VictoryChart
        width={SCREEN_WIDTH - 32}
        height={200}
        padding={{ top: 20, bottom: 40, left: 50, right: 20 }}
        theme={VictoryTheme.material}
      >
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
        <VictoryAxis
          dependentAxis
          style={{
            axis: { stroke: '#334155' },
            tickLabels: { fill: '#64748B', fontSize: 10 },
            grid: { stroke: '#1E293B' },
          }}
          domain={[40, 140]}
        />
        {/* Area fill */}
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
        {/* Line */}
        <VictoryLine
          data={data}
          style={{ data: { stroke: '#EF4444', strokeWidth: 2 } }}
          interpolation="catmullRom"
        />
      </VictoryChart>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
        <Text style={styles.legendText}>Nhịp tim (bpm)</Text>
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
  placeholderText: { color: '#64748B', fontSize: 14 },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: '#94A3B8', fontSize: 12 },
});
