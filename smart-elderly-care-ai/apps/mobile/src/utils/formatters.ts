export function formatGenderVN(raw?: string | null, fallback = 'Chưa cập nhật'): string {
  const normalized = (raw || '').trim().toUpperCase();
  if (!normalized) return fallback;
  if (normalized === 'MALE' || normalized === 'NAM' || normalized === 'M') return 'Nam';
  if (normalized === 'FEMALE' || normalized === 'NỮ' || normalized === 'NU' || normalized === 'F') return 'Nữ';
  if (normalized === 'OTHER' || normalized === 'KHÁC' || normalized === 'KHAC') return 'Khác';
  return raw!.trim();
}
