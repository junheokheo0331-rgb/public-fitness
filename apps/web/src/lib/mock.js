/* ============================================================
   mock.js — Supabase 없이 화면부터 보기 위한 가짜 데이터

   기구·종목 표준 목록은 여기 없다. catalog.js 에 있고, 그건
   db/04_seed.sql 에서 추출한 것이다. 목 모드와 실제 DB가 다른
   목록을 쓰면 화면에서 본 게 배포하면 달라진다.

   실제 붙일 때는 lib/api.js 의 함수 몸통만 supabase 호출로 바꾸면 된다.
   화면 코드는 mock 을 직접 import 하지 않는다. 항상 api.js 를 거친다.
   ============================================================ */

export const ME = {
  member:  { id: 'u-member',  name: '김지훈', role: 'member' },
  trainer: { id: 'u-trainer', name: '박서연', role: 'trainer' },
  owner:   { id: 'u-owner',   name: '이상혁', role: 'owner' },
};

/* ---------- 헬스장 ---------- */
export const GYMS = [
  {
    id: 'g-1', name: '서면 스트렝스짐', dong: '부산진구 부전동',
    distance_m: 340, open: '05:30–24:00', members: 412,
    machines: ['POWER_RACK','SMITH','BENCH_FLAT','BENCH_ADJ','BARBELL','PLATE_SMALL','EZ_BAR','DUMBBELL','KETTLEBELL','CABLE_CROSS','LAT_PULLDOWN','SEATED_ROW','LEG_PRESS','LEG_EXT','LEG_CURL','HIP_ABD','DIP_STATION','PULLUP_BAR','TREADMILL','CYCLE','MAT','BOX','BAND'],
    plans: [
      { id: 'p-1', kind: 'membership', name: '6개월 회원권', months: 6, price: 390000, list_price: 480000 },
      { id: 'p-2', kind: 'membership', name: '3개월 회원권', months: 3, price: 240000, list_price: 270000 },
      { id: 'p-3', kind: 'pt', name: 'PT 20회', sessions: 20, price: 1200000, list_price: 1400000 },
    ],
    photos: [
      { id: 'ph-1', machine_code: 'POWER_RACK', caption: '파워랙 4대 · 2.5kg 원판 있음', tone: '#3B4250' },
      { id: 'ph-2', machine_code: 'DUMBBELL',   caption: '덤벨 2~40kg (2kg 단위)',       tone: '#5A4A3A' },
      { id: 'ph-3', machine_code: 'BENCH_ADJ',  caption: '조절식 벤치 6대',              tone: '#46524A' },
      { id: 'ph-4', machine_code: 'CABLE_CROSS',caption: '케이블 크로스오버',            tone: '#4A4050' },
    ],
    offers: [
      { key: 'routine',  title: '기구 기준 루틴',   desc: '이 헬스장에 있는 기구로만 짠 주간 루틴' },
      { key: 'template', title: '관장님 추천 루틴', desc: '초보자용 3분할 · 관장이 직접 짠 것' },
      { key: 'body',     title: '체성분 기록',      desc: '측정 결과지를 찍어서 기록' },
      { key: 'refund',   title: '해지 시 환불액',   desc: '지금 해지하면 얼마 돌려받는지' },
    ],
  },
  {
    id: 'g-2', name: '전포 헬스클럽', dong: '부산진구 전포동',
    distance_m: 820, open: '06:00–23:00', members: 190,
    machines: ['SMITH','BENCH_FLAT','LAT_PULLDOWN','SEATED_ROW','CHEST_PRESS','LEG_PRESS','LEG_EXT','DUMBBELL','TREADMILL','MAT'],
    photos: [
      { id: 'ph-5', machine_code: 'SMITH',      caption: '스미스 머신', tone: '#3F4652' },
      { id: 'ph-6', machine_code: 'LEG_PRESS',  caption: '레그프레스 · 10kg 단위', tone: '#524A3F' },
    ],
    plans: [
      { id: 'p-4', kind: 'membership', name: '3개월 회원권', months: 3, price: 180000, list_price: 210000 },
    ],
    offers: [
      { key: 'routine', title: '기구 기준 루틴', desc: '보유 기구 6종 기준' },
      { key: 'body',    title: '체성분 기록',    desc: '측정 결과지를 찍어서 기록' },
    ],
  },
  {
    id: 'g-3', name: '해운대 바디랩', dong: '해운대구 우동',
    distance_m: 4600, open: '24시간', members: 610,
    machines: ['POWER_RACK','HALF_RACK','SMITH','BENCH_FLAT','BENCH_ADJ','BARBELL','PLATE_SMALL','EZ_BAR','TRAP_BAR','DUMBBELL','KETTLEBELL','LANDMINE','FUNC_TRAINER','CABLE_CROSS','LAT_PULLDOWN','SEATED_ROW','CHEST_PRESS','PEC_DECK','SHOULDER_PR','LEG_PRESS','HACK_SQUAT','LEG_EXT','LEG_CURL','HIP_ABD','HIP_ADD','HIP_THRUST_M','CALF_MACHINE','BACK_EXT','AB_MACHINE','ASSIST_PULLUP','DIP_STATION','PULLUP_BAR','TREADMILL','CYCLE','ROWER','STAIRMILL','MAT','BAND','BOX','TRX','MEDBALL','SLED'],
    photos: [
      { id: 'ph-7', machine_code: 'FUNC_TRAINER', caption: '펑셔널 트레이너 2대', tone: '#404A58' },
      { id: 'ph-8', machine_code: 'HACK_SQUAT',   caption: '핵 스쿼트',          tone: '#4E4444' },
      { id: 'ph-9', machine_code: 'TRAP_BAR',     caption: '트랩바 · 허리 부담 적음', tone: '#3E4B44' },
    ],
    plans: [
      { id: 'p-5', kind: 'membership', name: '12개월 회원권', months: 12, price: 690000, list_price: 840000 },
      { id: 'p-6', kind: 'pt', name: 'PT 10회', sessions: 10, price: 700000, list_price: 750000 },
    ],
    offers: [
      { key: 'routine',  title: '기구 기준 루틴',   desc: '보유 기구 16종 — 전 분할 가능' },
      { key: 'template', title: '트레이너 루틴 3종', desc: '입문 / 근비대 / 감량' },
      { key: 'body',     title: '체성분 기록',      desc: '측정 결과지를 찍어서 기록' },
      { key: 'refund',   title: '해지 시 환불액',   desc: '지금 해지하면 얼마 돌려받는지' },
    ],
  },
];

/* ---------- 내 등록 현황 ---------- */
export const MY_MEMBERSHIP = {
  id: 'ms-1', gym_id: 'g-1', plan_name: '6개월 회원권',
  paid_amount: 390000, starts_on: '2026-05-01', ends_on: '2026-10-31',
};

export const MY_PT = {
  id: 'pt-1', gym_id: 'g-1', trainer_name: '박서연',
  paid_amount: 1200000, list_price: 1400000, total_sessions: 20, used_sessions: 7,
};

/* ---------- 저장된 루틴 ---------- */
export const SAVED_ROUTINES = [
  { id: 'r-1', gym_id: 'g-1', title: '주 3회 전신 · 근비대', days: 3, goal: 'hypertrophy', updated: '2026-07-24', origin: 'auto' },
  { id: 'r-2', gym_id: 'g-1', title: '관장님 추천 · 입문 3분할', days: 3, goal: 'hypertrophy', updated: '2026-06-11', origin: 'owner' },
  { id: 'r-3', gym_id: 'g-1', title: '박서연 트레이너가 보낸 숙제', days: 2, goal: 'hypertrophy', updated: '2026-07-26', origin: 'trainer', note: '이번 주는 하체 위주로. 무릎 아프면 레그프레스 발 위치 높이세요.' },
];

/* 트레이너가 만들어 둔 루틴 (송출 대상) */
export const TRAINER_ROUTINES = [
  { id: 'tr-1', gym_id: 'g-1', title: '입문자 전신 2분할', days: 2, goal: 'hypertrophy', updated: '2026-07-20', origin: 'trainer' },
  { id: 'tr-2', gym_id: 'g-1', title: '감량 4주 · 유산소 포함', days: 4, goal: 'fatloss', updated: '2026-07-18', origin: 'trainer' },
];

/* ---------- 체성분 기록 ---------- */
export const BODY_LOG = [
  { id:'b-3', measured_at:'2026-07-12', source:'photo_ocr', weight_kg:72.4, skeletal_muscle_kg:33.1, body_fat_pct:20.0, verified:true },
  { id:'b-2', measured_at:'2026-06-14', source:'proxy',     weight_kg:73.8, skeletal_muscle_kg:32.4, body_fat_pct:22.1, verified:true },
  { id:'b-1', measured_at:'2026-05-03', source:'manual',    weight_kg:75.2, skeletal_muscle_kg:31.9, body_fat_pct:24.0, verified:true },
];

/* ---------- 트레이너가 보는 담당 회원 ---------- */
export const MY_CLIENTS = [
  { id:'u-member', name:'김지훈', sessions_left:13, next:'2026-07-29 19:00', consent_proxy:true,  last_body:'2026-07-12' },
  { id:'c-2',      name:'최민아', sessions_left:4,  next:'2026-07-30 11:00', consent_proxy:false, last_body:'2026-06-02' },
  { id:'c-3',      name:'정우성', sessions_left:18, next:null,               consent_proxy:true,  last_body:null },
];

/* ---------- 관장이 보는 회원 명단 ---------- */
export const GYM_ROSTER = [
  { id:'u-member', name:'김지훈', plan:'6개월 회원권', starts:'2026-05-01', ends:'2026-10-31', paid:390000, active:true },
  { id:'m-2', name:'최민아', plan:'3개월 회원권', starts:'2026-06-15', ends:'2026-09-14', paid:240000, active:true },
  { id:'m-3', name:'정우성', plan:'6개월 회원권', starts:'2026-02-01', ends:'2026-07-31', paid:390000, active:true },
  { id:'m-4', name:'한지민', plan:'3개월 회원권', starts:'2026-07-20', ends:'2026-10-19', paid:240000, active:true },
  { id:'m-5', name:'오세훈', plan:'6개월 회원권', starts:'2026-01-10', ends:'2026-07-09', paid:360000, active:false },
];
