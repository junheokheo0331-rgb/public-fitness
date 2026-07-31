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

/* 트레이너가 만들어 둔 루틴 (송출·숙제 원본) */
export const TRAINER_ROUTINES = [
  { id: 'tr-1', gym_id: 'g-1', title: '입문자 전신 2분할', days: 2, goal: 'hypertrophy', level: 1, updated: '2026-07-20', origin: 'trainer' },
  { id: 'tr-2', gym_id: 'g-1', title: '감량 4주 · 유산소 포함', days: 4, goal: 'fatloss', level: 2, updated: '2026-07-18', origin: 'trainer' },
  { id: 'tr-3', gym_id: 'g-1', title: '하체 집중 · 무릎 케어', days: 3, goal: 'hypertrophy', level: 2, updated: '2026-07-25', origin: 'trainer' },
];

/* 트레이너 → 회원 숙제 전송 기록 */
export const HOMEWORK_LOG = [
  {
    id: 'hw-1', member_id: 'u-member', routine_id: 'tr-1',
    title: '박서연 트레이너가 보낸 숙제', note: '이번 주는 하체 위주로. 무릎 아프면 레그프레스 발 위치 높이세요.',
    due: '2026-08-02', sent_at: '2026-07-26',
  },
];

/* 운동 세션 로그 — workoutapp logs 이식 형태
   { [date]: { date, sessions:[{ id, routineId, dayIndex, startedAt, endedAt, exercises:[{code,name,sets:[{w,reps,rir,done}]}] }] } } */
export const WORKOUT_LOGS = {};

/* 종목별 누적 스탯 (자동조절 입력) */
export const EXERCISE_STATS = {
  LEG_PRESS_EX: { e1rm: 180, best_weight: 140, best_reps: 8 },
  SMITH_BENCH: { e1rm: 95, best_weight: 70, best_reps: 6 },
  LAT_PULLDOWN_W: { e1rm: 70, best_weight: 50, best_reps: 10 },
};

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

/* ---------- 지역 (카닥식 위치 선택) ---------- */
export const AREAS = [
  { id: 'b-seomyeon', label: '부산진구 서면', city: '부산', dong: '부전동' },
  { id: 'b-jeonpo',   label: '부산진구 전포', city: '부산', dong: '전포동' },
  { id: 'b-haeundae', label: '해운대구 우동', city: '부산', dong: '우동' },
  { id: 'b-nampo',    label: '중구 남포',     city: '부산', dong: '남포동' },
];

export const LOCATION = { areaId: 'b-seomyeon' };

/* 트레이너 분야 태그 — 찾기 필터·프로필 토글 공통 */
export const SPECIALTY_TAGS = [
  '재활', '보디빌딩', '다이어트', '입문', '스트렝스',
  '자세교정', '시니어', '여성', '선수출신', '체형', '근비대',
];

/* ---------- 트레이너 이력서 + 포트폴리오 ---------- */
export const TRAINERS = [
  {
    id: 'u-trainer', name: '박서연', gym_id: 'g-1', gym_name: '서면 스트렝스짐',
    area_id: 'b-seomyeon', distance_m: 320,
    headline: '근비대 · 자세교정 6년',
    bio: '서면에서 6년째. 무릎·어깨 아픈 분 많이 봐왔어요. 무리한 중량보다 폼 먼저.',
    specialties: ['근비대', '자세교정', '재활'],
    years: 6, rating_avg: 4.9, review_count: 128, sessions_done: 2100,
    certs: ['NSCA-CPT', '생활스포츠지도사 2급'],
    price_per_session: 65000, accepts_new: true,
    portfolio: [
      { id: 'pf1', kind: 'career', year: '2020–', title: '서면 스트렝스짐 전임', detail: '재활·자세교정 PT 담당' },
      { id: 'pf2', kind: 'cert', year: '2019', title: 'NSCA-CPT', detail: '미국 공인 퍼스널트레이너' },
      { id: 'pf3', kind: 'result', year: '2025', title: '무릎 재활 후 스쿼트 복귀', detail: '회원 사례 · 12주 프로그램' },
      { id: 'pf4', kind: 'media', year: '2024', title: '폼 교정 영상 시리즈', detail: '스쿼트·힌지 큐잉 가이드' },
    ],
  },
  {
    id: 'tr-2', name: '강민호', gym_id: 'g-1', gym_name: '서면 스트렝스짐',
    area_id: 'b-seomyeon', distance_m: 410,
    headline: '다이어트 · 보디빌딩',
    bio: '감량 후 요요 막는 루틴이 강점. 식단은 강요하지 않고 현실적으로 잡습니다.',
    specialties: ['다이어트', '보디빌딩', '체형'],
    years: 4, rating_avg: 4.7, review_count: 86, sessions_done: 980,
    certs: ['KATA 자격'],
    price_per_session: 55000, accepts_new: true,
    portfolio: [
      { id: 'pf5', kind: 'career', year: '2022–', title: '서면 스트렝스짐', detail: '다이어트·체형 PT' },
      { id: 'pf6', kind: 'result', year: '2025', title: '12주 −8kg 유지', detail: '요요 없이 체지방만 감량' },
    ],
  },
  {
    id: 'tr-3', name: '윤지아', gym_id: 'g-2', gym_name: '전포 헬스클럽',
    area_id: 'b-jeonpo', distance_m: 780,
    headline: '여성 · 입문 전문',
    bio: '헬스장 처음이어도 괜찮아요. 기구 사용법부터 천천히.',
    specialties: ['입문', '여성', '체형'],
    years: 3, rating_avg: 4.8, review_count: 64, sessions_done: 540,
    certs: ['생활스포츠지도사 2급'],
    price_per_session: 50000, accepts_new: true,
    portfolio: [
      { id: 'pf7', kind: 'career', year: '2023–', title: '전포 헬스클럽', detail: '여성·입문반' },
      { id: 'pf8', kind: 'cert', year: '2022', title: '생활스포츠지도사 2급', detail: '' },
    ],
  },
  {
    id: 'tr-4', name: '한도윤', gym_id: 'g-3', gym_name: '해운대 바디랩',
    area_id: 'b-haeundae', distance_m: 4500,
    headline: '스트렝스 · 보디빌딩',
    bio: '스쿼트·데드 폼 잡는 데 집중. 대회 준비도 가능.',
    specialties: ['스트렝스', '보디빌딩', '선수출신'],
    years: 8, rating_avg: 4.9, review_count: 201, sessions_done: 3200,
    certs: ['NSCA-CSCS'],
    price_per_session: 80000, accepts_new: true,
    portfolio: [
      { id: 'pf9', kind: 'career', year: '2018–', title: '해운대 바디랩 헤드', detail: '스트렝스·대회 준비' },
      { id: 'pf10', kind: 'result', year: '2024', title: '파워리프팅 지역 대회 지도', detail: '입상 회원 3명' },
      { id: 'pf11', kind: 'cert', year: '2017', title: 'NSCA-CSCS', detail: '' },
    ],
  },
  {
    id: 'tr-5', name: '조예린', gym_id: 'g-2', gym_name: '전포 헬스클럽',
    area_id: 'b-jeonpo', distance_m: 850,
    headline: '재활 · 시니어',
    bio: '수술 후·만성 통증 있는 분 위주. 정형외과 연계 경험.',
    specialties: ['재활', '시니어', '자세교정'],
    years: 7, rating_avg: 4.9, review_count: 95, sessions_done: 1600,
    certs: ['물리치료사', '생활스포츠지도사 2급'],
    price_per_session: 70000, accepts_new: true,
    portfolio: [
      { id: 'pf12', kind: 'career', year: '2019–', title: '전포 헬스클럽 재활 PT', detail: '' },
      { id: 'pf13', kind: 'cert', year: '2016', title: '물리치료사 면허', detail: '' },
    ],
  },
];

/* ---------- PT 역경매: 요청 → 지원 → 선택 ---------- */
export const PT_REQUESTS = [
  {
    id: 'req-1',
    member_id: 'u-other',
    member_name: '이서준',
    area_id: 'b-seomyeon',
    dong: '부산진구 부전동',
    distance_m: 450,
    goal: '근비대',
    sessions: 20,
    budget_max: 1300000,
    schedule: '평일 저녁',
    note: '하체 위주로 키우고 싶어요. 무릎이 좀 안 좋습니다.',
    status: 'open', // open | matched | closed
    created: '2026-07-28',
  },
  {
    id: 'req-2',
    member_id: 'u-other-2',
    member_name: '박하늘',
    area_id: 'b-seomyeon',
    dong: '부산진구 부전동',
    distance_m: 600,
    goal: '감량',
    sessions: 10,
    budget_max: 600000,
    schedule: '주말 오전',
    note: '헬스 입문입니다. 친절한 분 찾아요.',
    status: 'open',
    created: '2026-07-29',
  },
  {
    id: 'req-3',
    member_id: 'u-other-3',
    member_name: '최유진',
    area_id: 'b-jeonpo',
    dong: '부산진구 전포동',
    distance_m: 900,
    goal: '자세교정',
    sessions: 12,
    budget_max: 720000,
    schedule: '평일 낮',
    note: '거북목·라운드숄더 교정 원합니다.',
    status: 'open',
    created: '2026-07-27',
  },
];

export const PT_APPLICATIONS = [
  {
    id: 'app-1', request_id: 'req-1', trainer_id: 'tr-2',
    message: '무릎 부담 적은 하체 루틴으로 20회 구성해 드릴게요. 레그프레스·힙힌지 위주.',
    proposed_price: 1100000, proposed_per: 55000,
    status: 'pending', created: '2026-07-28',
  },
  {
    id: 'app-2', request_id: 'req-2', trainer_id: 'u-trainer',
    message: '입문자 감량 10회 패키지. 식단은 현실 가능한 선만 제안합니다.',
    proposed_price: 550000, proposed_per: 55000,
    status: 'pending', created: '2026-07-29',
  },
];
