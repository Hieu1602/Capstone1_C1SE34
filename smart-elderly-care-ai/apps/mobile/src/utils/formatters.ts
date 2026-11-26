export const formatGender = (gender?: string | null): string => {
  const g = String(gender || '').trim().toUpperCase();
  if (g === 'MALE' || g === 'NAM' || g === 'M') return 'Nam';
  if (g === 'FEMALE' || g === 'NỮ' || g === 'NU' || g === 'F') return 'Nữ';
  if (g === 'OTHER' || g === 'KHÁC' || g === 'KHAC') return 'Khác';
  return 'Chưa rõ';
};

export function formatGenderVN(raw?: string | null, fallback = 'Chưa rõ'): string {
  const g = String(raw || '').trim();
  if (!g) return fallback;
  return formatGender(g);
}
