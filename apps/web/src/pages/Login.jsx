import { useState } from 'react';
import { useSession, ROLE_LABEL } from '../lib/session.jsx';
import { IS_MOCK } from '../lib/api.js';

/* 로그인 화면에서 역할을 먼저 고른다.

   왜 로그인 뒤가 아니라 앞인가:
   회원·트레이너·관장은 같은 앱을 쓰지만 하는 일이 전혀 다르다.
   들어와서 헤매게 하는 것보다 문 앞에서 갈라주는 게 낫다.
   실제 권한은 로그인 뒤 서버가 판정한다. 여기서 고르는 건
   "어떤 화면부터 보여줄까"일 뿐이고, 권한이 아니다. */

const ROLES = [
  { key: 'member',  mark: '회', name: '회원',      desc: '운동하러 다니는 사람' },
  { key: 'trainer', mark: '트', name: '트레이너',   desc: '회원 관리와 수업' },
  { key: 'owner',   mark: '관', name: '관장·직원',  desc: '헬스장 운영' },
];

export default function Login() {
  const { signIn } = useSession();
  const [role, setRole] = useState('member');
  const [phone, setPhone] = useState('');

  const submit = (e) => {
    e.preventDefault();
    signIn(role);
  };

  return (
    <div className="auth">
      <p className="eyebrow">부산 · 서면</p>
      <h1 className="auth__mark">GymLink</h1>
      <p className="auth__tag">
        이 헬스장에 <strong>실제로 있는 기구</strong>로만 루틴을 짭니다.
      </p>

      <form onSubmit={submit}>
        <fieldset style={{ border: 0, padding: 0, margin: '0 0 4px' }}>
          <legend className="field__label" style={{ padding: 0 }}>어떤 자격으로 들어오시나요?</legend>
          <div className="roles">
            {ROLES.map((r) => (
              <button
                key={r.key}
                type="button"
                className="role"
                aria-pressed={role === r.key}
                onClick={() => setRole(r.key)}
              >
                <span className="role__key" aria-hidden="true">{r.mark}</span>
                <span className="grow">
                  <span className="role__name">{r.name}</span>
                  <span className="role__desc" style={{ display: 'block' }}>{r.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

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
          {ROLE_LABEL[role]}으로 시작하기
        </button>
      </form>

      {IS_MOCK && (
        <p className="tiny muted" style={{ marginTop: 18, textAlign: 'center' }}>
          연습용 데이터로 돌고 있습니다. 번호는 아무거나 넣어도 들어갑니다.
        </p>
      )}
    </div>
  );
}
