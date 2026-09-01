import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasKakaoMapKey, loadKakaoMaps } from '../lib/location.js';

export default function GymMap({ gyms, origin }) {
  const host = useRef(null);
  const nav = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!hasKakaoMapKey() || !host.current || !gyms.length) return undefined;
    let active = true;
    setFailed(false);
    loadKakaoMaps().then((kakao) => {
      if (!active || !host.current) return;
      const first = origin ?? gyms.find((g) => g.lat && g.lng) ?? gyms[0];
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
      gyms.filter((g) => g.lat && g.lng).forEach((gym) => {
        const pos = new kakao.maps.LatLng(gym.lat, gym.lng);
        const marker = new kakao.maps.Marker({ position: pos, map, title: gym.name });
        kakao.maps.event.addListener(marker, 'click', () => nav(`/gym/${gym.id}`));
        bounds.extend(pos);
      });
      map.setBounds(bounds, 36, 36, 36, 36);
    }).catch(() => setFailed(true));
    return () => { active = false; };
  }, [gyms, nav, origin]);

  if (!hasKakaoMapKey() || failed) {
    const max = Math.max(...gyms.map((g) => g.distance_m || 1), 1);
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
        <p className="map-fallback__hint">카카오 키 연결 전 거리 데모</p>
      </div>
    );
  }

  return <div ref={host} className="gym-map" aria-label="주변 헬스장 카카오맵" />;
}
