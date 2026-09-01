import { useState } from 'react';
import { useSession, ROLE_LABEL } from '../lib/session.jsx';
import { CONFIG_ERROR } from '../lib/api.js';

/* 회원 로그인이 메인. 트레이너·관장은 하단 보조 링크로만 노출한다.

   실제 권한은 서버가 판정한다. 여기서 고르는 건 "어떤 화면부터
   보여줄까"일 뿐이고, 간편 로그인·사업자 인증은 UI 골격이다. */

const SOCIAL = [
  { id: 'kakao', mark: 'K', label: '카카오로 시작하기' },
  { id: 'naver', mark: 'N', label: '네이버로 시작하기' },
  { id: 'apple', mark: '', label: 'Apple로 시작하기' },
];

export default function Login() {
  const { signInSocial, signInPassword, signUpEmail } = useSession();
  const [screen, setScreen] = useState('member'); // member | staff
  const [staffRole, setStaffRole] = useState('trainer'); // trainer | owner
  const [showIdLogin, setShowIdLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [memberMode, setMemberMode] = useState('login');
  const [notice, setNotice] = useState('');

  const enterSocial = async (provider) => {
    if (CONFIG_ERROR) { setNotice(CONFIG_ERROR); return; }
    if (provider === 'naver') {
      setNotice('네이버 로그인은 Supabase 커스텀 OAuth 설정 후 활성화됩니다. 이메일 로그인을 이용해주세요.');
      return;
    }
    const { error } = await signInSocial(provider, 'member');
    if (error) setNotice(error.message);
  };

  const submitIdLogin = async (e) => {
    e.preventDefault();
    if (CONFIG_ERROR) { setNotice(CONFIG_ERROR); return; }
    if (!email) { setNotice('이메일을 입력해주세요.'); return; }
    if (password.length < 8) { setNotice('비밀번호는 8자 이상 입력해주세요.'); return; }
    if (memberMode === 'signup') {
      if (!displayName.trim()) { setNotice('사용할 이름을 입력해주세요.'); return; }
      const { data, error } = await signUpEmail(email, password, displayName);
      setNotice(error
        ? error.message
        : data.session
          ? '가입과 로그인이 완료되었습니다.'
          : '가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해주세요.');
      return;
    }
    const { error } = await signInPassword(email, password);
    setNotice(error ? '이메일 또는 비밀번호를 확인해주세요.' : '로그인되었습니다.');
  };

  const submitStaff = async (e) => {
    e.preventDefault();
    if (CONFIG_ERROR) { setNotice(CONFIG_ERROR); return; }
    if (!email) { setNotice('업무용 이메일을 입력해주세요.'); return; }
    if (password.length < 8) { setNotice('비밀번호는 8자 이상 입력해주세요.'); return; }
    const { error } = await signInPassword(email, password);
    setNotice(error ? '이메일 또는 비밀번호를 확인해주세요.' : '로그인되었습니다.');
  };

  if (screen === 'staff') {
    return (
      <div className="auth">
        <button
          type="button"
          className="auth__back"
          onClick={() => setScreen('member')}
        >
          ← 회원 로그인으로
        </button>

        <h1 className="auth__mark">Gym<span>Link</span></h1>
        <p className="auth__tag">{staffRole === 'owner' ? '승인된 관장 계정으로 로그인하세요.' : '승인된 트레이너 계정으로 로그인하세요.'}</p>

        <div className="auth-tabs" role="tablist" aria-label="로그인 유형">
          {[
            { key: 'trainer', label: '트레이너 로그인' },
            { key: 'owner', label: '관장 로그인' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              className="auth-tabs__btn"
              aria-selected={staffRole === t.key}
              onClick={() => setStaffRole(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={submitStaff} className="auth__main">
          <label className="field">
            <span className="field__label">업무용 이메일</span>
            <input
              className="input" type="email" autoComplete="email" placeholder="staff@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} required
            />
          </label>

          <label className="field">
            <span className="field__label">비밀번호</span>
            <input
              className="input" type="password" minLength="8" autoComplete="current-password"
              placeholder="8자 이상" value={password} onChange={(e) => setPassword(e.target.value)} required
            />
          </label>

          <button className="btn btn--block" type="submit">
            {ROLE_LABEL[staffRole]} 로그인
          </button>
        </form>

        <p className="tiny muted auth__hint">신규 관장은 사업자 확인 후, 트레이너는 소속·자격 확인 후 계정이 활성화됩니다. 트레이너에게 사업자등록번호를 요구하지 않습니다.</p>
        {notice && <p className="tiny muted auth__hint">{notice}</p>}
      </div>
    );
  }

  return (
    <div className="auth">
      <header className="auth__head">
        <p className="eyebrow">부산 · 서면</p>
        <h1 className="auth__mark">Gym<span>Link</span></h1>
        <p className="auth__tag">헬스장과 사람을 잇습니다.</p>
      </header>

      <div className="auth__main">
        <div className="social">
          {SOCIAL.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`social__btn social__btn--${s.id}`}
              onClick={() => enterSocial(s.id)}
            >
              {s.mark ? (
                <span className="social__mark" aria-hidden="true">{s.mark}</span>
              ) : null}
              {s.label}
            </button>
          ))}
        </div>

        {!showIdLogin ? (
          <button
            type="button"
            className="auth__alt"
            onClick={() => setShowIdLogin(true)}
          >
            이메일 · 전화번호로 로그인
          </button>
        ) : (
          <form onSubmit={submitIdLogin} className="auth__id">
            <div className="auth-tabs" role="tablist" aria-label="회원 계정">
              <button type="button" role="tab" className="auth-tabs__btn" aria-selected={memberMode === 'login'} onClick={() => { setMemberMode('login'); setNotice(''); }}>로그인</button>
              <button type="button" role="tab" className="auth-tabs__btn" aria-selected={memberMode === 'signup'} onClick={() => { setMemberMode('signup'); setNotice(''); }}>회원가입</button>
            </div>
            {memberMode === 'signup' && (
              <label className="field">
                <span className="field__label">이름</span>
                <input className="input" autoComplete="name" placeholder="홍길동" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </label>
            )}
            <label className="field">
              <span className="field__label">이메일</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">비밀번호</span>
              <input
                className="input" type="password" minLength="8"
                autoComplete={memberMode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="8자 이상"
                value={password} onChange={(e) => setPassword(e.target.value)} required
              />
            </label>
            <button className="btn btn--ghost btn--block btn--sm" type="submit">
              {memberMode === 'login' ? '로그인' : '회원가입'}
            </button>
          </form>
        )}

        <p className="auth__signup">
          아직 계정이 없나요?{' '}
          <button type="button" className="auth__link" onClick={() => {
            setShowIdLogin(true); setMemberMode('signup'); setNotice('');
          }}>
            회원가입
          </button>
        </p>
      </div>

      <div className="auth__foot">
        <button
          type="button"
          className="auth__foot-link"
          onClick={() => {
            setStaffRole('trainer');
            setScreen('staff');
          }}
        >
          트레이너이신가요?
        </button>
        <span className="auth__foot-sep" aria-hidden="true">
          ·
        </span>
        <button
          type="button"
          className="auth__foot-link"
          onClick={() => {
            setStaffRole('owner');
            setScreen('staff');
          }}
        >
          관장님이신가요?
        </button>
      </div>

      {notice && <p className="tiny muted auth__hint">{notice}</p>}
      {CONFIG_ERROR && <p className="tiny auth__hint" role="alert">{CONFIG_ERROR}</p>}
    </div>
  );
}
