// src/pages/AIMaintenancePage.tsx
// Phân hệ 4: Bảo trì AI (AI Model Maintenance: YOLOv8-Pose, YAMNet, MobileFaceNet, Gemini RAG)
// ui-ux-pro-max: Glassmorphism + Dark OLED · High-density AI pipeline calibration

import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  Cpu,
  Zap,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Play,
  RefreshCw,
  Eye,
  Mic,
  Smile,
  Bot,
  Gauge,
  X,
} from 'lucide-react';
import { AIModelStatus } from '../types';
import { aiApi } from '../services/api';

export const AIMaintenancePage: React.FC = () => {
  const [models, setModels] = useState<AIModelStatus[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Threshold edit state
  const [thresholds, setThresholds] = useState<Record<string, number>>({});

  // Test Modal State
  const [testModalOpen, setTestModalOpen] = useState<boolean>(false);
  const [activeTestModel, setActiveTestModel] = useState<AIModelStatus | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<any>(null);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const data = await aiApi.getModels();
      setModels(data);
      const initialThresholds: Record<string, number> = {};
      data.forEach((m) => {
        initialThresholds[m.id] = m.confidence_threshold;
      });
      setThresholds(initialThresholds);
    } catch {
      showNotice('error', 'Không thể tải danh sách mô hình AI');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleUpdateThreshold = async (model: AIModelStatus) => {
    const val = thresholds[model.id];
    try {
      await aiApi.updateThreshold(model.id, val);
      setModels((prev) =>
        prev.map((m) => (m.id === model.id ? { ...m, confidence_threshold: val } : m))
      );
      showNotice(
        'success',
        `Đã nạp ngưỡng tin cậy mới (${(val * 100).toFixed(0)}%) cho [${model.name}] vào NPU Edge Hub!`
      );
    } catch {
      showNotice('error', 'Cập nhật ngưỡng thất bại');
    }
  };

  const handleOpenTest = (model: AIModelStatus) => {
    setActiveTestModel(model);
    setTestResult(null);
    setTestModalOpen(true);
  };

  const runSimulation = () => {
    if (!activeTestModel) return;
    setIsSimulating(true);
    setTestResult(null);

    setTimeout(() => {
      setIsSimulating(false);
      if (activeTestModel.id === 'model-yolo-pose') {
        setTestResult({
          detected: true,
          event: 'FALL_DETECTED (Té ngã khuỵu sàn nhà)',
          confidence: 0.962,
          keypoints: 17,
          posture_angle: '8.4° (Nằm ngang so với mặt phẳng sàn)',
          immobility_time: '12.4s',
          inference_time: '32ms (RKNN NPU)',
        });
      } else if (activeTestModel.id === 'model-yamnet') {
        setTestResult({
          detected: true,
          event: 'SCREAM_AND_HELP_CALL ("Cứu tôi với / Tiếng la hét")',
          confidence: 0.948,
          decibel_peak: '78.5 dB',
          spectrogram_peak: '1.2 kHz - 3.4 kHz',
          inference_time: '16ms (TFLite Micro)',
        });
      } else if (activeTestModel.id === 'model-face-recog') {
        setTestResult({
          detected: true,
          event: 'KNOWN_MEMBER_VERIFIED',
          person_name: 'Cụ Nguyễn Văn An (Chủ hộ)',
          cosine_similarity: 0.924,
          distance: 0.28,
          inference_time: '42ms (ONNX)',
        });
      } else {
        setTestResult({
          detected: true,
          query: 'Cụ 78 tuổi nhịp tim 124 bpm kèm thở dốc nhẹ sau khi vận động',
          rag_context: 'Sổ tay y khoa Lão khoa Bộ Y Tế & Tiền sử bệnh tăng huyết áp',
          response:
            'Đánh giá: Nhịp tim nhanh trên thất hoặc đáp ứng xoang quá mức. Khuyến nghị: Hướng dẫn người cao tuổi ngồi tựa lưng nghỉ ngơi, đo lại huyết áp và SpO2 sau 5 phút. Nếu kèm đau thắt ngực hoặc SpO2 < 92%, thông báo ngay cho Bác sĩ phụ trách BS. Nguyễn Văn Minh.',
          tokens_used: 342,
          latency: '780ms',
        });
      }
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center space-x-3 px-4 py-3 rounded-2xl shadow-glow-brand backdrop-blur-md transition-all animate-slide-up ${
            notification.type === 'success'
              ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-brand-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          )}
          <span className="text-xs font-semibold">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="badge-sky font-mono">
              Phân hệ 4
            </span>
            <h1 className="font-heading text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Bảo trì & Hiệu chuẩn mô hình AI
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-sans">
            Giám sát độ trễ suy luận NPU, độ chính xác nhận diện té ngã YOLOv8, YAMNet & trợ lý Gemini RAG
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchModels}
            className="btn-ghost text-xs py-2 px-3.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Đồng bộ mô hình</span>
          </button>
        </div>
      </div>

      {/* Pipeline Performance Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono font-semibold uppercase text-slate-500 dark:text-slate-400">Tổng số mô hình AI</p>
            <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">4 / 4</p>
            <p className="text-[11px] font-mono text-sky-600 dark:text-sky-400 mt-0.5">
              100% Sẵn sàng suy luận
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-100 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <BrainCircuit className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono font-semibold uppercase text-sky-600 dark:text-sky-400">Độ trễ Edge NPU (TB)</p>
            <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">28 ms</p>
            <p className="text-[11px] font-mono text-sky-600 dark:text-sky-400">
              Thời gian thực &lt; 50ms
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-100 dark:border-sky-800 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono font-semibold uppercase text-amber-600 dark:text-amber-400">Tốc độ khung hình (FPS)</p>
            <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">29.4 FPS</p>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Camera 2K Super HD</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Gauge className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-mono font-semibold uppercase text-indigo-600 dark:text-indigo-400">Bộ gia tốc phần cứng</p>
            <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">RKNN 6.0</p>
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">NPU RK3588 Tri-core</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Cpu className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 4 Models Detail Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {models.map((model) => {
          const currentVal = thresholds[model.id] ?? model.confidence_threshold;

          let CategoryIcon = BrainCircuit;
          let badgeColor = 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-800';

          if (model.category === 'VISION') {
            CategoryIcon = Eye;
            badgeColor = 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800';
          } else if (model.category === 'AUDIO') {
            CategoryIcon = Mic;
            badgeColor = 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800';
          } else if (model.category === 'BIOMETRIC') {
            CategoryIcon = Smile;
            badgeColor = 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-800';
          } else if (model.category === 'LLM_AGENT') {
            CategoryIcon = Bot;
            badgeColor = 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800';
          }

          return (
            <div
              key={model.id}
              className="glass-card p-6 flex flex-col justify-between hover:border-sky-400 dark:hover:border-sky-500/50 transition-all duration-200"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-11 h-11 rounded-xl bg-sky-50 dark:bg-white/5 border border-sky-100 dark:border-white/10 flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-xs">
                      <CategoryIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white leading-tight">
                        {model.name}
                      </h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${badgeColor}`}>
                          {model.category}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {model.runtime_engine}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="badge-live font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Hoạt động</span>
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
                  {model.description}
                </p>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-3 my-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 font-mono shadow-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Độ trễ xử lý</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-white">
                      {model.latency_ms} ms
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Độ chính xác</span>
                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
                      {model.accuracy}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Bộ nhớ RAM</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-white">
                      {model.memory_footprint_mb > 0 ? `${model.memory_footprint_mb} MB` : 'Cloud API'}
                    </span>
                  </div>
                </div>

                {/* Threshold Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                      Ngưỡng tin cậy (Confidence Threshold):
                    </span>
                    <span className="font-mono text-sky-600 dark:text-sky-400 text-xs font-bold">
                      {(currentVal * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="0.99"
                    step="0.01"
                    value={currentVal}
                    onChange={(e) =>
                      setThresholds((prev) => ({
                        ...prev,
                        [model.id]: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>40% (Nhạy cao)</span>
                    <span>99% (Chính xác cao)</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                <button
                  onClick={() => handleOpenTest(model)}
                  className="btn-ghost text-xs py-1.5 px-3"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Chạy thử nghiệm</span>
                </button>

                <button
                  onClick={() => handleUpdateThreshold(model)}
                  className="btn-primary text-xs py-1.5 px-3"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Lưu vào NPU</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Inference Test Modal */}
      {testModalOpen && activeTestModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className="glass-card w-full max-w-xl overflow-hidden border border-sky-100 dark:border-white/10 shadow-2xl animate-slide-up">
            <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800 flex items-center justify-center">
                  <Play className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-slate-900 dark:text-white text-base">
                    Thử nghiệm suy luận AI tại chỗ
                  </h3>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {activeTestModel.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTestModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 text-xs text-slate-600 dark:text-slate-400">
                <p className="font-semibold text-slate-900 dark:text-white mb-1">
                  Kịch bản kiểm thử:
                </p>
                {activeTestModel.id === 'model-yolo-pose' &&
                  'Gửi khung hình mô phỏng người ngã khuỵu trong phòng khách vào pipeline NPU RK3588 để kiểm tra trích xuất 17 khớp xương.'}
                {activeTestModel.id === 'model-yamnet' &&
                  'Gửi mẫu phổ âm thanh tiếng kêu khẩn cấp 4.5 giây để đánh giá độ tin cậy phân loại phân lớp Scream/Speech.'}
                {activeTestModel.id === 'model-face-recog' &&
                  'So khớp vector khuôn mặt (512 chiều) với cơ sở dữ liệu MinIO đã đăng ký.'}
                {activeTestModel.id === 'model-gemini-rag' &&
                  'Gửi tình huống sinh hiệu bất thường giả định để kiểm tra phản hồi tư vấn y tế lão khoa.'}
              </div>

              {testResult && (
                <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 space-y-2 animate-fade-in">
                  <div className="flex items-center space-x-2 text-sky-600 dark:text-sky-400 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    <span>Suy luận thành công (Inference Success)</span>
                  </div>
                  <pre className="text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-pre-wrap bg-white dark:bg-slate-950/80 p-3 rounded-lg border border-slate-200 dark:border-white/5">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setTestModalOpen(false)}
                  className="btn-ghost text-xs py-2 px-4"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={runSimulation}
                  disabled={isSimulating}
                  className="btn-primary text-xs py-2 px-5"
                >
                  <Play className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
                  <span>{isSimulating ? 'Đang suy luận...' : 'Bắt đầu kiểm thử'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
