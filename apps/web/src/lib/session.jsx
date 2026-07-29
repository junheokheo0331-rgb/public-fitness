/* ============================================================
   session.jsx — 로그인한 사람이 누구고 어떤 역할인가

   한 사람이 회원이면서 트레이너일 수 있다. role 은 "지금 어떤 화면을
   보고 있는가"일 뿐이고, 실제 권한은 서버의 RLS 가 판정한다.
   클라이언트의 role 을 권한으로 쓰면 안 된다.
   ============================================================ */

import { createContext, useContext, useState, useEffect } from 'react';
import { ME } from './mock.js';

const Ctx = createContext(null);
const KEY = 'gymlink.session';

export function SessionProvider({ children }) {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(KEY)) || null; } catch { return null; }
  });

  useEffect(() => {
    if (session) sessionStorage.setItem(KEY, JSON.stringify(session));
    else sessionStorage.removeItem(KEY);
  }, [session]);

  const signIn = (role) => setSession({ ...ME[role], gymId: 'g-1' });
  const signOut = () => setSession(null);

  return <Ctx.Provider value={{ session, signIn, signOut }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

export const ROLE_LABEL = { member: '회원', trainer: '트레이너', owner: '관장' };
