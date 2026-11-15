// src/utils/text.ts
// Tiện ích xử lý chuỗi và tìm kiếm tiếng Việt không dấu

export function removeVietnameseTones(str?: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}
