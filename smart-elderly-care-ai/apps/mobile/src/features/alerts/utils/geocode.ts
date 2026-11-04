import { emergencyApi } from '../../../services/api';

export type PhotonReverseGeocodeResult = {
  features?: Array<{
    properties?: {
      name?: string;
      housenumber?: string;
      street?: string;
      locality?: string;
      district?: string;
      city?: string;
      county?: string;
      state?: string;
      country?: string;
    };
  }>;
};

export const uniqueAddressParts = (parts: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => {
      if (!part) return false;
      const normalized = part.toLocaleLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
};

export const formatPhotonAddress = (result: PhotonReverseGeocodeResult) => {
  const place = result.features?.[0]?.properties;
  if (!place) return '';
  const street = [place.housenumber, place.street].filter(Boolean).join(' ');
  const isNameDuplicate =
    !place.name ||
    place.name === place.street ||
    place.name === place.housenumber ||
    place.name === street;
  const placeName = isNameDuplicate ? null : place.name;
  const parts = uniqueAddressParts([
    placeName,
    street,
    place.locality,
    place.district,
    place.city,
    place.county,
    place.state,
    place.country,
  ]);
  return parts.join(', ');
};

export const resolveAddressFromCoords = async (latitude: number, longitude: number): Promise<string> => {
  // 1. Thử Photon Komoot (cực nhanh ~1s, không bị CORS, chính xác số nhà, tên đường, tổ thôn xã)
  try {
    const photonResp = await fetch(`https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}`);
    if (photonResp.ok) {
      const result = (await photonResp.json()) as PhotonReverseGeocodeResult;
      const addr = formatPhotonAddress(result);
      if (addr) return addr;
    }
  } catch (e) {
    console.warn('[ReverseGeocode] Photon error, trying backend:', e);
  }

  // 2. Thử gọi API backend (Nominatim & Photon Server-side, hỗ trợ tiếng Việt đầy đủ)
  try {
    const res = await emergencyApi.reverseGeocode(latitude, longitude);
    if (res.data?.address) {
      return res.data.address;
    }
  } catch (e) {
    console.warn('[ReverseGeocode] Backend API error, trying client fallbacks:', e);
  }

  // 3. Fallback BigDataCloud Client (chỉ có cấp phường/xã, quận, thành phố)
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=vi`;
    const resp = await fetch(bdcUrl);
    if (resp.ok) {
      const data = await resp.json();
      const parts = uniqueAddressParts([
        data.locality,
        data.city || data.principalSubdivision,
        data.countryName,
      ]);
      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
  } catch (e) {
    console.warn('[ReverseGeocode] BigDataCloud error:', e);
  }

  return '';
};

