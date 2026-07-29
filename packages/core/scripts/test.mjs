/* 루틴 엔진 · 환불 계산 · 결과지 파서 스모크 테스트.
   실행: npm test  (또는 node packages/core/scripts/test.mjs)
   Supabase 없이 돈다. 뭘 붙이기 전에 이걸 먼저 통과시켜라. */

import { buildRoutine, e1rm, nextTarget, snapWeight } from '../src/engine/routine.js';
import { calcRefund } from '../src/engine/refund.js';
import { parseBodySheet, toRecord, normalize } from '../src/inbody/parse.js';

let fail = 0;
const ok = (name, cond) => { console.log(`${cond ? '  ok' : 'FAIL'}  ${name}`); if (!cond) fail++; };

/* --- 가상의 헬스장 A: 머신이 부족한 동네 헬스장 --- */
const gymA = [
  { code:'SMITH_BENCH', name_ko:'스미스 벤치프레스', pattern:'horizontal_push', is_compound:true, skill_level:1, machine_code:'SMITH', is_substitute:false, min_step_kg:5, contraindications:[] },
  { code:'LAT_PULLDOWN_WIDE', name_ko:'랫풀다운', pattern:'vertical_pull', is_compound:true, skill_level:1, machine_code:'LAT_PULLDOWN', is_substitute:false, min_step_kg:5, contraindications:[] },
  { code:'SEATED_CABLE_ROW', name_ko:'시티드 케이블로우', pattern:'horizontal_pull', is_compound:true, skill_level:1, machine_code:'SEATED_ROW', is_substitute:false, min_step_kg:5, contraindications:[] },
  { code:'LEG_PRESS_EX', name_ko:'레그프레스', pattern:'squat', is_compound:true, skill_level:1, machine_code:'LEG_PRESS', is_substitute:false, min_step_kg:10, contraindications:[] },
  { code:'PLANK', name_ko:'플랭크', pattern:'core', is_compound:false, skill_level:1, machine_code:null, is_substitute:false, min_step_kg:null, contraindications:[] },
  { code:'ZONE2_TREADMILL', name_ko:'트레드밀 Zone2', pattern:'cardio', is_compound:false, skill_level:1, machine_code:'TREADMILL', is_substitute:false, min_step_kg:null, contraindications:[] },
  { code:'DEADLIFT', name_ko:'데드리프트', pattern:'hinge', is_compound:true, skill_level:3, machine_code:'BARBELL', is_substitute:false, min_step_kg:2.5, contraindications:['low_back'] },
];

console.log('\n[1] 머신 제약 — 이 프로젝트의 차별점');
const r1 = buildRoutine({ available: gymA, daysPerWeek: 3, goal: 'hypertrophy', level: 1, zone2: true });
const allCodes = r1.days.flatMap(d => d.items.map(i => i.exercise_code));
ok('보유 기구 밖 종목이 섞이지 않는다', allCodes.every(c => gymA.some(e => e.code === c)));
ok('초보 레벨에 상급 종목(데드리프트)이 안 나온다', !allCodes.includes('DEADLIFT'));
ok('기구 없는 패턴은 경고로 알린다', r1.warnings.length > 0);
ok('Zone2가 매 세션에 붙는다', r1.days.every(d => d.items.some(i => i.exercise_code === 'ZONE2_TREADMILL')));
console.log('   경고:', r1.warnings.join(' / ') || '(없음)');

console.log('\n[2] 통증 부위 회피');
const r2 = buildRoutine({ available: gymA, daysPerWeek: 3, level: 3, avoid: ['low_back'] });
ok('허리 불편을 신고한 회원에게 데드리프트를 주지 않는다',
   !r2.days.flatMap(d => d.items.map(i => i.exercise_code)).includes('DEADLIFT'));

console.log('\n[3] 중량 스냅 (2.5kg 원판 없는 헬스장)');
ok('10kg 단위 스택에서 87 → 80', snapWeight(87, 10) === 80);
ok('5kg 단위에서 63 → 60', snapWeight(63, 5) === 60);

console.log('\n[4] e1RM / 자동조절');
const est = e1rm(100, 5, 2);
ok(`벤치 100kg×5 RIR2 → e1RM ${est}kg (115~125 범위)`, est > 115 && est < 125);
const nx = nextTarget({ weight: 100, reps: 5, rir: 2 }, { reps: [6,10], rir: 2 }, 5);
ok(`다음 목표 ${nx.weight}kg × ${nx.reps}회 — ${nx.note}`, nx.weight % 5 === 0);

console.log('\n[5] 환불 계산 — 기간제');
const f1 = calcRefund({ amount: 600000, serviceFrom: '2026-01-01', serviceTo: '2026-06-30', asOf: '2026-02-01' });
ok('환불액이 0 이상 결제액 이하', f1.refund >= 0 && f1.refund <= 600000);
ok('위약금이 총액의 10%', f1.penalty === 60000);
console.log('   ', f1.explain);

console.log('\n[6] 환불 계산 — 횟수제 PT');
const f2 = calcRefund({ amount: 1000000, serviceFrom: '2026-01-01', totalSessions: 20, usedSessions: 5, listPrice: 1200000 });
ok('사용 5회 × 정가 6만원 = 30만원 공제', f2.usedAmount === 300000);
console.log('   ', f2.explain);

console.log('\n[7] 사업자 귀책(폐업)');
const f3 = calcRefund({ amount: 600000, serviceFrom: '2026-01-01', serviceTo: '2026-06-30', asOf: '2026-02-01', fault: 'business' });
ok('위약금 없음', f3.penalty === 0);

/* ══════════════════════════════════════════════════════════
   체성분 결과지 파서
   사진은 서버로 가지 않는다. 이 파서가 기기 안에서 숫자만 뽑는다.
   ══════════════════════════════════════════════════════════ */

console.log('\n[8] 결과지 파싱 — 깨끗한 입력');
const clean = `
체성분분석 결과지
신장 172.5 cm
체중 72.4 kg
골격근량 33.1 kg
체지방량 14.5 kg
체지방률 20.0 %
BMI 24.3
기초대사량 1652 kcal
`;
const p1 = parseBodySheet(clean);
ok(`체중 72.4 인식 (읽은 값 ${p1.values.weight_kg})`, p1.values.weight_kg === 72.4);
ok(`골격근량 33.1 인식 (${p1.values.skeletal_muscle_kg})`, p1.values.skeletal_muscle_kg === 33.1);
ok(`체지방률 20.0 인식 (${p1.values.body_fat_pct})`, p1.values.body_fat_pct === 20.0);
ok(`기초대사량 1652 인식 (${p1.values.bmr_kcal})`, p1.values.bmr_kcal === 1652);
ok(`신뢰도 0.6 이상 (${p1.confidence})`, p1.confidence >= 0.6);
ok('교차검증 통과 — 지적사항 없음', p1.issues.length === 0);

console.log('\n[9] 결과지 파싱 — OCR 이 글자를 숫자로 잘못 읽은 경우');
const dirty = `
체중  7Z.4 kg
골격근량  33.l kg
체지방량  l4.5 kg
체지방률  2O.O %
`;
const p2 = parseBodySheet(dirty);
ok(`O/l/Z 를 0/1/2 로 복원 (체중 ${p2.values.weight_kg})`, p2.values.weight_kg === 72.4);
ok(`체지방률 복원 (${p2.values.body_fat_pct})`, p2.values.body_fat_pct === 20.0);
ok('복원한 값은 신뢰도를 깎는다', p2.confidence < p1.confidence);

console.log('\n[10] 교차검증 — 숫자 하나가 틀렸을 때 잡아내는가');
const wrong = `
체중 72.4 kg
골격근량 33.1 kg
체지방량 14.5 kg
체지방률 35.0 %
`;
const p3 = parseBodySheet(wrong);
ok('체지방률 불일치를 감지한다', p3.issues.some(i => i.includes('맞지 않습니다')));
ok('불일치 시 저신뢰로 표시한다', p3.lowConfidence === true);
console.log('   ', p3.issues[0]);

const impossible = `체중 60.0 kg\n골격근량 40.0 kg\n체지방량 25.0 kg\n체지방률 41.7 %`;
ok('근육+지방 > 체중 인 경우도 잡는다',
   parseBodySheet(impossible).issues.some(i => i.includes('체중보다 큽니다')));

console.log('\n[11] 파싱 실패 — 조용히 넘어가지 않는가');
const garbage = `오늘 날씨가 좋습니다\n영수증 12,000원`;
const p4 = parseBodySheet(garbage);
ok('필수 항목 누락을 알린다', p4.issues.some(i => i.includes('읽지 못했습니다')));
ok(`신뢰도가 낮다 (${p4.confidence})`, p4.confidence < 0.3);
ok('항상 사람이 확인하게 한다', p4.needsReview === true);

console.log('\n[12] 표 형식 — 라벨과 값이 다른 줄에 있는 경우');
const table = `
체중
72.4 kg
골격근량
33.1 kg
체지방률
20.0 %
`;
ok('다음 줄의 값을 집어온다', parseBodySheet(table).values.weight_kg === 72.4);

console.log('\n[13] 저장 페이로드 — 이미지가 새어나가지 않는가');
const rec = toRecord(p1, { memberId: 'm-1', gymId: 'g-1', measuredAt: '2026-07-28T09:00:00Z' });
const keys = Object.keys(rec);
ok('이미지·OCR 원문 관련 필드가 없다',
   !keys.some(k => /image|photo_data|raw|file|base64|url/i.test(k)));
ok('source 가 photo_ocr', rec.source === 'photo_ocr');
ok('회원 확인 전이므로 verified_by_member = false', rec.verified_by_member === false);
console.log('   전송 필드:', keys.join(', '));

console.log('\n[14] 대리입력 — 동의 없이 저장되지 않는가');
let blocked = false;
try {
  toRecord(p1, { memberId: 'm-1', source: 'proxy', enteredBy: 't-1' });
} catch (e) { blocked = /동의/.test(e.message); }
ok('consent_id 없는 대리입력은 예외를 던진다', blocked);
const proxyRec = toRecord(p1, { memberId: 'm-1', source: 'proxy', enteredBy: 't-1', consentId: 'c-1' });
ok('동의가 있으면 통과하고 entered_by 가 남는다',
   proxyRec.entered_by === 't-1' && proxyRec.consent_id === 'c-1');

console.log('\n[15] 정규화');
ok('공백 낀 소수점 결합', normalize('체중 72 . 4 kg').includes('72.4'));
ok('천단위 콤마 제거', normalize('1,652 kcal').includes('1652'));

console.log(fail ? `\n실패 ${fail}건\n` : '\n전부 통과\n');
process.exit(fail ? 1 : 0);
