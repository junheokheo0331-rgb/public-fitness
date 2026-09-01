# 카카오맵 연결 체크리스트

GymLink는 키가 없을 때 거리 비교형 대체 화면을 보여주고, JavaScript 키가 연결되면 실제 카카오 지도·주소 검색으로 자동 전환한다.

## 1. 카카오 앱 설정

1. [카카오디벨로퍼스](https://developers.kakao.com/)에서 앱을 만든다.
2. **앱 → 플랫폼 키 → JavaScript 키**로 이동한다.
3. REST API 키나 어드민 키가 아닌 **JavaScript 키**를 복사한다.
4. 같은 화면의 **JavaScript SDK 도메인**에 아래 주소를 등록한다.

```text
http://localhost:5173
http://127.0.0.1:4173
https://실제-vercel-도메인.vercel.app
```

Vercel 도메인은 첫 배포 후 확정된 주소를 추가한다. 프리뷰 도메인을 사용할 경우 해당 도메인도 별도로 등록한다.

## 2. 로컬 환경변수

저장소 루트의 `.env.local`에 공개 JavaScript 키를 넣는다.

```dotenv
VITE_KAKAO_MAP_KEY=여기에_JavaScript_키
```

`service_role`, REST API 키, 어드민 키는 이 값에 넣지 않는다. `.env.local`은 Git에서 제외된다.

설정을 확인한다.

```bash
npm run check:kakao
npm run build
```

환경변수를 바꾼 뒤에는 개발 서버나 미리보기 서버를 다시 시작해야 한다.

## 3. Vercel

Vercel 프로젝트의 **Settings → Environment Variables**에 `VITE_KAKAO_MAP_KEY`를 추가하고 다시 배포한다. Production과 Preview를 모두 사용할 경우 필요한 환경에 각각 활성화한다.

## 4. 앱 동작 확인

- 홈 지도에 실제 카카오 지도가 보인다.
- `현재 위치 사용`은 버튼을 누를 때만 위치 권한을 요청한다.
- 집 도로명 주소를 저장하면 주소가 좌표로 변환된다.
- 가입한 헬스장이 있으면 거리순 목록보다 `내 헬스장`을 우선 표시한다.
- 지도 마커를 누르면 헬스장 상세와 보유 머신 목록으로 이동한다.

공식 문서: [카카오 지도 Web API 가이드](https://apis.map.kakao.com/web/guide/), [JavaScript SDK 도메인 설정](https://developers.kakao.com/docs/ko/app-setting/app)
