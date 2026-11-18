import React from 'react';
import { Activity, Info, Sliders, X } from 'lucide-react';
import { Device } from '../../types';
import { DeviceFormConfig } from './deviceMeta';

interface DeviceConfigModalProps {
  isOpen: boolean;
  device: Device | null;
  formConfig: DeviceFormConfig;
  setFormConfig: React.Dispatch<React.SetStateAction<DeviceFormConfig>>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const SMARTBAND_NUMBER_FIELDS: {
  key: keyof Pick<DeviceFormConfig, 'hrHigh' | 'hrLow' | 'spo2Low' | 'fallImpact'>;
  label: string;
  min: number;
  max: number;
  step?: number;
  hint: string;
}[] = [
  {
    key: 'hrHigh',
    label: 'Nhịp tim tối đa cảnh báo (bpm)',
    min: 80,
    max: 220,
    hint: 'Mặc định: 120 bpm (Nhịp nhanh)',
  },
  {
    key: 'hrLow',
    label: 'Nhịp tim tối thiểu cảnh báo (bpm)',
    min: 30,
    max: 70,
    hint: 'Mặc định: 50 bpm (Nhịp chậm)',
  },
  {
    key: 'spo2Low',
    label: 'Ngưỡng SpO2 suy hô hấp (%)',
    min: 70,
    max: 98,
    hint: 'Mặc định: < 90% (Hạ oxy máu)',
  },
  {
    key: 'fallImpact',
    label: 'Gia tốc va đập té ngã (g)',
    min: 1.0,
    max: 5.0,
    step: 0.1,
    hint: 'Mặc định: 2.5g (MPU6050/ADXL)',
  },
];

export const DeviceConfigModal: React.FC<DeviceConfigModalProps> = ({
  isOpen,
  device,
  formConfig,
  setFormConfig,
  onClose,
  onSubmit,
}) => {
  if (!isOpen || !device) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fade-in">
      <div className="glass-card w-full max-w-xl overflow-hidden border border-sky-100 dark:border-[#454A53] dark:bg-[#17191E] shadow-2xl animate-slide-up">
        <div className="p-5 border-b border-slate-100 dark:border-[#454A53] dark:bg-[#202329] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-[#FF6B35]/15 text-sky-600 dark:text-[#FF6B35] border border-sky-100 dark:border-[#FF6B35]/30 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-slate-900 dark:text-[#F5F6F8] text-base">
                Cấu hình tham số & Ngưỡng IoT
              </h3>
              <p className="text-xs font-mono text-slate-500 dark:text-[#A1A7B1]">
                {device.name} ({device.device_id})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-[#A1A7B1] dark:hover:text-[#F5F6F8] hover:bg-slate-100 dark:hover:bg-[#292D34] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Clinical Profile Binding */}
          <div className="p-3.5 rounded-xl bg-sky-50/50 dark:bg-[#202329] border border-sky-200/70 dark:border-[#454A53] space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-800 dark:text-[#FF8A50]">
              <Activity className="w-4 h-4" />
              <span>Gắn thiết bị với Hồ sơ Người cao tuổi & Bác sĩ phụ trách</span>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-[#A1A7B1] mb-1">
                Người cao tuổi sử dụng:
              </label>
              <input
                type="text"
                required
                value={formConfig.assignedElderly}
                onChange={(e) => setFormConfig((prev) => ({ ...prev, assignedElderly: e.target.value }))}
                className="input-glass w-full"
                placeholder="Tên Cụ và tuổi"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-[#A1A7B1] mb-1">
                  Bác sĩ / Chuyên gia chỉ định: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formConfig.doctorApprovedBy}
                  onChange={(e) => setFormConfig((prev) => ({ ...prev, doctorApprovedBy: e.target.value }))}
                  className="input-glass w-full"
                  placeholder="BS. Trần Văn Minh"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-[#A1A7B1] mb-1">
                  Lý do hiệu chuẩn lâm sàng: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formConfig.clinicalReason}
                  onChange={(e) => setFormConfig((prev) => ({ ...prev, clinicalReason: e.target.value }))}
                  className="input-glass w-full"
                  placeholder="Hiệu chuẩn theo bệnh án"
                />
              </div>
            </div>
          </div>

          {/* SMARTBAND Specific Thresholds */}
          {device.device_type === 'SMARTBAND' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-700 dark:text-amber-300 flex items-start space-x-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Các ngưỡng này điều khiển thuật toán phát hiện bất thường ngay trên vòng đeo và Edge Hub trước khi gửi cảnh báo cấp cứu đến ứng dụng người nhà.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {SMARTBAND_NUMBER_FIELDS.map((field) => (
                  <div key={field.key}>
                    <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-[#A1A7B1] mb-1.5">
                      {field.label}
                    </label>
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={formConfig[field.key]}
                      onChange={(e) =>
                        setFormConfig((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))
                      }
                      className="input-glass font-mono"
                    />
                    <span className="text-[10px] text-slate-500 font-mono">{field.hint}</span>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-[#A1A7B1] mb-1.5">
                  Thời gian bất động sau va đập (giây)
                </label>
                <input
                  type="number"
                  min="3"
                  max="60"
                  value={formConfig.immobilitySec}
                  onChange={(e) => setFormConfig((prev) => ({ ...prev, immobilitySec: Number(e.target.value) }))}
                  className="input-glass font-mono"
                />
                <span className="text-[10px] text-slate-500 font-mono">
                  Nếu sau va đập cụ nằm bất động quá thời gian này, hệ thống sẽ kích hoạt còi hú và gửi SOS.
                </span>
              </div>
            </div>
          )}

          {/* CAMERA Specific Configuration */}
          {device.device_type === 'CAMERA' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-[#A1A7B1] mb-1.5">
                  Đường dẫn luồng RTSP (RTSP Stream URL)
                </label>
                <input
                  type="text"
                  value={formConfig.rtspUrl}
                  onChange={(e) => setFormConfig((prev) => ({ ...prev, rtspUrl: e.target.value }))}
                  className="input-glass font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase text-slate-600 dark:text-[#A1A7B1] mb-1.5">
                    Độ phân giải luồng video
                  </label>
                  <select
                    value={formConfig.resolution}
                    onChange={(e) => setFormConfig((prev) => ({ ...prev, resolution: e.target.value }))}
                    className="input-glass font-mono"
                  >
                    <option value="2K Super HD">2K Super HD (2560x1440)</option>
                    <option value="1080p Full HD">1080p Full HD (1920x1080)</option>
                    <option value="720p HD">720p HD (1280x720)</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-[#454A53] bg-slate-50 dark:bg-[#202329]">
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-[#F5F6F8]">
                      AI Pose Detection
                    </span>
                    <input
                      type="checkbox"
                      checked={formConfig.aiProtect}
                      onChange={(e) => setFormConfig((prev) => ({ ...prev, aiProtect: e.target.checked }))}
                      className="w-4 h-4 text-[#FF6B35] rounded focus:ring-[#FF6B35]"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-[#454A53] bg-slate-50 dark:bg-[#202329] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-[#F5F6F8]">
                    Màn trập riêng tư (Privacy Shutter)
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-[#A1A7B1]">
                    Tắt ống kính vật lý khi người nhà muốn bảo mật không gian riêng
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formConfig.privacyShutter}
                  onChange={(e) => setFormConfig((prev) => ({ ...prev, privacyShutter: e.target.checked }))}
                  className="w-5 h-5 text-amber-500 rounded focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          {/* EDGE HUB Specific Configuration */}
          {device.device_type === 'EDGE_HUB' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#202329] border border-slate-200 dark:border-[#454A53] text-xs space-y-2 font-mono">
                <p className="font-bold text-slate-800 dark:text-[#F5F6F8]">
                  Cấu hình MQTT Broker & Cụm NPU:
                </p>
                <p className="text-slate-500 dark:text-[#A1A7B1]">
                  Edge Hub lắng nghe trên topic: <code className="font-mono text-[#FF6B35]">seca/home/vitals/#</code> và phát hiện té ngã qua mô hình YOLOv8 compiled RKNN.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-[#454A53] flex items-center justify-end space-x-3">
            <button type="button" onClick={onClose} className="btn-ghost text-xs py-2 px-4">
              Đóng
            </button>
            <button type="submit" className="btn-primary text-xs py-2 px-5">
              Lưu cấu hình qua MQTT
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
