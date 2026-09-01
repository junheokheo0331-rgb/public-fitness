import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TopBar, Card, Chip, Field, Note } from '../../ui/bits.jsx';
import { useSession } from '../../lib/session.jsx';

const KEY = 'gymlink.trainer-preferences';

function initialPreferences() {
  try {
    return { bookingAlerts: true, reminderAlerts: true, ...JSON.parse(localStorage.getItem(KEY)) };
  } catch {
    return { bookingAlerts: true, reminderAlerts: true };
  }
}

export default function TrainerSettings() {
  const { session, signOut } = useSession();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [notice, setNotice] = useState('');
  const permission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;

  const update = (patch) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  const enableBrowserAlerts = async () => {
    if (typeof Notification === 'undefined') {
      setNotice('이 브라우저는 알림을 지원하지 않습니다. 앱 안 알림은 계속 받을 수 있습니다.');
      return;
    }
    const result = await Notification.requestPermission();
    setNotice(result === 'granted'
      ? '브라우저 알림을 켰습니다. 새 예약이 들어오면 알려드릴게요.'
      : '브라우저 설정에서 알림을 허용해야 화면 밖 알림을 받을 수 있습니다.');
  };

  return (
    <>
      <TopBar title="설정" sub="계정 · 알림 · 프로필" />
      {notice && <Note kind={permission === 'granted' ? 'go' : 'volt'}><p className="small">{notice}</p></Note>}

      <Card title="예약 알림">
        <Field label="앱 안 알림">
          <label className="check">
            <input type="checkbox" checked={preferences.bookingAlerts} onChange={(event) => update({ bookingAlerts: event.target.checked })} />
            <span>새 예약과 취소를 알림함에 표시</span>
          </label>
        </Field>
        <Field label="수업 리마인드">
          <label className="check">
            <input type="checkbox" checked={preferences.reminderAlerts} onChange={(event) => update({ reminderAlerts: event.target.checked })} />
            <span>다가오는 수업을 미리 알림</span>
          </label>
        </Field>
        <button type="button" className="btn btn--block" onClick={enableBrowserAlerts}>
          {permission === 'granted' ? '브라우저 알림 사용 중' : '브라우저 알림 켜기'}
        </button>
        <p className="tiny muted" style={{ marginTop: 8 }}>권한 요청은 이 버튼을 누를 때만 나타납니다.</p>
      </Card>

      <Card title="내 관리">
        <div className="row row--wrap" style={{ gap: 8 }}>
          <Link className="btn btn--ghost grow" to="/t/profile">공개 프로필</Link>
          <Link className="btn btn--ghost grow" to="/workout/settings">운동 기록 설정</Link>
          <Link className="btn btn--ghost grow" to="/t/schedule">일정 · 예약 설정</Link>
        </div>
      </Card>

      <Card title="계정">
        <div className="row row--between" style={{ gap: 12 }}>
          <div className="grow">
            <strong className="small">{session.name}</strong>
            <p className="tiny muted" style={{ marginTop: 4 }}>{session.email || '트레이너 계정'}</p>
          </div>
          <Chip kind="role">트레이너</Chip>
        </div>
        <button type="button" className="btn btn--ghost btn--block" style={{ marginTop: 14 }} onClick={signOut}>
          로그아웃
        </button>
      </Card>
    </>
  );
}
