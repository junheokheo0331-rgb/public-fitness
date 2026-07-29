/* ============================================================
   refund.js — 환불 계산 (클라이언트 미리보기용)
   ※ 실제 확정 금액은 반드시 DB의 calc_refund() 결과를 쓴다.
     이 파일은 "해지하면 얼마 돌려받나요?"를 결제 전/해지 전에
     즉시 보여주기 위한 미러다. 두 구현이 어긋나면 SQL이 정답이다.

   근거
     방문판매법 제31조 — 계속거래는 소비자가 언제든 해지할 수 있다.
     방문판매법 제32조 — 사업자 손실을 현저히 초과하는 위약금 청구 금지.
     소비자분쟁해결기준(체육시설업) — 이용일수 공제 + 총액의 10% 공제.
   자세한 출처는 RESEARCH.pdf 2장.
   ============================================================ */

export const PENALTY_RATE = 0.10;

/**
 * @param {Object} o
 * @param {number} o.amount        결제금액(원)
 * @param {string} o.serviceFrom   'YYYY-MM-DD'
 * @param {string} [o.serviceTo]   기간제일 때
 * @param {number} [o.totalSessions] 횟수제일 때
 * @param {number} [o.usedSessions]
 * @param {number} [o.listPrice]   정가(회당 단가 산정 기준)
 * @param {string} [o.asOf]        기준일. 기본 오늘
 * @param {'consumer'|'business'} [o.fault]
 */
export function calcRefund(o) {
  const asOf = new Date(o.asOf || Date.now());
  const from = new Date(o.serviceFrom);
  const total = Math.round(o.amount);

  let usedDays = 0, usedSessions = 0, unit = 0, usedAmount = 0, mode;

  if (o.totalSessions) {
    mode = 'sessions';
    usedSessions = o.usedSessions || 0;
    unit = Math.round((o.listPrice || total) / o.totalSessions);
    usedAmount = usedSessions * unit;
  } else {
    mode = 'period';
    const to = new Date(o.serviceTo);
    const span = Math.max(days(from, to) + 1, 1);
    usedDays = Math.min(Math.max(days(from, asOf) + 1, 0), span);
    usedAmount = Math.round((total * usedDays) / span);
  }

  const penalty = o.fault === 'business' ? 0 : Math.round(total * PENALTY_RATE);
  const refund = Math.max(total - usedAmount - penalty, 0);

  return {
    mode, total, usedDays, usedSessions, unit, usedAmount, penalty, refund,
    fault: o.fault || 'consumer',
    // 사용자에게 그대로 보여줄 문장. 불투명한 결제가 문제였으니 숫자를 다 깐다.
    explain: mode === 'period'
      ? `결제 ${won(total)} − 이용 ${usedDays}일분 ${won(usedAmount)} − 위약금 10% ${won(penalty)} = ${won(refund)}`
      : `결제 ${won(total)} − 사용 ${usedSessions}회 × ${won(unit)} = ${won(usedAmount)} − 위약금 10% ${won(penalty)} = ${won(refund)}`,
  };
}

function days(a, b) { return Math.floor((b - a) / 86400000); }
function won(n) { return n.toLocaleString('ko-KR') + '원'; }
