import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasKakaoMapKey, loadKakaoMaps } from '../lib/location.js';

export default function GymMap({ gyms, origin }) {
  const host = useRef(null);
  const nav = useNavigate();
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const mappedGyms = gyms.filter((gym) => gym.lat != null && gym.lng != null
    && Number.isFinite(Number(gym.lat)) && Number.isFinite(Number(gym.lng)));

  useEffect(() => {
    if (!hasKakaoMapKey() || !host.current || !mappedGyms.length) return undefined;
    let active = true;
    setLoadError('');
    loadKakaoMaps().then((kakao) => {
      if (!active || !host.current) return;
      const first = origin ?? mappedGyms[0];
      const map = new kakao.maps.Map(host.current, {
        center: new kakao.maps.LatLng(first.lat, first.lng), level: 5,
      });
      const bounds = new kakao.maps.LatLngBounds();
      if (origin?.lat && origin?.lng) {
        const here = new kakao.maps.LatLng(origin.lat, origin.lng);
        const marker = new kakao.maps.Marker({ position: here, map, title: origin.label });
        marker.setZIndex(10);
        bounds.extend(here);
      }
      mappedGyms.forEach((gym) => {
        const pos = new kakao.maps.LatLng(gym.lat, gym.lng);
        const marker = new kakao.maps.Marker({ position: pos, map, title: gym.name });
        kakao.maps.event.addListener(marker, 'click', () => nav(`/gym/${gym.id}`));
        bounds.extend(pos);
      });
      map.setBounds(bounds, 36, 36, 36, 36);
    }).catch((error) => setLoadError(error?.message || 'KAKAO_LOAD_FAILED'));
    return () => { active = false; };
  }, [gyms, mappedGyms.length, nav, origin, retry]);

  if (!hasKakaoMapKey() || loadError || !mappedGyms.length) {
    const max = Math.max(...gyms.map((g) => g.distance_m || 1), 1);
    const hint = !hasKakaoMapKey()
      ? '카카오 JavaScript 키가 연결되지 않았습니다.'
      : !mappedGyms.length
        ? '지도에 표시할 헬스장 좌표가 없습니다.'
        : '카카오맵 사용 설정과 JavaScript SDK 도메인을 확인해주세요.';
    return (
      <div className="map-fallback" aria-label="헬스장 거리 비교">
        <span className="map-fallback__you">{origin?.mode === 'home' ? '우리 집' : origin ? '현재 위치' : '기준 위치'}</span>
        {gyms.slice(0, 5).map((gym, index) => (
          <button
            key={gym.id}
            type="button"
            className="map-pin"
            style={{
              left: `${18 + ((gym.distance_m || 0) / max) * 62}%`,
              top: `${22 + (index % 3) * 23}%`,
            }}
            onClick={() => nav(`/gym/${gym.id}`)}
            aria-label={`${gym.name}, ${gym.distance_m}미터`}
          >
            <span>{index + 1}</span>
            <small>{gym.name.replace(/헬스클럽|스트렝스짐|바디랩/g, '')}</small>
          </button>
        ))}
        <div className="map-fallback__status" role={loadError ? 'alert' : undefined}>
          <p>{hint}</p>
          {loadError && <code className="map-fallback__error-code">{loadError}</code>}
          {loadError && (
            <button type="button" className="map-fallback__retry" onClick={() => { setLoadError(''); setRetry((value) => value + 1); }}>
              지도 다시 불러오기
            </button>
          )}
        </div>
      </div>
    );
  }

  return <div ref={host} className="gym-map" aria-label="주변 헬스장 카카오맵" />;
}
