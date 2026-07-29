import { useEffect, useState } from 'react';
import { calcRefund } from '@gymlink/core/refund';
import { TopBar, Card, Chip, Note, won } from '../../ui/bits.jsx';
import { gymRoster } from '../../lib/api.js';
import { useSession } from '../../lib/session.jsx';

/* 회원 명단 + 출입 시스템 내보내기.

   기존 헬스장은 이미 출입기와 회원관리 프로그램을 쓰고 있다.
   그걸 대체하려 들면 입점 자체가 막힌다. 우리는 명단을 CSV 로 내보내고,
   관장이 쓰던 시스템에 올린다. 손이 한 번 더 가지만 갈아엎지 않아도 된다.
   자동 연동은 제휴가 성사된 뒤에 얹을 일이다. */

function toCSV(rows) {
  const head = ['이름', '회원권', '시작일', '종료일', '결제금액', '상태'];
  const body = rows.map((r) => [
    r.name, r.plan, r.starts, r.ends, r.paid, r.active ? '유효' : '만료',
  ]);
  return [head, ...body]
    .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
}

export default function Roster() {
  const { session } = useSession();
  const [rows, setRows] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => { gymRoster(session.gymId).then(setRows); }, [session.gymId]);

  function download() {
    // 엑셀이 한글을 깨뜨리지 않도록 BOM 을 붙인다. 현장에서 이걸로 자주 막힌다.
    const blob = new Blob(['\uFEFF' + toCSV(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `회원명단_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!rows) return <><TopBar title="회원" /><Card><p className="muted small">불러오는 중…</p></Card></>;

  return (
    <>
      <TopBar
        title="회원"
        sub={`${rows.filter((r) => r.active).length}명 유효 · 전체 ${rows.length}명`}
        right={<button className="btn btn--sm btn--ghost" onClick={download}>CSV 내보내기</button>}
      />

      <Card flush>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>이름</th><th>회원권</th><th>기간</th>
                <th className="num">결제금액</th><th>상태</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const left = Math.ceil((new Date(r.ends) - new Date()) / 86400000);
                const ref = calcRefund({
                  amount: r.paid, serviceFrom: r.starts, serviceTo: r.ends,
                });
                return (
                  <tr key={r.id}>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.plan}</td>
                    <td className="mono tiny">
                      {r.starts.slice(2).replace(/-/g, '.')} – {r.ends.slice(2).replace(/-/g, '.')}
                    </td>
                    <td className="num">{r.paid.toLocaleString('ko-KR')}</td>
                    <td>
                      {!r.active
                        ? <Chip>만료</Chip>
                        : left <= 30
                          ? <Chip kind="sub">{left}일 남음</Chip>
                          : <Chip kind="go">유효</Chip>}
                    </td>
                    <td>
                      {r.active && (
                        <button
                          className="btn btn--sm btn--ghost"
                          onClick={() => setOpenId(openId === r.id ? null : r.id)}
                        >
                          {openId === r.id ? '닫기' : '해지 시'}
                        </button>
                      )}
                      {openId === r.id && (
                        <div className="tiny mono" style={{ marginTop: 6, whiteSpace: 'nowrap' }}>
                          환불 {won(ref.refund)}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Note title="출입 시스템에 올리는 법">
        <p className="small">
          CSV 를 내려받아 쓰시던 회원관리 프로그램의 회원 일괄등록 기능으로 올리면 됩니다.
          엑셀에서 한글이 깨지지 않도록 처리해 두었습니다.
        </p>
        <p className="small" style={{ marginTop: 6 }}>
          출입기를 바꾸실 필요는 없습니다. 저희는 명단만 넘깁니다.
        </p>
      </Note>

      <Note kind="volt" title="해지 요청을 받으셨다면">
        <p className="small">
          &lsquo;해지 시&rsquo; 버튼의 금액은 방문판매법과 소비자분쟁해결기준에 따라 계산한
          참고값입니다. 회원 앱에도 같은 금액이 보이므로, 다른 금액을 제시하시면
          분쟁이 생깁니다.
        </p>
      </Note>
    </>
  );
}
