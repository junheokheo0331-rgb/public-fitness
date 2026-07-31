import { useState } from 'react';
import { useSession, ROLE_LABEL } from '../lib/session.jsx';
import { IS_MOCK } from '../lib/api.js';

/* 회원 로그인이 메인. 트레이너·관장은 하단 보조 링크로만 노출한다.

   실제 권한은 서버가 판정한다. 여기서 고르는 건 "어떤 화면부터
   보여줄까"일 뿐이고, 간편 로그인·사업자 인증은 UI 골격이다. */

const SOCIAL = [
  { id: 'kakao', mark: 'K', label: '카카오로 시작하기' },
  { id: 'naver', mark: 'N', label: '네이버로 시작하기' },
  { id: 'apple', mark: '', label: 'Apple로 시작하기' },
];

export default function Login() {
  const { signIn } = useSession();
  const [screen, setScreen] = useState('member'); // member | staff
  const [staffRole, setStaffRole] = useState('trainer'); // trainer | owner
  const [showIdLogin, setShowIdLogin] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [bizNo, setBizNo] = useState('');
  const [gymName, setGymName] = useState('');

  const enterMember = () => signIn('member');

  const submitIdLogin = (e) => {
    e.preventDefault();
    enterMember();
  };

  const submitStaff = (e) => {
    e.preventDefault();
    signIn(staffRole);
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
        <p className="auth__tag">사업자·소속 지점 인증이 필요합니다.</p>

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
            <span className="field__label">사업자등록번호</span>
            <input
              className="input input--num"
              inputMode="numeric"
              placeholder="000-00-00000"
              value={bizNo}
              onChange={(e) => setBizNo(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span className="field__label">
              {staffRole === 'trainer' ? '소속 지점' : '운영 지점'}
            </span>
            <input
              className="input"
              placeholder="예: GymLink 서면점"
              value={gymName}
              onChange={(e) => setGymName(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span className="field__label">휴대폰 번호</span>
            <input
              className="input input--num"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="010 0000 0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>

          <button className="btn btn--block" type="submit">
            {ROLE_LABEL[staffRole]} 인증 후 들어가기
          </button>
        </form>

        {IS_MOCK && (
          <p className="tiny muted auth__hint">
            연습용입니다. 사업자번호·지점은 아무거나 넣어도 들어갑니다.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="auth">
      <header className="auth__head">
        <p className="eyebrow">부산 · 서면</p>
        <h1 className="auth__mark">Gym<span>Link</span></h1>
        <p className="auth__tag">
          이 헬스장에 <strong>실제로 있는 기구</strong>로만 루틴을 짭니다.
        </p>
      </header>

      <div className="auth__main">
        <div className="social">
          {SOCIAL.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`social__btn social__btn--${s.id}`}
              onClick={enterMember}
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
              <span className="field__label">또는 휴대폰 번호</span>
              <input
                className="input input--num"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="010 0000 0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <button className="btn btn--ghost btn--block btn--sm" type="submit">
              로그인
            </button>
          </form>
        )}

        <p className="auth__signup">
          아직 계정이 없나요?{' '}
          <button type="button" className="auth__link" onClick={enterMember}>
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

      {IS_MOCK && (
        <p className="tiny muted auth__hint">
          연습용 데이터로 돌고 있습니다. 아무 버튼이나 눌러도 들어갑니다.
        </p>
      )}
    </div>
  );
}
