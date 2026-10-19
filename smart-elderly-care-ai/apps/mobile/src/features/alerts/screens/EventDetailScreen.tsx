// ==============================================================================
// EventDetailScreen.tsx – Re-export Wrapper / Alias cho IncidentDetailScreen
// ------------------------------------------------------------------------------
// Hệ thống giám sát người cao tuổi Smart Elderly Care AI (C1SE.34)
//
// Ý nghĩa kiến trúc:
// - Trong một số điều hướng hoặc router cũ, màn hình này được gọi với tên `EventDetailScreen`.
// - Thực chất toàn bộ logic hiển thị chi tiết sự cố, bằng chứng clip video 5s,
//   và nút bấm "Đánh dấu đã xử lý" được quản lý tại `IncidentDetailScreen.tsx`.
// - File này re-export lại để đảm bảo tính nhất quán và tương thích mà không phải sửa
//   hàng loạt route navigation trên toàn bộ ứng dụng.
// ==============================================================================

import IncidentDetailScreen from './IncidentDetailScreen';

export default IncidentDetailScreen;
export { IncidentDetailScreen };

