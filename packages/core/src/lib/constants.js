export const ROLES = ['member', 'trainer', 'owner', 'admin'];

export const SPECIALTIES = [
  { key: 'rehab',    label: '재활' },
  { key: 'ortho',    label: '정형외과 질환' },
  { key: 'posture',  label: '체형교정' },
  { key: 'diet',     label: '식이/체중감량' },
  { key: 'contest',  label: '대회 준비' },
  { key: 'powerlift',label: '파워리프팅' },
  { key: 'senior',   label: '시니어' },
  { key: 'prenatal', label: '산전/산후' },
  { key: 'beginner', label: '입문자 전담' },
];

export const GOALS = [
  { key: 'strength',    label: '근력' },
  { key: 'hypertrophy', label: '근비대' },
  { key: 'fatloss',     label: '체지방 감량' },
  { key: 'conditioning', label: '컨디셔닝' },
];

export const LEVELS = [
  { key: 1, label: '초보',   desc: '운동 경력 6개월 미만 · 기구 사용법부터' },
  { key: 2, label: '중급',   desc: '6개월~2년 · 주요 종목 폼이 잡힌 상태' },
  { key: 3, label: '상급',   desc: '2년 이상 · 자유중량 3대 운동 가능' },
];

/** 환불 계산 상수. MVP는 결제를 받지 않고 "계산해서 보여주기"만 한다. */
export const REFUND_PENALTY_RATE = 0.10;  // 소비자분쟁해결기준 체육시설업

/** 동의 종류. DB의 consent_kind ENUM 과 1:1로 맞춘다. */
export const CONSENT_KINDS = [
  { key: 'tos',              label: '이용약관',                required: true,  version: 'v1.0' },
  { key: 'privacy',          label: '개인정보 수집·이용',       required: true,  version: 'v1.0' },
  { key: 'health_sensitive', label: '체성분 등 건강정보 처리',   required: false, version: 'v1.0',
    note: '개인정보보호법 제23조에 따른 별도 동의입니다. 동의하지 않아도 나머지 기능은 그대로 쓸 수 있습니다.' },
  { key: 'proxy_entry',      label: '트레이너의 대리 입력',      required: false, version: 'v1.0',
    note: '담당 트레이너가 회원님의 측정 결과를 대신 입력할 수 있게 됩니다. 언제든 철회할 수 있고, 철회하면 대리 입력된 기록은 삭제됩니다.' },
  { key: 'marketing',        label: '마케팅 정보 수신',          required: false, version: 'v1.0' },
];

/** 체성분 입력 경로. DB의 bc_source ENUM 과 맞춘다. */
export const BC_SOURCES = {
  manual:    '직접 입력',
  photo_ocr: '결과지 촬영',
  proxy:     '트레이너 입력',
  lb_csv:    '측정기 연동',
  api:       '외부 연동',
};

/** 통증·불편 부위 자가신고. 진단명이 아니라 부위다.
    "어깨 충돌증후군" 같은 병명을 받으면 그 순간 의학적 판단이 개입한다. */
export const AVOID_AREAS = [
  { key: 'shoulder', label: '어깨' },
  { key: 'elbow',    label: '팔꿈치' },
  { key: 'wrist',    label: '손목' },
  { key: 'low_back', label: '허리' },
  { key: 'hip',      label: '고관절' },
  { key: 'knee',     label: '무릎' },
  { key: 'ankle',    label: '발목' },
  { key: 'neck',     label: '목' },
];

/** 신고 사유 — 개인연락 유도가 별도 항목인 게 포인트다 */
export const REPORT_REASONS = [
  { key: 'private_contact', label: '앱 밖 개인연락 유도' },
  { key: 'harassment',      label: '부적절한 언행 / 사적 접근' },
  { key: 'no_show',         label: '무단 불참' },
  { key: 'fraud',           label: '허위 이력 / 사기 의심' },
  { key: 'inappropriate',   label: '부적절한 사진·내용' },
  { key: 'other',           label: '기타' },
];
