/* ============================================================
   catalog.js — 기구·종목 표준 목록 (db/04_seed.sql 에서 추출)

   ★ 손으로 고치지 마세요 ★
   db/04_seed.sql 이 원본이고 이 파일은 거기서 뽑아낸 것입니다.
   목 모드와 Supabase 모드가 다른 목록을 쓰면 안 되므로 한쪽에서만 관리합니다.

   핵심: 기구는 역량(provides)을 제공하고 종목은 역량(requires)을 요구한다.
   requires ⊆ 보유 역량의 합집합 이면 그 종목이 가능하다.
   덤벨 하나면 14종목, 조절식 벤치를 더하면 더 열린다.
   ============================================================ */

export const MACHINES = [
  {"code": "POWER_RACK", "name": "파워랙", "category": "rack", "provides": ["squat_rack", "bench_press_rack", "pullup_bar"], "generative": true, "step": 2.5},
  {"code": "HALF_RACK", "name": "하프랙", "category": "rack", "provides": ["squat_rack", "bench_press_rack"], "generative": true, "step": 2.5},
  {"code": "SMITH", "name": "스미스 머신", "category": "rack", "provides": ["smith", "squat_rack"], "generative": true, "step": 5.0},
  {"code": "PULLUP_BAR", "name": "철봉", "category": "rack", "provides": ["pullup_bar"], "generative": true, "step": null},
  {"code": "DIP_STATION", "name": "딥스 스테이션", "category": "rack", "provides": ["dip_bar", "pullup_bar"], "generative": true, "step": null},
  {"code": "BENCH_FLAT", "name": "플랫 벤치", "category": "bench", "provides": ["bench_flat"], "generative": false, "step": null},
  {"code": "BENCH_ADJ", "name": "조절식 벤치", "category": "bench", "provides": ["bench_flat", "bench_incline", "bench_decline"], "generative": true, "step": null},
  {"code": "BARBELL", "name": "바벨 + 원판", "category": "free", "provides": ["barbell"], "generative": true, "step": 5.0},
  {"code": "PLATE_SMALL", "name": "소형 원판 (1~2.5kg)", "category": "free", "provides": ["plates_small"], "generative": false, "step": 1.25},
  {"code": "EZ_BAR", "name": "EZ 바", "category": "free", "provides": ["ez_bar"], "generative": true, "step": 2.5},
  {"code": "TRAP_BAR", "name": "트랩바", "category": "free", "provides": ["trap_bar"], "generative": true, "step": 5.0},
  {"code": "DUMBBELL", "name": "덤벨 랙", "category": "free", "provides": ["dumbbell"], "generative": true, "step": 2.0},
  {"code": "KETTLEBELL", "name": "케틀벨", "category": "free", "provides": ["kettlebell"], "generative": true, "step": 4.0},
  {"code": "LANDMINE", "name": "랜드마인", "category": "free", "provides": ["landmine"], "generative": true, "step": 2.5},
  {"code": "CABLE_CROSS", "name": "케이블 크로스오버", "category": "cable", "provides": ["cable_low", "cable_mid", "cable_high", "cable_dual", "cable_adjustable"], "generative": true, "step": 2.5},
  {"code": "FUNC_TRAINER", "name": "펑셔널 트레이너", "category": "cable", "provides": ["cable_low", "cable_mid", "cable_high", "cable_dual", "cable_adjustable"], "generative": true, "step": 2.5},
  {"code": "CABLE_TOWER", "name": "케이블 타워 (1주)", "category": "cable", "provides": ["cable_low", "cable_mid", "cable_high", "cable_adjustable"], "generative": true, "step": 5.0},
  {"code": "LAT_PULLDOWN", "name": "랫풀다운", "category": "cable", "provides": ["cable_high", "machine_lat_pulldown"], "generative": false, "step": 5.0},
  {"code": "SEATED_ROW", "name": "시티드 로우", "category": "cable", "provides": ["cable_low", "machine_row"], "generative": false, "step": 5.0},
  {"code": "CHEST_PRESS", "name": "체스트 프레스", "category": "machine", "provides": ["machine_chest_press"], "generative": false, "step": 5.0},
  {"code": "PEC_DECK", "name": "펙덱 플라이", "category": "machine", "provides": ["machine_pec_deck"], "generative": false, "step": 5.0},
  {"code": "SHOULDER_PR", "name": "숄더 프레스 머신", "category": "machine", "provides": ["machine_shoulder_press"], "generative": false, "step": 5.0},
  {"code": "LEG_PRESS", "name": "레그프레스", "category": "machine", "provides": ["machine_leg_press"], "generative": false, "step": 10.0},
  {"code": "HACK_SQUAT", "name": "핵 스쿼트", "category": "machine", "provides": ["machine_hack_squat"], "generative": false, "step": 10.0},
  {"code": "LEG_EXT", "name": "레그 익스텐션", "category": "machine", "provides": ["machine_leg_ext"], "generative": false, "step": 5.0},
  {"code": "LEG_CURL", "name": "레그 컬", "category": "machine", "provides": ["machine_leg_curl"], "generative": false, "step": 5.0},
  {"code": "HIP_ABD", "name": "아브덕션 머신", "category": "machine", "provides": ["machine_hip_abd"], "generative": false, "step": 5.0},
  {"code": "HIP_ADD", "name": "애덕션 머신", "category": "machine", "provides": ["machine_hip_add"], "generative": false, "step": 5.0},
  {"code": "HIP_THRUST_M", "name": "힙쓰러스트 머신", "category": "machine", "provides": ["machine_glute"], "generative": false, "step": 5.0},
  {"code": "CALF_MACHINE", "name": "카프 레이즈 머신", "category": "machine", "provides": ["machine_calf"], "generative": false, "step": 5.0},
  {"code": "BACK_EXT", "name": "백 익스텐션", "category": "machine", "provides": ["machine_back_ext"], "generative": false, "step": null},
  {"code": "AB_MACHINE", "name": "복근 머신", "category": "machine", "provides": ["machine_ab"], "generative": false, "step": 5.0},
  {"code": "ASSIST_PULLUP", "name": "어시스트 풀업 머신", "category": "machine", "provides": ["machine_assisted_pullup"], "generative": false, "step": 5.0},
  {"code": "TREADMILL", "name": "트레드밀", "category": "cardio", "provides": ["treadmill"], "generative": false, "step": null},
  {"code": "CYCLE", "name": "사이클", "category": "cardio", "provides": ["cycle"], "generative": false, "step": null},
  {"code": "ROWER", "name": "로잉 머신", "category": "cardio", "provides": ["rower"], "generative": false, "step": null},
  {"code": "ELLIPTICAL", "name": "일립티컬", "category": "cardio", "provides": ["elliptical"], "generative": false, "step": null},
  {"code": "STAIRMILL", "name": "스텝밀", "category": "cardio", "provides": ["stairmill"], "generative": false, "step": null},
  {"code": "MAT", "name": "매트 · 스트레칭존", "category": "etc", "provides": ["floor_mat"], "generative": true, "step": null},
  {"code": "BAND", "name": "밴드", "category": "etc", "provides": ["band"], "generative": true, "step": null},
  {"code": "BOX", "name": "플라이오 박스", "category": "etc", "provides": ["box"], "generative": true, "step": null},
  {"code": "TRX", "name": "TRX · 서스펜션", "category": "etc", "provides": ["trx"], "generative": true, "step": null},
  {"code": "MEDBALL", "name": "메디신볼", "category": "etc", "provides": ["medball"], "generative": true, "step": 4.0},
  {"code": "SLED", "name": "슬레드 · 푸시썰매", "category": "etc", "provides": ["sled"], "generative": true, "step": 5.0},
];

export const EXERCISES = [
  {"code": "AB_MACHINE_EX", "name_ko": "복근 머신", "pattern": "core", "requires": ["machine_ab"], "freeform": false, "setup": null, "compound": false, "level": 1, "avoid": ["low_back"]},
  {"code": "AB_WHEEL", "name_ko": "앱 롤아웃", "pattern": "core", "requires": ["floor_mat"], "freeform": true, "setup": null, "compound": false, "level": 3, "avoid": ["low_back"]},
  {"code": "ASSISTED_PULLUP", "name_ko": "어시스트 턱걸이", "pattern": "vertical_pull", "requires": ["machine_assisted_pullup"], "freeform": false, "setup": null, "compound": true, "level": 1, "avoid": ["shoulder"]},
  {"code": "BACK_EXT_EX", "name_ko": "백 익스텐션", "pattern": "hinge", "requires": ["machine_back_ext"], "freeform": false, "setup": null, "compound": false, "level": 1, "avoid": ["low_back"]},
  {"code": "BAND_CLAMSHELL", "name_ko": "밴드 클램쉘", "pattern": "abduction", "requires": ["band", "floor_mat"], "freeform": true, "setup": null, "compound": false, "level": 1, "avoid": []},
  {"code": "BAND_LEG_CURL", "name_ko": "밴드 레그컬", "pattern": "flexion", "requires": ["band", "floor_mat"], "freeform": true, "setup": "기구가 없을 때", "compound": false, "level": 1, "avoid": []},
  {"code": "BB_BENCH", "name_ko": "바벨 벤치프레스", "pattern": "horizontal_push", "requires": ["barbell", "bench_flat", "bench_press_rack"], "freeform": false, "setup": null, "compound": true, "level": 2, "avoid": ["shoulder"]},
  {"code": "BB_CURL", "name_ko": "바벨 컬", "pattern": "elbow_flexion", "requires": ["barbell"], "freeform": false, "setup": null, "compound": false, "level": 1, "avoid": ["elbow", "wrist"]},
  {"code": "BB_INCLINE", "name_ko": "인클라인 바벨프레스", "pattern": "horizontal_push", "requires": ["barbell", "bench_incline", "bench_press_rack"], "freeform": false, "setup": "벤치 30도", "compound": true, "level": 2, "avoid": ["shoulder"]},
  {"code": "BB_ROW", "name_ko": "바벨 로우", "pattern": "horizontal_pull", "requires": ["barbell"], "freeform": false, "setup": null, "compound": true, "level": 2, "avoid": ["low_back"]},
  {"code": "BB_SQUAT", "name_ko": "바벨 스쿼트", "pattern": "squat", "requires": ["barbell", "squat_rack"], "freeform": false, "setup": null, "compound": true, "level": 3, "avoid": ["knee", "low_back"]},
  {"code": "BENCH_DIP", "name_ko": "벤치 딥스", "pattern": "elbow_extension", "requires": ["bench_flat"], "freeform": true, "setup": null, "compound": false, "level": 1, "avoid": ["shoulder"]},
  {"code": "BULGARIAN", "name_ko": "불가리안 스플릿", "pattern": "squat", "requires": ["dumbbell", "bench_flat"], "freeform": true, "setup": null, "compound": true, "level": 2, "avoid": ["knee"]},
  {"code": "BW_SQUAT", "name_ko": "맨몸 스쿼트", "pattern": "squat", "requires": [], "freeform": true, "setup": null, "compound": true, "level": 1, "avoid": ["knee"]},
  {"code": "CABLE_ABDUCTION", "name_ko": "케이블 힙 어브덕션", "pattern": "abduction", "requires": ["cable_low"], "freeform": true, "setup": null, "compound": false, "level": 1, "avoid": []},
  {"code": "CABLE_CRUNCH", "name_ko": "케이블 크런치", "pattern": "core", "requires": ["cable_high"], "freeform": true, "setup": null, "compound": false, "level": 1, "avoid": ["low_back"]},
  {"code": "CABLE_CURL", "name_ko": "케이블 컬", "pattern": "elbow_flexion", "requires": ["cable_low"], "freeform": true, "setup": null, "compound": false, "level": 1, "avoid": ["elbow"]},
  {"code": "CABLE_FACE_PULL", "name_ko": "페이스 풀", "pattern": "horizontal_abduction", "requires": ["cable_high"], "freeform": true, "setup": "어깨 건강에 좋다", "compound": false, "level": 1, "avoid": []},
  {"code": "CABLE_FLY", "name_ko": "케이블 플라이", "pattern": "horizontal_adduction", "requires": ["cable_dual"], "freeform": true, "setup": "높이를 바꾸면 상·중·하 가슴", "compound": false, "level": 1, "avoid": ["shoulder"]},
  {"code": "CABLE_FLY_LOW", "name_ko": "로우 케이블 플라이", "pattern": "horizontal_adduction", "requires": ["cable_low", "cable_dual"], "freeform": true, "setup": "아래에서 위로", "compound": false, "level": 1, "avoid": ["shoulder"]},
  {"code": "CABLE_LATERAL", "name_ko": "케이블 래터럴", "pattern": "abduction", "requires": ["cable_low"], "freeform": true, "setup": "덤벨보다 자극이 고르다", "compound": false, "level": 1, "avoid": ["shoulder"]},
  {"code": "CABLE_PULLTHRU", "name_ko": "케이블 풀스루", "pattern": "hinge", "requires": ["cable_low"], "freeform": true, "setup": null, "compound": true, "level": 1, "avoid": []},
  {"code": "CABLE_REAR_FLY", "name_ko": "케이블 리어 플라이", "pattern": "horizontal_abduction", "requires": ["cable_dual"], "freeform": true, "setup": null, "compound": false, "level": 1, "avoid": []},
  {"code": "CALF_MACH_EX", "name_ko": "카프 레이즈 머신", "pattern": "plantarflexion", "requires": ["machine_calf"], "freeform": false, "setup": null, "compound": false, "level": 1, "avoid": []},
  {"code": "CHEST_PRESS_M", "name_ko": "체스트 프레스", "pattern": "horizontal_push", "requires": ["machine_chest_press"], "freeform": false, "setup": null, "compound": true, "level": 1, "avoid": []},
  {"code": "CHEST_SUP_ROW", "name_ko": "체스트 서포티드 로우", "pattern": "horizontal_pull", "requires": ["dumbbell", "bench_incline"], "freeform": true, "setup": "허리 부담이 적다", "compound": true, "level": 1, "avoid": []},
  {"code": "CHINUP", "name_ko": "친업", "pattern": "vertical_pull", "requires": ["pullup_bar"], "freeform": true, "setup": "손바닥이 나를 향하게", "compound": true, "level": 3, "avoid": ["elbow"]},
  {"code": "DB_BENCH", "name_ko": "덤벨 벤치프레스", "pattern": "horizontal_push", "requires": ["dumbbell", "bench_flat"], "freeform": true, "setup": null, "compound": true, "level": 1, "avoid": ["shoulder"]},
  {"code": "DB_CALF", "name_ko": "덤벨 카프 레이즈", "pattern": "plantarflexion", "requires": ["dumbbell"], "freeform": true, "setup": "계단이나 박스 위에서", "compound": false, "level": 1, "avoid": ["ankle"]},
  {"code": "DB_CURL", "name_ko": "덤벨 컬", "pattern": "elbow_flexion", "requires": ["dumbbell"], "freeform": true, "setup": "해머·인클라인 등 변형 자유", "compound": false, "level": 1, "avoid": ["elbow"]},
  {"code": "DB_FLY", "name_ko": "덤벨 플라이", "pattern": "horizontal_adduction", "requires": ["dumbbell", "bench_flat"], "freeform": true, "setup": null, "compound": false, "level": 2, "avoid": ["shoulder"]},
  {"code": "DB_INCLINE", "name_ko": "인클라인 덤벨프레스", "pattern": "horizontal_push", "requires": ["dumbbell", "bench_incline"], "freeform": true, "setup": "벤치 30~45도", "compound": true, "level": 1, "avoid": ["shoulder"]},
  {"code": "DB_LATERAL", "name_ko": "래터럴 레이즈", "pattern": "abduction", "requires": ["dumbbell"], "freeform": true, "setup": null, "compound": false, "level": 1, "avoid": ["shoulder"]},
  {"code": "DB_REAR_FLY", "name_ko": "리어 델트 플라이", "pattern": "horizontal_abduction", "requires": ["dumbbell"], "freeform": true, "setup": null, "compound": false, "level": 1, "avoid": []},
  {"code": "DB_ROW", "name_ko": "원암 덤벨로우", "pattern": "horizontal_pull", "requires": ["dumbbell"], "freeform": true, "setup": "벤치가 있으면 한 손 지지", "compound": true, "level": 1, "avoid": ["low_back"]},
  {"code": "DB_SHOULDER_PR", "name_ko": "덤벨 숄더프레스", "pattern": "vertical_push", "requires": ["dumbbell"], "freeform": true, "setup": "앉아서 하면 허리 부담이 준다", "compound": true, "level": 1, "avoid": ["shoulder"]},
  {"code": "DEADLIFT", "name_ko": "데드리프트", "pattern": "hinge", "requires": ["barbell"], "freeform": false, "setup": null, "compound": true, "level": 3, "avoid": ["low_back"]},
  {"code": "DEAD_BUG", "name_ko": "데드버그", "pattern": "core", "requires": ["floor_mat"], "freeform": true, "setup": "허리가 불편할 때 안전", "compound": false, "level": 1, "avoid": []},
  {"code": "DIP_CHEST", "name_ko": "딥스 (가슴)", "pattern": "horizontal_push", "requires": ["dip_bar"], "freeform": true, "setup": "상체를 앞으로 기울인다", "compound": true, "level": 2, "avoid": ["shoulder"]},
  {"code": "DIP_TRICEPS", "name_ko": "딥스 (삼두)", "pattern": "elbow_extension", "requires": ["dip_bar"], "freeform": true, "setup": "상체를 세운다", "compound": true, "level": 2, "avoid": ["shoulder"]},
  {"code": "ELLIPTICAL_EX", "name_ko": "일립티컬", "pattern": "cardio", "requires": ["elliptical"], "freeform": false, "setup": "무릎 부담이 적다", "compound": false, "level": 1, "avoid": []},
  {"code": "EZ_CURL", "name_ko": "EZ바 컬", "pattern": "elbow_flexion", "requires": ["ez_bar"], "freeform": true, "setup": null, "compound": false, "level": 1, "avoid": ["elbow", "wrist"]},
  {"code": "FARMER_CARRY", "name_ko": "파머스 캐리", "pattern": "carry", "requires": ["dumbbell"], "freeform": true, "setup": null, "compound": true, "level": 1, "avoid": []},
  {"code": "FLOOR_PRESS_DB", "name_ko": "덤벨 플로어프레스", "pattern": "horizontal_push", "requires": ["dumbbell", "floor_mat"], "freeform": true, "setup": "벤치가 없을 때", "compound": true, "level": 1, "avoid": []},
  {"code": "FRONT_SQUAT", "name_ko": "프론트 스쿼트", "pattern": "squat", "requires": ["barbell", "squat_rack"], "freeform": false, "setup": null, "compound": true, "level": 3, "avoid": ["knee", "wrist"]},
  {"code": "GLUTE_BRIDGE", "name_ko": "글루트 브릿지", "pattern": "hinge", "requires": ["floor_mat"], "freeform": true, "setup": null, "compound": false, "level": 1, "avoid": []},
  {"code": "GOBLET_SQUAT", "name_ko": "고블릿 스쿼트", "pattern": "squat", "requires": ["dumbbell"], "freeform": true, "setup": "입문자에게 가장 좋은 스쿼트", "compound": true, "level": 1, "avoid": ["knee"]},
  {"code": "HACK_SQUAT_EX", "name_ko": "핵 스쿼트", "pattern": "squat", "requires": ["machine_hack_squat"], "freeform": false, "setup": null, "compound": true, "level": 2, "avoid": ["knee"]},
  {"code": "HANGING_LEG", "name_ko": "행잉 레그레이즈", "pattern": "core", "requires": ["pullup_bar"], "freeform": true, "setup": null, "compound": false, "level": 3, "avoid": ["shoulder", "low_back"]},
  {"code": "HIP_ABD_EX", "name_ko": "아브덕션", "pattern": "abduction", "requires": ["machine_hip_abd"], "freeform": false, "setup": null, "compound": false, "level": 1, "avoid": []},
  {"code": "HIP_ADD_EX", "name_ko": "애덕션", "pattern": "adduction", "requires": ["machine_hip_add"], "freeform": false, "setup": null, "compound": false, "level": 1, "avoid": []},
  {"code": "HIP_THRUST_BB", "name_ko": "바벨 힙쓰러스트", "pattern": "hinge", "requires": ["barbell", "bench_flat"], "freeform": false, "setup": null, "compound": true, "level": 2, "avoid": []},
  {"code": "HIP_THRUST_MACH", "name_ko": "힙쓰러스트 머신", "pattern": "hinge", "requires": ["machine_glute"], "freeform": false, "setup": null, "compound": true, "level": 1, "avoid": []},
  {"code": "INCLINE_WALK", "name_ko": "경사 걷기", "pattern": "cardio", "requires": ["treadmill"], "freeform": false, "setup": "경사 10~15%", "compound": false, "level": 1, "avoid": []},
  {"code": "INVERTED_ROW", "name_ko": "인버티드 로우", "pattern": "horizontal_pull", "requires": ["smith"], "freeform": true, "setup": "바 높이로 난이도 조절", "compound": true, "level": 1, "avoid": []},
  {"code": "KB_GOBLET", "name_ko": "케틀벨 고블릿", "pattern": "squat", "requires": ["kettlebell"], "freeform": true, "setup": null, "compound": true, "level": 1, "avoid": ["knee"]},
  {"code": "KB_SWING", "name_ko": "케틀벨 스윙", "pattern": "hinge", "requires": ["kettlebell"], "freeform": true, "setup": null, "compound": true, "level": 2, "avoid": ["low_back"]},
  {"code": "LANDMINE_PRESS", "name_ko": "랜드마인 프레스", "pattern": "vertical_push", "requires": ["landmine"], "freeform": true, "setup": "어깨가 불편할 때 대안", "compound": true, "level": 2, "avoid": []},
  {"code": "LANDMINE_ROW", "name_ko": "랜드마인 로우", "pattern": "horizontal_pull", "requires": ["landmine"], "freeform": true, "setup": null, "compound": true, "level": 2, "avoid": ["low_back"]},
  {"code": "LAT_PULLDOWN_N", "name_ko": "뉴트럴 랫풀다운", "pattern": "vertical_pull", "requires": ["cable_high"], "freeform": true, "setup": "평행 그립 핸들", "compound": true, "level": 1, "avoid": []},
  {"code": "LAT_PULLDOWN_W", "name_ko": "랫풀다운", "pattern": "vertical_pull", "requires": ["cable_high"], "freeform": true, "setup": "와이드·클로즈·언더 다 가능", "compound": true, "level": 1, "avoid": ["shoulder"]},
  {"code": "LEG_CURL_EX", "name_ko": "레그 컬", "pattern": "flexion", "requires": ["machine_leg_curl"], "freeform": false, "setup": null, "compound": false, "level": 1, "avoid": []},
  {"code": "LEG_EXT_EX", "name_ko": "레그 익스텐션", "pattern": "extension", "requires": ["machine_leg_ext"], "freeform": false, "setup": null, "compound": false, "level": 1, "avoid": ["knee"]},
  {"code": "LEG_PRESS_EX", "name_ko": "레그프레스", "pattern": "squat", "requires": ["machine_leg_press"], "freeform": false, "setup": "발 위치로 자극 조절", "compound": true, "level": 1, "avoid": ["knee"]},
  {"code": "NORDIC_CURL", "name_ko": "노르딕 컬", "pattern": "flexion", "requires": ["floor_mat"], "freeform": true, "setup": "발을 고정할 것", "compound": false, "level": 3, "avoid": ["knee"]},
  {"code": "OHP", "name_ko": "오버헤드 프레스", "pattern": "vertical_push", "requires": ["barbell", "squat_rack"], "freeform": false, "setup": null, "compound": true, "level": 2, "avoid": ["shoulder", "low_back"]},
  {"code": "OVERHEAD_EXT", "name_ko": "오버헤드 익스텐션", "pattern": "elbow_extension", "requires": ["dumbbell"], "freeform": true, "setup": null, "compound": false, "level": 1, "avoid": ["elbow", "shoulder"]},
  {"code": "PALLOF", "name_ko": "팔로프 프레스", "pattern": "core", "requires": ["cable_mid"], "freeform": true, "setup": "회전에 저항하는 운동", "compound": false, "level": 2, "avoid": []},
  {"code": "PEC_DECK_EX", "name_ko": "펙덱 플라이", "pattern": "horizontal_adduction", "requires": ["machine_pec_deck"], "freeform": false, "setup": null, "compound": false, "level": 1, "avoid": ["shoulder"]},
  {"code": "PIKE_PUSHUP", "name_ko": "파이크 푸시업", "pattern": "vertical_push", "requires": [], "freeform": true, "setup": null, "compound": true, "level": 2, "avoid": ["wrist", "shoulder"]},
  {"code": "PLANK", "name_ko": "플랭크", "pattern": "core", "requires": ["floor_mat"], "freeform": true, "setup": null, "compound": false, "level": 1, "avoid": ["shoulder"]},
  {"code": "PULLUP", "name_ko": "턱걸이", "pattern": "vertical_pull", "requires": ["pullup_bar"], "freeform": true, "setup": "그립 폭을 바꾸면 자극이 달라진다", "compound": true, "level": 3, "avoid": ["shoulder", "elbow"]},
  {"code": "PUSHDOWN", "name_ko": "케이블 푸시다운", "pattern": "elbow_extension", "requires": ["cable_high"], "freeform": true, "setup": "로프·바 자유", "compound": false, "level": 1, "avoid": ["elbow"]},
  {"code": "PUSHUP", "name_ko": "푸시업", "pattern": "horizontal_push", "requires": [], "freeform": true, "setup": null, "compound": true, "level": 1, "avoid": ["wrist", "shoulder"]},
  {"code": "RDL_BB", "name_ko": "루마니안 데드리프트", "pattern": "hinge", "requires": ["barbell"], "freeform": false, "setup": null, "compound": true, "level": 2, "avoid": ["low_back"]},
  {"code": "RDL_DB", "name_ko": "덤벨 루마니안 데드", "pattern": "hinge", "requires": ["dumbbell"], "freeform": true, "setup": null, "compound": true, "level": 1, "avoid": ["low_back"]},
  {"code": "ROWING", "name_ko": "로잉", "pattern": "cardio", "requires": ["rower"], "freeform": false, "setup": null, "compound": false, "level": 2, "avoid": ["low_back"]},
  {"code": "SEATED_ROW_N", "name_ko": "시티드 케이블로우", "pattern": "horizontal_pull", "requires": ["cable_low"], "freeform": true, "setup": "핸들만 바꿔도 다른 운동", "compound": true, "level": 1, "avoid": ["low_back"]},
  {"code": "SHOULDER_PR_M", "name_ko": "숄더 프레스 머신", "pattern": "vertical_push", "requires": ["machine_shoulder_press"], "freeform": false, "setup": null, "compound": true, "level": 1, "avoid": []},
  {"code": "SKULL_CRUSHER", "name_ko": "스컬 크러셔", "pattern": "elbow_extension", "requires": ["ez_bar", "bench_flat"], "freeform": false, "setup": null, "compound": false, "level": 2, "avoid": ["elbow"]},
  {"code": "SLED_PUSH", "name_ko": "슬레드 푸시", "pattern": "cardio", "requires": ["sled"], "freeform": true, "setup": null, "compound": true, "level": 2, "avoid": []},
  {"code": "SMITH_BENCH", "name_ko": "스미스 벤치프레스", "pattern": "horizontal_push", "requires": ["smith", "bench_flat"], "freeform": false, "setup": null, "compound": true, "level": 1, "avoid": ["shoulder"]},
  {"code": "SMITH_CALF", "name_ko": "스미스 카프", "pattern": "plantarflexion", "requires": ["smith"], "freeform": false, "setup": null, "compound": false, "level": 1, "avoid": ["ankle"]},
  {"code": "SMITH_INCLINE", "name_ko": "스미스 인클라인", "pattern": "horizontal_push", "requires": ["smith", "bench_incline"], "freeform": false, "setup": null, "compound": true, "level": 1, "avoid": ["shoulder"]},
  {"code": "SMITH_OHP", "name_ko": "스미스 숄더프레스", "pattern": "vertical_push", "requires": ["smith"], "freeform": false, "setup": null, "compound": true, "level": 1, "avoid": ["shoulder"]},
  {"code": "SMITH_SQUAT", "name_ko": "스미스 스쿼트", "pattern": "squat", "requires": ["smith"], "freeform": false, "setup": null, "compound": true, "level": 1, "avoid": ["knee"]},
  {"code": "STAIRMILL_EX", "name_ko": "스텝밀", "pattern": "cardio", "requires": ["stairmill"], "freeform": false, "setup": null, "compound": false, "level": 1, "avoid": ["knee"]},
  {"code": "STEP_UP", "name_ko": "스텝업", "pattern": "squat", "requires": ["box", "dumbbell"], "freeform": true, "setup": "박스 높이로 강도 조절", "compound": true, "level": 1, "avoid": ["knee"]},
  {"code": "STRAIGHT_PULLOVER", "name_ko": "케이블 풀오버", "pattern": "vertical_pull", "requires": ["cable_high"], "freeform": true, "setup": "팔을 편 채로", "compound": false, "level": 2, "avoid": ["shoulder"]},
  {"code": "TRAP_BAR_DL", "name_ko": "트랩바 데드리프트", "pattern": "hinge", "requires": ["trap_bar"], "freeform": false, "setup": "허리 부담이 바벨보다 적다", "compound": true, "level": 2, "avoid": ["low_back"]},
  {"code": "TRX_ROW", "name_ko": "TRX 로우", "pattern": "horizontal_pull", "requires": ["trx"], "freeform": true, "setup": "각도로 난이도 조절", "compound": true, "level": 1, "avoid": []},
  {"code": "WALKING_LUNGE", "name_ko": "워킹 런지", "pattern": "squat", "requires": ["dumbbell"], "freeform": true, "setup": null, "compound": true, "level": 2, "avoid": ["knee"]},
  {"code": "ZONE2_CYCLE", "name_ko": "사이클", "pattern": "cardio", "requires": ["cycle"], "freeform": false, "setup": null, "compound": false, "level": 1, "avoid": ["knee"]},
  {"code": "ZONE2_TM", "name_ko": "트레드밀", "pattern": "cardio", "requires": ["treadmill"], "freeform": false, "setup": null, "compound": false, "level": 1, "avoid": []},
];


/** 보유 기구 코드 목록 → 역량 집합 */
export function capabilitiesOf(machineCodes) {
  const set = new Set();
  for (const code of machineCodes) {
    const m = MACHINES.find((x) => x.code === code);
    if (m) for (const c of m.provides) set.add(c);
  }
  return set;
}

/** 이 헬스장에서 실제로 할 수 있는 종목.
    DB의 available_exercises() RPC 와 같은 판정을 한다. */
export function availableFor(machineCodes, level = 3) {
  const caps = capabilitiesOf(machineCodes);
  // 역량 → 그 역량을 채워주는 기구 (카드에 기구 이름을 띄우는 데 쓴다)
  const byCap = new Map();
  for (const code of machineCodes) {
    const m = MACHINES.find((x) => x.code === code);
    if (!m) continue;
    for (const c of m.provides) if (!byCap.has(c)) byCap.set(c, m);
  }
  return EXERCISES
    .filter((e) => e.level <= level && e.requires.every((r) => caps.has(r)))
    .map((e) => {
      const steps = e.requires.map((r) => byCap.get(r)?.step).filter((s) => s != null);
      const lead = byCap.get(e.requires[0]);
      return {
        code: e.code, name_ko: e.name_ko, pattern: e.pattern,
        is_compound: e.compound, skill_level: e.level,
        requires: e.requires, is_freeform: e.freeform, setup_note: e.setup,
        machine_code: lead?.code ?? null, machine_name: lead?.name ?? null,
        // 여러 기구를 쓰면 가장 거친 단위를 따른다. 없는 중량은 안내하지 않는다.
        min_step_kg: steps.length ? Math.max(...steps) : 2.5,
        avoid_areas: e.avoid, is_substitute: false, is_custom: false,
      };
    });
}

/** 기구 하나를 더 들이면 몇 종목이 열리는가 (관장 화면용) */
export function machineImpact(machineCodes, addCode) {
  const before = availableFor(machineCodes).length;
  const after = availableFor([...new Set([...machineCodes, addCode])]).length;
  const had = new Set(availableFor(machineCodes).map((e) => e.code));
  const unlocks = availableFor([...new Set([...machineCodes, addCode])])
    .filter((e) => !had.has(e.code)).map((e) => e.name_ko);
  return { before, after, unlocks };
}
