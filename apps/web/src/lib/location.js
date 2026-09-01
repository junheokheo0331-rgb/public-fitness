const kakaoKey = String(import.meta.env.VITE_KAKAO_MAP_KEY || '').trim();

let kakaoPromise;

export function hasKakaoMapKey() {
  return Boolean(kakaoKey);
}

export function loadKakaoMaps() {
  if (window.kakao?.maps?.services) return Promise.resolve(window.kakao);
  if (!kakaoKey) return Promise.reject(new Error('KAKAO_KEY_MISSING'));
  if (kakaoPromise) return kakaoPromise;

  kakaoPromise = new Promise((resolve, reject) => {
    const found = document.querySelector('script[data-gymlink-kakao]');
    if (found) found.remove();

    const script = document.createElement('script');
    script.dataset.gymlinkKakao = 'true';
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(kakaoKey)}&autoload=false&libraries=services`;
    const timeout = window.setTimeout(() => {
      kakaoPromise = undefined;
      script.remove();
      reject(new Error('KAKAO_LOAD_TIMEOUT'));
    }, 12000);
    script.onload = () => {
      if (!window.kakao?.maps?.load) {
        window.clearTimeout(timeout);
        kakaoPromise = undefined;
        reject(new Error('KAKAO_INVALID_KEY_OR_DOMAIN'));
        return;
      }
      window.kakao.maps.load(() => {
        window.clearTimeout(timeout);
        if (!window.kakao?.maps?.services) {
          kakaoPromise = undefined;
          reject(new Error('KAKAO_SERVICES_MISSING'));
          return;
        }
        resolve(window.kakao);
      });
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      kakaoPromise = undefined;
      reject(new Error('KAKAO_LOAD_FAILED'));
    };
    document.head.appendChild(script);
  });
  return kakaoPromise;
}

export function requestCurrentPosition() {
  if (!navigator.geolocation) return Promise.reject(new Error('UNSUPPORTED'));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        mode: 'current',
        label: '내 현재 위치',
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: Math.round(coords.accuracy),
      }),
      (error) => reject(error),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}

export async function geocodeAddress(address) {
  const kakao = await loadKakaoMaps();
  const geocoder = new kakao.maps.services.Geocoder();
  return new Promise((resolve, reject) => {
    geocoder.addressSearch(address, (results, status) => {
      if (status !== kakao.maps.services.Status.OK || !results[0]) {
        reject(new Error('ADDRESS_NOT_FOUND'));
        return;
      }
      const item = results[0];
      resolve({
        mode: 'home',
        label: item.road_address?.building_name || item.address_name || address,
        address: item.road_address?.address_name || item.address_name || address,
        lat: Number(item.y),
        lng: Number(item.x),
        bcode: item.address?.b_code || null,
      });
    });
  });
}

export async function labelCurrentPosition(location) {
  try {
    const kakao = await loadKakaoMaps();
    const geocoder = new kakao.maps.services.Geocoder();
    return await new Promise((resolve) => {
      geocoder.coord2RegionCode(location.lng, location.lat, (results, status) => {
        const region = status === kakao.maps.services.Status.OK
          ? results.find((item) => item.region_type === 'H') ?? results[0]
          : null;
        resolve(region ? { ...location, label: `${region.region_2depth_name} ${region.region_3depth_name}` } : location);
      });
    });
  } catch {
    return location;
  }
}

export function distanceMeters(from, to) {
  if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) return null;
  const rad = (value) => value * Math.PI / 180;
  const earth = 6371000;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
