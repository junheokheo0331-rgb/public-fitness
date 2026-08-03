import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../lib/session.jsx';
import RestBar from './RestBar.jsx';

const TABS = {
  member: [
    { to: '/',        glyph: '◎', label: '홈' },
    { to: '/my',      glyph: '▤', label: '내 헬스장' },
    { to: '/workout', glyph: '▲', label: '운동' },
    { to: '/me',      glyph: '◇', label: '내정보' },
  ],
  trainer: [
    { to: '/t',           glyph: '◎', label: '오늘' },
    { to: '/t/schedule',  glyph: '▣', label: '일정' },
    { to: '/t/clients',   glyph: '▤', label: '담당 회원' },
    { to: '/workout',     glyph: '▲', label: '운동' },
  ],
  owner: [
    { to: '/o',          glyph: '◎', label: '현황' },
    { to: '/o/machines', glyph: '▦', label: '보유 기구' },
    { to: '/o/roster',   glyph: '▤', label: '회원' },
    { to: '/me',         glyph: '◇', label: '내 정보' },
  ],
};

export default function Shell() {
  const { session } = useSession();
  const tabs = TABS[session.role] ?? TABS.member;
  const wide = session.role === 'owner';

  return (
    <div className="app">
      <main className={`main ${wide ? 'main--wide' : ''}`}>
        <Outlet />
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
            <span className="nav__glyph" aria-hidden="true">{t.glyph}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
