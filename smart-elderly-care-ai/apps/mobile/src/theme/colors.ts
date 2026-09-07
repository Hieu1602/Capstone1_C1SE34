// src/theme/colors.ts
// Bảng màu chuẩn thiết kế Smart Home / Elderly Care AI (Light Theme phong cách Imou Protect)

export const Colors = {
  // Nền & Container
  background: '#F6F8FA',         // Nền xám nhạt cao cấp
  surface: '#FFFFFF',            // Nền thẻ Card trắng sáng
  surfaceSubtle: '#F1F5F9',      // Nền phụ
  border: '#E2E8F0',             // Viền ngăn cách nhẹ
  borderDark: '#CBD5E1',

  // Chữ & Typography
  textPrimary: '#0F172A',        // Chữ đen đậm
  textSecondary: '#64748B',      // Chữ xám phụ đề
  textMuted: '#94A3B8',          // Chữ mờ
  textWhite: '#FFFFFF',

  // Màu nhận diện & Điểm nhấn
  primary: '#FF7A00',            // Cam Imou đặc trưng
  primaryLight: '#FFF7ED',       // Nền cam nhạt
  primaryDark: '#EA580C',
  
  // Màu AI & Công nghệ
  aiBlue: '#0284C7',             // Xanh AI chủ đạo
  aiCyan: '#06B6D4',
  aiGradientStart: '#38BDF8',
  aiGradientEnd: '#2563EB',
  
  // Trạng thái hệ thống
  success: '#10B981',            // Xanh lá (Online / Bình thường / Tại nhà)
  warning: '#F59E0B',            // Vàng cam (Cảnh báo vừa)
  danger: '#EF4444',             // Đỏ rực (Té ngã / SOS 115 / Nguy kịch)
  awayPillBg: '#E6F9F5',         // Nền pill "Xa"
  awayPillText: '#0D9488',
  homePillBg: '#EFF6FF',         // Nền pill "Tại nhà"
  homePillText: '#2563EB',
  privacyPillBg: '#FFFBEB',      // Nền pill "Riêng tư"
  privacyPillText: '#D97706',

  // Player & Controls (Dark overlay bar)
  playerBg: '#090D16',
  playerControlBar: 'rgba(15, 23, 42, 0.95)',
  playerText: '#F8FAFC',
};

export const Shadows = {
  soft: {
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  glow: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
};
