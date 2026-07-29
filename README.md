# GymLink

헬스장 · 트레이너 · 회원 3자 플랫폼.

**이 헬스장에 실제로 있는 기구로만 루틴을 짭니다.** 조사 결과 기존 서비스가
하지 않는 유일한 것이고, 나머지 기능은 전부 이걸 성립시키기 위한 부속입니다.

`gymlink` 은 임시 이름입니다. 바꾸는 법은 아래에 있습니다.

---

## 10분 안에 돌려보기

```bash
git clone <이 저장소>
cd gymlink
npm install

npm test     # 엔진·환불·결과지 파서 40개 테스트 (Supabase 불필요)
npm run dev  # http://localhost:5173
```

`.env` 가 없으면 목 데이터로 돕니다. **Supabase 없이 전 화면이 보입니다.**
로그인 화면에서 회원 / 트레이너 / 관장을 골라 각각 들어가 보세요.

---

## 구조

```
gymlink/
├── db/
│   ├── 01_schema.sql   테이블 · ENUM
│   ├── 02_rls.sql      권한 정책 + Storage 버킷
│   ├── 03_functions.sql RPC · 트리거
│   ├── 04_seed.sql     기구 44종 · 종목 94종 (계정 없어도 실행 가능)
│   └── 05_demo.sql     예시 헬스장 3곳 (회원가입 후 실행, 선택)
├── docs/
│   ├── RESEARCH.pdf    사전 조사 보고서 (경쟁·규제·결제·API, 출처 포함)
│   └── LEGAL.md        코드가 왜 이렇게 생겼는지 — 읽고 시작하세요
├── packages/core/      엔진. 화면이 없는 순수 로직
│   ├── src/engine/routine.js   루틴 생성 — 이 프로젝트의 차별점 전부
│   ├── src/engine/refund.js    환불 계산 (미리보기용)
│   └── src/inbody/parse.js     결과지 OCR 텍스트 → 숫자
└── apps/web/           단일 앱. 로그인 후 역할에 따라 화면이 갈립니다
    ├── src/lib/catalog.js      기구·종목 목록 (04_seed.sql 에서 추출)
    └── src/pages/{member,trainer,owner}/
```

### 기구는 "역량"을 제공한다 — 이 프로젝트에서 제일 중요한 개념

처음엔 종목마다 필요한 기구를 하나씩 못박았는데 현실과 안 맞았습니다.
덤벨과 벤치만 있어도 수십 가지를 할 수 있고, 케이블 타워 하나로
핸들과 높이만 바꿔 가며 얼마든지 변형이 나옵니다.

그래서 기구는 `provides`(역량)를 주고 종목은 `requires`(역량)를 요구합니다.
`requires ⊆ 보유 역량의 합집합` 이면 그 종목이 가능합니다.

```
조절식 벤치  →  provides {bench_flat, bench_incline, bench_decline}
케이블 타워  →  provides {cable_low, cable_mid, cable_high, cable_single}
덤벨 랙      →  provides {dumbbell}

덤벨 벤치프레스  →  requires {dumbbell, bench_flat}
인클라인 덤벨    →  requires {dumbbell, bench_incline}
```

실제 결과 (05_demo.sql 실행 후 나오는 숫자):

| 헬스장 | 보유 기구 | 보유 역량 | 가능 종목 |
|---|---|---|---|
| 해운대 (전부 보유) | 44 | 47 | 94 |
| 서면 (프리웨이트 중심) | 23 | 29 | 76 |
| 전포 (머신 위주 소형) | 10 | 13 | 45 |

**덤벨 하나만 있어도 14종목이 열립니다.** 전포처럼 기구가 10종뿐인
동네 헬스장도 45종목이 나오는 이유입니다.

`is_generative` 가 붙은 기구(케이블·프리웨이트)의 종목에는 앱이
**변형 가능** 배지를 띄우고, 트레이너가 `custom_exercises` 에 자기 버전을
만들어 회원에게 보낼 수 있습니다. 표준 목록에 없다고 못 쓰게 하면
트레이너가 앱을 안 씁니다.

앱을 하나로 둔 이유: 로그인 화면에서 역할이 갈리는데 앱이 두 개면 모순이고,
카카오맵 무료 쿼터가 개발자 계정당 앱 하나에만 붙기 때문입니다.

---

## Supabase 붙이기

1. 프로젝트를 만들고 SQL Editor 에 **01 → 02 → 03 → 04** 를 순서대로 붙여넣고 실행
   - 04까지 하면 기구 44종·종목 94종이 들어갑니다. 계정이 없어도 됩니다.
   - Storage 버킷(`gym-photos`)과 정책도 02에서 자동으로 만들어집니다.
2. `.env.example` 을 `.env` 로 복사하고 URL·anon key 입력
3. `npm run dev` → 앱에서 회원가입
4. (선택) SQL Editor 에서 **05_demo.sql** 실행 → 예시 헬스장 3곳이 생깁니다
   - `gyms.owner_id` 가 실제 계정을 참조하므로 회원가입 뒤에 실행해야 합니다
   - 계정이 없으면 아무것도 만들지 않고 안내만 띄웁니다

Postgres 16 + PostGIS 로 01~05 전체를 처음부터 끝까지 실행해 확인했습니다.

화면 코드는 한 줄도 안 바뀝니다. `apps/web/src/lib/api.js` 의 각 함수에
목 분기와 실제 쿼리가 나란히 들어 있습니다.

### 기구 사진

관장이 `/o/machines` 에서 기구별로 사진을 올리면 회원이 헬스장 상세에서
봅니다. 파일은 Storage 의 `gym-photos` 버킷에 `<gym_id>/<uuid>.jpg` 로
들어가고, 경로 첫 칸이 gym_id 라서 그 헬스장을 운영하는 사람만 그 폴더에
쓸 수 있습니다.

체성분 결과지는 여기 올리지 않습니다. 이미지 자체를 서버에 두지 않는 게
그 기능의 설계 전제입니다. `docs/LEGAL.md` 1-2 참고.

### 루틴 저장 · 송출

- 회원이 `저장` → `save_routine()` RPC
- 트레이너가 `/t/clients/<id>/send` 에서 회원에게 보내기 → `assign_routine()` RPC
- 관장 추천 루틴을 회원이 가져오기 → `copy_routine()` RPC

송출은 **공유가 아니라 복사**입니다. 트레이너가 나중에 자기 루틴을 고쳐도
회원이 받은 것은 그대로 남아야 합니다. PT 기록의 성격이 있어서 "그때 뭘
시켰는지"가 남아야 하기 때문입니다. 담당 회원인지는 화면이 아니라
서버가 판정합니다.

---

## 팀 분담용 읽는 순서

| 담당 | 읽을 것 |
|---|---|
| 전원 | `docs/LEGAL.md` 전체, `RESEARCH.pdf` 1장(경쟁)·6장(MVP 범위) |
| 알고리즘 | `packages/core/src/engine/routine.js` + `npm test` 출력 |
| 결과지 인식 | `packages/core/src/inbody/parse.js` 의 교차검증 부분 |
| DB · 권한 | `db/01_schema.sql` → `db/02_rls.sql` 순서 |
| 규제 · 법 | `docs/LEGAL.md` + `db/03_functions.sql` 의 `calc_refund()` |
| 현장 영업 | `RESEARCH.pdf` 4장 + 관장 화면 `/o/machines` |

---

## 알고 있어야 할 결정 네 가지

**1. MVP 에서 결제를 안 받습니다.**
플랫폼이 대금을 수취해 정산하면 전자금융거래법상 등록 대상이 됩니다.
결제는 헬스장에서 대면으로 하고, 앱은 가격 공개와 환불액 계산만 합니다.
개발량이 절반으로 줄고 차별점 검증에는 영향이 없습니다.

**2. 결과지 사진을 서버에 저장하지 않습니다.**
인식은 브라우저 안에서 끝나고 숫자만 전송됩니다.
`body_composition` 에는 이미지 컬럼 자체가 없습니다.

**3. "처방"이라는 단어를 쓰지 않습니다.**
의료법상 처방은 의료인의 행위입니다. 기능이 같아도 이름 때문에 불리해집니다.
병명도 입력받지 않고 통증 부위만 받습니다. 이유는 `docs/LEGAL.md` 2장.

**4. 출입기를 대체하지 않습니다.**
회원 명단을 CSV 로 내보내 관장이 쓰던 시스템에 올립니다.
갈아엎으려 들면 입점이 막힙니다.

---

## 이름 바꾸기

`gymlink` 은 자리 표시자입니다. 고칠 곳은 네 군데뿐입니다.

1. 저장소 이름과 최상위 폴더명
2. 루트 `package.json` 의 `name`
3. `packages/core/package.json`, `apps/web/package.json` 의 `name`
   (`@gymlink/core` 를 import 하는 곳도 함께 — 전체 검색으로 한 번에 됩니다)
4. `apps/web/index.html` 의 `<title>` 과 `public/manifest.webmanifest`

DB 스키마에는 브랜드명이 없으므로 건드릴 필요 없습니다.

---

## 다음에 할 일

- 운동 기록 입력 화면 — `workout_logs` 스키마는 이미 있습니다
- 트레이너의 변형 종목 만들기 화면 — `custom_exercises` 테이블과 RLS는 있고 UI만 없습니다
- 관장의 회원 등록 폼 — 지금은 명단 조회만 됩니다
- 카카오맵 연동 — `.env` 에 키를 넣고 회원 홈에만 붙이세요
- 측정기 CSV 폴더 감시 에이전트 (`bc_source` 에 `lb_csv` 자리를 비워뒀습니다)
