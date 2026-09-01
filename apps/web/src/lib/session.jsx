/* ============================================================
   session.jsx — 로그인한 사람이 누구고 어떤 역할인가

   한 사람이 회원이면서 트레이너일 수 있다. role 은 "지금 어떤 화면을
   보고 있는가"일 뿐이고, 실제 권한은 서버의 RLS 가 판정한다.
   클라이언트의 role 을 권한으로 쓰면 안 된다.
   ============================================================ */

import { createContext, useContext, useState, useEffect } from 'react';
import { ME } from './mock.js';
import { sb, IS_MOCK, setMyActiveGym } from './api.js';

const Ctx = createContext(null);
const KEY = 'gymlink.session';

export function SessionProvider({ children }) {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(KEY)) || null; } catch { return null; }
  });
  const [loading, setLoading] = useState(!IS_MOCK);

  useEffect(() => {
    if (!sb) return undefined;
    let active = true;
    const hydrate = async (user) => {
      if (!user) { if (active) setSession(null); return; }
      const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
      const role = profile?.role ?? user.user_metadata?.role ?? 'member';
      let gymId = null;
      if (role === 'owner') {
        const { data } = await sb.from('gyms').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
        gymId = data?.id ?? null;
      } else if (role === 'trainer') {
        const { data } = await sb.from('trainers').select('primary_gym_id').eq('profile_id', user.id).maybeSingle();
        gymId = data?.primary_gym_id ?? null;
      } else if (role === 'member') {
        gymId = profile?.active_gym_id ?? null;
        if (!gymId) {
          const { data } = await sb.from('memberships').select('gym_id').eq('member_id', user.id).eq('is_active', true)
            .order('starts_on', { ascending: false }).limit(1).maybeSingle();
          gymId = data?.gym_id ?? null;
        }
      }
      if (active) setSession({ id: user.id, email: user.email ?? '', name: profile?.display_name ?? '회원', role, gymId });
    };
    sb.auth.getSession().then(({ data }) => hydrate(data.session?.user)).finally(() => active && setLoading(false));
    const { data: listener } = sb.auth.onAuthStateChange((_event, next) => hydrate(next?.user));
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (session) sessionStorage.setItem(KEY, JSON.stringify(session));
    else sessionStorage.removeItem(KEY);
  }, [session]);

  const signIn = (role) => {
    if (IS_MOCK) setSession({ ...ME[role], gymId: 'g-1' });
  };
  const signInSocial = (provider, role = 'member') => sb?.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: window.location.origin,
    },
  });
  const signInEmail = (email, role = 'member') => sb?.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin, data: { role, display_name: email.split('@')[0] } },
  });
  const signInPassword = (email, password) => sb?.auth.signInWithPassword({ email, password });
  const signUpEmail = (email, password, displayName) => sb?.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
      data: { display_name: displayName.trim() || email.split('@')[0] },
    },
  });
  const signOut = async () => {
    if (sb) await sb.auth.signOut();
    setSession(null);
  };
  const switchGym = async (gymId) => {
    await setMyActiveGym(gymId);
    setSession((current) => current ? { ...current, gymId } : current);
  };

  return <Ctx.Provider value={{
    session, loading, signIn, signInSocial, signInEmail, signInPassword, signUpEmail, signOut, switchGym,
  }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

export const ROLE_LABEL = { member: '회원', trainer: '트레이너', owner: '관장', admin: '본사 운영자' };
