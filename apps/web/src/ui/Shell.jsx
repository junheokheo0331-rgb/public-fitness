import { Component, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../lib/session.jsx';
import { sb } from '../lib/api.js';
import RestBar from './RestBar.jsx';

const TABS = {
  member: [
    { to: '/',        icon: 'home', label: '홈' },
    { to: '/workout', icon: 'workout', label: '운동' },
    { to: '/book',    icon: 'calendar', label: 'PT' },
    { to: '/chat',    icon: 'chat', label: '대화' },
    { to: '/me',      icon: 'user', label: '내정보' },
  ],
  trainer: [
    { to: '/t',           icon: 'home', label: '오늘' },
    { to: '/t/clients',   icon: 'users', label: '담당 회원' },
    { to: '/workout',     icon: 'workout', label: '운동' },
    { to: '/chat',        icon: 'chat', label: '대화' },
    { to: '/t/settings',  icon: 'settings', label: '설정' },
  ],
  owner: [
    { to: '/o',          icon: 'home', label: '현황' },
    { to: '/o/machines', icon: 'gym', label: '머신' },
    { to: '/o/prices',   icon: 'tag', label: '가격표' },
    { to: '/o/roster',   icon: 'users', label: '회원' },
    { to: '/me',         icon: 'user', label: '내 정보' },
  ],
  admin: [
    { to: '/admin', icon: 'home', label: '운영 현황' },
    { to: '/me',    icon: 'user', label: '내 정보' },
  ],
};

const ICONS = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7" /></>,
  gym: <><path d="M6 8v8M3.5 9.5v5M18 8v8M20.5 9.5v5M6 12h12" /></>,
  workout: <><path d="M6 8v8M3.5 9.5v5M18 8v8M20.5 9.5v5M6 12h12" /></>,
  calendar: <><rect x="3.5" y="5.5" width="17" height="15" rx="2" /><path d="M7 3v5M17 3v5M3.5 10h17M8 14h3M13 14h3M8 17h3" /></>,
  chat: <><path d="M4 5.5h16v11H9l-5 4v-15Z" /><path d="M8 10h8M8 13h5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21c.8-4.5 3.2-6.5 7.5-6.5s6.7 2 7.5 6.5" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-4 2.8-6 6.5-6s5.9 2 6.5 6M15 5.5a3.5 3.5 0 0 1 0 6.5M16.5 14c3 .4 4.5 2.4 5 6" /></>,
  tag: <><path d="M4 5h9l7 7-8 8-8-8V5Z" /><circle cx="9" cy="10" r="1.5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
};

function TabIcon({ name }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[name]}</svg>;
}

class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) { return { error }; }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="page-error" role="alert">
        <p className="eyebrow">화면을 불러오지 못했습니다</p>
        <h1>잠시 후 다시 시도해주세요</h1>
        <p>입력한 운동 기록은 이 기기에 자동 저장되어 있습니다.</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>화면 다시 불러오기</button>
      </section>
    );
  }
}

export default function Shell() {
  const { session } = useSession();
  const location = useLocation();
  const tabs = TABS[session.role] ?? TABS.member;
  const wide = session.role === 'owner' || session.role === 'admin';

  useEffect(() => {
    if (!sb || session.role !== 'trainer') return undefined;
    const channel = sb.channel(`trainer-bookings-${session.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'bookings', filter: `trainer_id=eq.${session.id}`,
      }, (payload) => {
        let enabled = true;
        try { enabled = JSON.parse(localStorage.getItem('gymlink.trainer-preferences'))?.bookingAlerts !== false; } catch { /* 기본 켬 */ }
        if (enabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('새 PT 예약', { body: new Date(payload.new.starts_at).toLocaleString('ko-KR') });
        }
      }).subscribe();
    return () => { sb.removeChannel(channel); };
  }, [session.id, session.role]);

  return (
    <div className="app">
      <main className={`main ${wide ? 'main--wide' : ''}`}>
        <PageErrorBoundary key={location.pathname}>
          <Outlet />
        </PageErrorBoundary>
      </main>

      {(session.role === 'member' || session.role === 'trainer') && <RestBar />}

      <nav className="nav" aria-label="주요 메뉴">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/' || t.to === '/t' || t.to === '/o'}
            className="nav__item"
          >
            <span className="nav__glyph"><TabIcon name={t.icon} /></span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
