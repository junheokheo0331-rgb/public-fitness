import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TopBar, Card, Chip, Plate, Empty } from '../../ui/bits.jsx';
import { myClients, listTrainerBookings, myNotifications, markNotificationsRead, getGym } from '../../lib/api.js';
import { useSession } from '../../lib/session.jsx';
import { WEEKDAY_KO, weekdayMon0, dateStrLocal } from '../../lib/booking.js';

function fmtWhen(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${d.getDate()} (${WEEKDAY_KO[weekdayMon0(d)]}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TrainerHome() {
  const { session } = useSession();
  const [clients, setClients] = useState(null);
  const [todayBooks, setTodayBooks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [gymName, setGymName] = useState('소속 확인 중');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let alive = true;
    myClients().then((rows) => alive && setClients(rows)).catch((error) => alive && setLoadError(error.message || '회원 정보를 불러오지 못했습니다.'));
    const today = dateStrLocal(new Date());
    listTrainerBookings({ from: today, to: today }).then((rows) => {
      if (alive) setTodayBooks(rows.filter((b) => b.status === 'booked' || b.status === 'confirmed'));
    }).catch((error) => alive && setLoadError(error.message || '예약 정보를 불러오지 못했습니다.'));
    myNotifications().then((rows) => alive && setNotifications(rows)).catch(() => {});
    if (session.gymId) getGym(session.gymId).then((gym) => alive && setGymName(gym?.name || '소속 헬스장')).catch(() => alive && setGymName('소속 헬스장'));
    else setGymName('소속 헬스장 미등록');
    return () => { alive = false; };
  }, [session.gymId]);

  const lowLeft = clients?.filter((c) => c.sessions_left <= 5) ?? [];

  return (
    <>
      <TopBar title="오늘" sub={gymName} right={<Link className="btn btn--sm btn--ghost" to="/t/settings">설정</Link>} />

      {loadError && <Card><p className="small" style={{ color: 'var(--stop)', margin: 0 }}>{loadError}</p></Card>}

      {notifications.some((item) => !item.read_at) && (
        <Card title={`새 알림 ${notifications.filter((item) => !item.read_at).length}개`} right={
          <button type="button" className="btn btn--sm btn--ghost" onClick={async () => { await markNotificationsRead(); setNotifications((items) => items.map((item) => ({ ...item, read_at: new Date().toISOString() }))); }}>모두 읽음</button>
        } flush>
          <ul className="list">
            {notifications.filter((item) => !item.read_at).slice(0, 4).map((item) => (
              <li key={item.id} className="list__item" style={{ cursor: 'default' }}>
                <div className="list__body"><div className="list__title">{item.title}</div><div className="list__meta">{item.body}</div></div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="row row--between" style={{ alignItems: 'center' }}>
          <div>
            <p className="eyebrow">일정</p>
            <p className="card__title" style={{ fontSize: 16 }}>영업시간 · 고정 PT · 예약</p>
            <p className="card__note">네이버 예약처럼 빈 슬롯을 열어 두세요</p>
          </div>
          <Link className="btn btn--sm" to="/t/schedule">관리</Link>
        </div>
      </Card>

      <Card>
        <div className="row row--between" style={{ alignItems: 'center' }}>
          <div>
            <p className="eyebrow">프로필</p>
            <p className="card__title" style={{ fontSize: 16 }}>이력 · 포트폴리오</p>
            <p className="card__note">회원에게 보이는 소개를 수정하세요</p>
          </div>
          <Link className="btn btn--sm btn--ghost" to="/t/profile">편집</Link>
        </div>
      </Card>

      <Card>
        <div className="row row--between" style={{ alignItems: 'center' }}>
          <div>
            <p className="eyebrow">역경매</p>
            <p className="card__title" style={{ fontSize: 16 }}>근처 PT 요청 보기</p>
            <p className="card__note">회원이 올리면 이력서로 지원하세요</p>
          </div>
          <Link className="btn btn--sm btn--ghost" to="/t/requests">바로가기</Link>
        </div>
      </Card>

      <Card title="오늘 수업" note={dateStrLocal(new Date()).replace(/-/g, '.')}>
        {!clients && <p className="muted small">불러오는 중…</p>}
        {clients && todayBooks.length === 0 && <Empty title="오늘 예정된 수업이 없습니다" />}
        <ul className="list">
          {todayBooks.map((b) => (
            <li key={b.id}>
              <Link className="list__item" to={`/t/clients/${b.member_id}`}>
                <div className="list__body">
                  <div className="list__title">{b.member_name}</div>
                  <div className="list__meta mono">
                    {fmtWhen(b.starts_at)}
                    {b.kind === 'fixed' ? ' · 고정' : ''}
                  </div>
                </div>
                <div className="list__right">›</div>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      {lowLeft.length > 0 && (
        <Card title="세션이 얼마 안 남은 회원" note="재등록 안내가 필요합니다">
          <div className="row row--wrap">
            {lowLeft.map((c) => (
              <Chip key={c.id} kind="sub">{c.name} · {c.sessions_left}회</Chip>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="row row--between">
          <div>
            <p className="eyebrow">담당 회원</p>
            <p className="card__note">전체 인원</p>
          </div>
          <Plate value={clients?.length ?? '—'} unit="명" />
        </div>
      </Card>
    </>
  );
}
