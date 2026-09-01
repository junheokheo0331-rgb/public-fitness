# Supabase · Vercel 배포 준비

## 로컬 데모

`.env`가 없으면 목 데이터로 네 역할 화면이 모두 열린다.

```bash
npm install
npm test
npm run dev
```

## Supabase

1. 새 Supabase 프로젝트를 만든다.
2. SQL Editor에서 `db/01_schema.sql` → `02_rls.sql` → `03_functions.sql` → `04_seed.sql` → `06_mvp_expansion.sql` → `07_location_machine_intelligence.sql` → `08_notifications.sql` → `09_trainer_workout.sql` → `10_chat_media.sql` → `11_payments.sql` → `12_catalog_expansion.sql` → `14_api_permissions.sql` → `15_booking_approval.sql` → `17_pt_application_owner.sql` → `18_active_gym.sql` → `19_day_pass.sql` → `20_booking_enum_fix.sql` → `21_day_pass_uuid_fix.sql` 순서로 실행한다.
3. 심사·QA 환경은 테스트 계정 3개를 만든 뒤 `db/13_sst_demo.sql`을 한 번 실행한다. 운영 환경에는 실행하지 않는다.
4. `.env.example`을 `.env`로 복사하고 Project URL과 anon key를 입력한다.
5. Authentication URL Configuration에 로컬 주소와 Vercel 배포 주소를 Redirect URL로 등록한다.
6. 카카오·Apple OAuth를 사용할 경우 Supabase Provider와 각 개발자 콘솔을 함께 설정한다. 네이버는 별도 커스텀 OAuth가 필요하므로 설정 전에는 이메일 로그인을 사용한다.
7. `service_role` 키와 AI API 키는 브라우저 환경변수에 넣지 않는다. 식단 분석은 추후 Supabase Edge Function secret으로만 호출한다.

신규 가입자는 항상 `member`로 생성된다. `trainer`, `owner`, `admin` 역할은 사업자·소속·본사 확인 뒤 서버에서만 승격한다.

## 카카오맵

카카오 디벨로퍼스 앱의 JavaScript 키를 `VITE_KAKAO_MAP_KEY`에 넣고 JavaScript SDK 도메인에 `http://localhost:5173`, 로컬 미리보기용 `http://127.0.0.1:4173`, 실제 배포 도메인을 등록한다. 지도와 주소 검색은 `services` 라이브러리를 함께 불러온다. 키가 없으면 앱은 거리 비교형 대체 화면을 보여준다.

상세 절차와 점검 명령은 [`KAKAO_MAP_SETUP.md`](./KAKAO_MAP_SETUP.md)를 따른다.

현재 위치는 회원이 버튼을 누른 경우에만 브라우저 권한을 요청하며 세션에만 보관한다. 집 주소는 사용자가 저장한 경우에만 `profiles.home_*`과 브라우저에 저장한다.

## Vercel

저장소 루트의 `vercel.json`에 모노레포 빌드 경로와 SPA deep-link rewrite가 설정돼 있다.

- Framework: Vite
- Install: `npm ci`
- Build: `npm run build`
- Output: `apps/web/dist`
- Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_KAKAO_MAP_KEY`

GitHub 저장소를 Vercel에 Import하면 된다. 현재 요청에 따라 실제 연결과 배포는 로컬 화면 확인 후 진행한다.
