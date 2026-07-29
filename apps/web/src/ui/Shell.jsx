import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../lib/session.jsx';

/* 역할마다 다른 탭을 본다. 같은 앱, 같은 로그인, 다른 일.
   탭 수를 4개 이하로 유지한다 — 엄지로 닿는 범위가 그 정도다. */
const TABS = {
  member: [
    { to: '/',        glyph: '◎', label: '주변' },
    { to: '/my',      glyph: '▣', label: '내 헬스장' },
    { to: '/body',    glyph: '◐', label: '체성분' },
    { to: '/me',      glyph: '◇', label: '내 정보' },
  ],
  trainer: [
    { to: '/t',           glyph: '◎', label: '오늘' },
    { to: '/t/clients',   glyph: '▤', label: '담당 회원' },
    { to: '/me',          glyph: '◇', label: '내 정보' },
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

      <nav className="nav" aria-label="주요 메뉴">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end className="nav__item">
            <span className="nav__glyph" aria-hidden="true">{t.glyph}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
