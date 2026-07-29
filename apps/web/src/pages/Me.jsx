import { useEffect, useState } from 'react';
import { CONSENT_KINDS } from '@gymlink/core/constants';
import { TopBar, Card, Chip, Note } from '../ui/bits.jsx';
import { useSession, ROLE_LABEL } from '../lib/session.jsx';
import { getConsents, grantConsent, revokeConsent, IS_MOCK } from '../lib/api.js';

/* 내 정보 — 실질적으로는 동의 관리 화면이다.

   동의를 받아놓고 철회할 방법을 안 주는 앱이 너무 많다.
   여기서는 켜고 끄는 스위치와, 끄면 무슨 일이 벌어지는지를 같이 둔다. */

export default function Me() {
  const { session, signOut } = useSession();
  const [consents, setConsents] = useState(null);
  const [busy, setBusy] = useState(null);
  const [flash, setFlash] = useState(null);

  useEffect(() => { getConsents().then(setConsents); }, []);

  async function toggle(kind, on) {
    setBusy(kind);
    try {
      if (on) {
        await grantConsent(kind);
        setFlash(null);
      } else {
        const res = await revokeConsent(kind);
        setFlash(
          kind === 'health_sensitive'
            ? '체성분 기록을 모두 삭제했습니다.'
            : kind === 'proxy_entry'
              ? '트레이너가 대신 입력한 기록을 삭제했습니다.'
              : null,
        );
      }
      setConsents(await getConsents());
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <TopBar
        title={session.name}
        sub={`${ROLE_LABEL[session.role]}으로 로그인`}
        right={<Chip kind="role">{ROLE_LABEL[session.role]}</Chip>}
      />

      {flash && <Note kind="go"><p className="small">{flash}</p></Note>}

      <Card title="동의 관리" note="언제든 끄고 켤 수 있습니다">
        {!consents && <p className="muted small">불러오는 중…</p>}
        {consents && CONSENT_KINDS.map((c) => {
          const on = !!consents[c.kind];
          return (
            <div key={c.kind} style={{ padding: '12px 0', borderBottom: '1px solid var(--line-2)' }}>
              <div className="row row--between">
                <div className="grow">
                  <div className="row" style={{ gap: 6 }}>
                    <strong className="small">{c.label}</strong>
                    {c.required && <Chip>필수</Chip>}
                  </div>
                  {c.note && <p className="tiny muted" style={{ margin: '4px 0 0' }}>{c.note}</p>}
                </div>
                <button
                  className={`btn btn--sm ${on ? 'btn--ghost' : ''}`}
                  disabled={c.required || busy === c.kind}
                  onClick={() => toggle(c.kind, !on)}
                >
                  {busy === c.kind ? '…' : on ? '철회' : '동의'}
                </button>
              </div>
            </div>
          );
        })}

        <Note kind="volt" title="철회하면 기록도 지워집니다">
          <p className="small">
            건강정보 동의를 철회하면 저장된 체성분 기록을 함께 삭제합니다.
            동의 없이 보관하는 건 법에 어긋나기 때문에, 유예 기간을 두지 않습니다.
          </p>
        </Note>
      </Card>

      <Card title="내 정보 내려받기">
        <p className="small muted">
          저장된 기록 전부를 파일로 받을 수 있습니다. 회원 탈퇴 시에는 전부 삭제됩니다.
        </p>
        <button className="btn btn--ghost btn--block btn--sm" style={{ marginTop: 10 }}>
          내 데이터 내려받기
        </button>
      </Card>

      <button className="btn btn--ghost btn--block" onClick={signOut}>로그아웃</button>

      {IS_MOCK && (
        <p className="tiny muted" style={{ textAlign: 'center', marginTop: 14 }}>
          연습용 데이터로 돌고 있습니다. 로그아웃하면 다른 역할로 다시 들어갈 수 있습니다.
        </p>
      )}
    </>
  );
}
