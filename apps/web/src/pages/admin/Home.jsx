import { useEffect, useState } from 'react';
import { TopBar, Card, Chip, Note, Plate, won } from '../../ui/bits.jsx';
import { platformOverview, adminReports, setReportStatus } from '../../lib/api.js';

const REASON = {
  harassment: '불쾌한 접근', private_contact: '개인 연락 유도', no_show: '노쇼',
  fraud: '사기 의심', inappropriate: '부적절한 내용', other: '기타',
};

export default function AdminHome() {
  const [overview, setOverview] = useState(null);
  const [reports, setReports] = useState(null);

  async function load() {
    const [summary, rows] = await Promise.all([platformOverview(), adminReports()]);
    setOverview(summary);
    setReports(rows);
  }

  useEffect(() => { load(); }, []);

  async function close(id) {
    await setReportStatus(id, 'closed');
    setReports((rows) => rows.map((row) => row.id === id ? { ...row, status: 'closed' } : row));
  }

  return (
    <>
      <TopBar title="본사 운영" sub="입점 · 신고 · 플랫폼 품질" right={<Chip kind="role">ADMIN</Chip>} />

      {!overview ? <Card><p className="muted small">불러오는 중…</p></Card> : (
        <div className="admin-stats">
          <Card><p className="eyebrow">활성 헬스장</p><Plate value={overview.activeGyms} unit={`/${overview.gyms}곳`} /></Card>
          <Card><p className="eyebrow">회원</p><Plate value={overview.members} unit="명" ghost /></Card>
          <Card><p className="eyebrow">트레이너</p><Plate value={overview.trainers} unit="명" ghost /></Card>
          <Card><p className="eyebrow">미처리 신고</p><Plate value={overview.openReports} unit="건" ghost /></Card>
        </div>
      )}

      {overview?.monthlyGmv != null && (
        <Card>
          <div className="row row--between">
            <div><p className="eyebrow">이번 달 현장 계약 추정액</p><p className="card__note">결제 대행이 아닌 계약 원장 기준</p></div>
            <strong className="metric-money">{won(overview.monthlyGmv)}</strong>
          </div>
        </Card>
      )}

      <div className="cols2">
        <Card title="신고 처리" note="대화 원문은 신고 건에 한해 확인" flush>
          {!reports && <p className="muted small" style={{ padding: 16 }}>불러오는 중…</p>}
          <ul className="list">
            {reports?.map((report) => (
              <li key={report.id} className="list__item" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                <div className="list__body">
                  <div className="row row--wrap">
                    <strong className="list__title">{REASON[report.reason] ?? report.reason}</strong>
                    <Chip kind={report.status === 'closed' ? 'go' : 'stop'}>{report.status === 'closed' ? '처리 완료' : '확인 필요'}</Chip>
                  </div>
                  <p className="list__meta" style={{ marginTop: 5 }}>{report.detail || '상세 내용 없음'}</p>
                  {(report.reporter_name || report.target_name) && <p className="tiny muted">{report.reporter_name} → {report.target_name}</p>}
                </div>
                {report.status !== 'closed' && <button className="btn btn--sm btn--ghost" onClick={() => close(report.id)}>완료</button>}
              </li>
            ))}
          </ul>
        </Card>

        <div>
          <Card title="입점 심사 체크리스트">
            {['사업자등록번호 확인', '기구 목록·사진 검수', '가격표·정가 공개', '트레이너 자격 이력 확인'].map((item, index) => (
              <div key={item} className="check-row"><span>{index + 1}</span><strong>{item}</strong><Chip kind={index < 2 ? 'go' : undefined}>{index < 2 ? '자동' : '검토'}</Chip></div>
            ))}
          </Card>
          <Note kind="volt" title="운영 원칙">
            <p className="small">본사 화면은 모든 데이터를 보는 화면이 아닙니다. 신고 처리·입점 심사·감사 로그처럼 업무에 필요한 범위만 열어 개인정보 노출을 줄입니다.</p>
          </Note>
        </div>
      </div>
    </>
  );
}
