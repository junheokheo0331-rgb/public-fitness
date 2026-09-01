import { useEffect, useState } from 'react';
import {
  getPreferredLocation, saveCurrentLocation, saveHomeLocation, selectSavedLocation,
} from '../lib/api.js';
import {
  geocodeAddress, hasKakaoMapKey, labelCurrentPosition, requestCurrentPosition,
} from '../lib/location.js';

function locationError(error) {
  if (error?.code === 1) return '위치 권한이 꺼져 있습니다. 브라우저 주소창에서 위치 권한을 허용해 주세요.';
  if (error?.code === 2) return '현재 위치를 확인하지 못했습니다. GPS나 네트워크 상태를 확인해 주세요.';
  if (error?.code === 3) return '위치 확인 시간이 초과됐습니다. 다시 시도해 주세요.';
  if (error?.message === 'UNSUPPORTED') return '이 브라우저는 위치 기능을 지원하지 않습니다.';
  return '현재 위치를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

export default function LocationPicker({ onChange }) {
  const [location, setLocation] = useState(null);
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState({ current: false, home: false });

  useEffect(() => {
    let alive = true;
    getPreferredLocation().then((value) => {
      if (!alive || !value) return;
      setLocation(value);
      setSaved((old) => ({ ...old, [value.mode]: true }));
      onChange?.(value);
    });
    return () => { alive = false; };
  }, []);

  const chooseCurrent = async () => {
    setBusy('current');
    setNotice('');
    try {
      const raw = await requestCurrentPosition();
      const named = await labelCurrentPosition(raw);
      const next = await saveCurrentLocation(named);
      setLocation(next);
      setSaved((old) => ({ ...old, current: true }));
      setOpen(false);
      onChange?.(next);
    } catch (error) {
      setNotice(locationError(error));
    } finally {
      setBusy('');
    }
  };

  const chooseSaved = async (mode) => {
    const next = await selectSavedLocation(mode);
    if (!next) return;
    setLocation(next);
    setOpen(false);
    onChange?.(next);
  };

  const submitHome = async (event) => {
    event.preventDefault();
    const value = address.trim();
    if (!value) return;
    setBusy('home');
    setNotice('');
    try {
      const found = await geocodeAddress(value);
      const next = await saveHomeLocation(found);
      setLocation(next);
      setSaved((old) => ({ ...old, home: true }));
      setAddress('');
      setOpen(false);
      onChange?.(next);
    } catch (error) {
      const configurationError = ['KAKAO_KEY_MISSING', 'KAKAO_LOAD_FAILED', 'KAKAO_LOAD_TIMEOUT', 'KAKAO_INVALID_KEY_OR_DOMAIN', 'KAKAO_SERVICES_MISSING'].includes(error?.message);
      setNotice(configurationError
        ? '카카오 JavaScript 키와 현재 사이트 도메인 등록을 확인해주세요.'
        : '주소를 찾지 못했습니다. 도로명과 건물 번호까지 입력해 주세요.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="loc">
      <button type="button" className="loc__btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="loc__pin" aria-hidden="true">●</span>
        <span>
          <span className="loc__label">{location?.label ?? '검색 위치 설정'}</span>
          <small className="loc__mode">{location?.mode === 'home' ? '집 기준' : location?.mode === 'current' ? '현재 위치 기준' : '가까운 헬스장을 찾아보세요'}</small>
        </span>
        <span className="loc__chev" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="loc__menu" role="dialog" aria-label="검색 위치 설정">
          <p className="loc__title">어디서 가까운 곳을 찾을까요?</p>
          <p className="loc__privacy">현재 위치는 이 브라우저 세션에서만 사용합니다.</p>
          <button type="button" className="loc-action" onClick={chooseCurrent} disabled={Boolean(busy)}>
            <span className="loc-action__icon" aria-hidden="true">◎</span>
            <span><strong>{busy === 'current' ? '위치 확인 중…' : '현재 위치 사용'}</strong><small>누르면 브라우저 위치 권한을 요청합니다</small></span>
          </button>
          {saved.current && location?.mode !== 'current' && (
            <button type="button" className="loc__saved" onClick={() => chooseSaved('current')}>최근 현재 위치로 전환</button>
          )}
          <div className="loc__divider"><span>또는 집 주소</span></div>
          <form className="loc__address" onSubmit={submitHome}>
            <label className="sr" htmlFor="home-address">집 도로명 주소</label>
            <input
              id="home-address" className="input" value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="예: 부산진구 중앙대로 672" autoComplete="street-address"
            />
            <button className="btn" type="submit" disabled={Boolean(busy) || !address.trim()}>
              {busy === 'home' ? '검색 중…' : '집 저장'}
            </button>
          </form>
          {saved.home && location?.mode !== 'home' && (
            <button type="button" className="loc__saved" onClick={() => chooseSaved('home')}>저장한 집 기준으로 전환</button>
          )}
          {!hasKakaoMapKey() && <p className="loc__key-note">카카오 JavaScript 키 연결 후 주소 검색이 활성화됩니다.</p>}
          {notice && <p className="loc__notice" role="alert">{notice}</p>}
        </div>
      )}
    </div>
  );
}
