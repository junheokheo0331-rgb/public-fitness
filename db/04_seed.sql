-- ============================================================
--  GymLink — 04_seed.sql
--  01 → 02 → 03 다음에 실행한다.
--
--  여기 들어가는 것: 본사가 관리하는 표준 목록(기구 46종, 종목 90종).
--  사용자 계정이 필요 없으므로 프로젝트 만들자마자 바로 실행하면 된다.
--
--  예시 헬스장 데이터는 05_demo.sql 에 따로 있다.
--  gyms.owner_id 가 실제 계정을 참조하므로, 앱에서 회원가입을 한 뒤에
--  실행해야 한다. 운영 시작하면 05 는 실행하지 않으면 그만이다.
--
--  ★ 설계 요점 ★
--  기구는 "역량"을 제공하고 종목은 "역량"을 요구한다.
--  덤벨 하나 등록하면 20개 종목이 열리고, 케이블 타워 하나면 15개가 열린다.
--  레그컬 머신처럼 하나만 여는 기구도 있다. 그게 현실에 맞다.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
--  1. 기구 표준 목록
--     provides 에 이 기구가 열어주는 역량을 적는다.
--     is_generative = true 인 기구는 정해진 종목 외의 변형도 가능하다.
-- ─────────────────────────────────────────────────────────────
insert into public.machine_catalog
  (code, name_ko, name_en, category, provides, is_free_weight, is_generative, default_step_kg, aliases, sort)
values
  -- 랙 · 프레임
  ('POWER_RACK',    '파워랙',            'Power Rack',        'rack', '{squat_rack,bench_press_rack,pullup_bar}', true,  true,  2.5, '{"랙","스쿼트랙","파워케이지"}', 10),
  ('HALF_RACK',     '하프랙',            'Half Rack',         'rack', '{squat_rack,bench_press_rack}',            true,  true,  2.5, '{"스쿼트랙"}', 11),
  ('SMITH',         '스미스 머신',        'Smith Machine',     'rack', '{smith,squat_rack}',                       false, true,  5,   '{"스미스"}', 12),
  ('PULLUP_BAR',    '철봉',              'Pull-up Bar',       'rack', '{pullup_bar}',                             false, true,  null,'{"턱걸이","풀업바"}', 13),
  ('DIP_STATION',   '딥스 스테이션',      'Dip Station',       'rack', '{dip_bar,pullup_bar}',                     false, true,  null,'{"딥스","평행봉"}', 14),

  -- 벤치
  ('BENCH_FLAT',    '플랫 벤치',          'Flat Bench',        'bench', '{bench_flat}',                            false, false, null,'{"벤치"}', 20),
  ('BENCH_ADJ',     '조절식 벤치',        'Adjustable Bench',  'bench', '{bench_flat,bench_incline,bench_decline}', false, true,  null,'{"인클라인벤치","각도벤치"}', 21),

  -- 프리웨이트
  ('BARBELL',       '올림픽 바벨',         'Olympic Barbell',   'free', '{barbell}',                                true,  true,  5,   '{"바벨","봉"}', 30),
  ('PLATE_SMALL',   '소형 원판 (1~2.5kg)','Micro Plates',      'free', '{plates_small}',                           true,  false, 1.25,'{"짤판","마이크로플레이트"}', 31),
  ('EZ_BAR',        'EZ 바',             'EZ Bar',            'free', '{ez_bar}',                                 true,  true,  2.5, '{"이지바","컬바"}', 32),
  ('TRAP_BAR',      '트랩바',            'Trap Bar',          'free', '{trap_bar}',                               true,  true,  5,   '{"헥스바"}', 33),
  ('DUMBBELL',      '덤벨 랙',           'Dumbbells',         'free', '{dumbbell}',                               true,  true,  2,   '{"덤벨","아령"}', 34),
  ('KETTLEBELL',    '케틀벨',            'Kettlebells',       'free', '{kettlebell}',                             true,  true,  4,   '{"케틀"}', 35),
  ('LANDMINE',      '랜드마인',          'Landmine',          'free', '{landmine}',                               true,  true,  2.5, '{}', 36),

  -- 케이블
  ('CABLE_CROSS',   '케이블 크로스오버',   'Cable Crossover',   'cable', '{cable_low,cable_mid,cable_high,cable_dual,cable_adjustable}', false, true, 2.5, '{"케이블","크로스오버"}', 40),
  ('FUNC_TRAINER',  '펑셔널 트레이너',     'Functional Trainer','cable', '{cable_low,cable_mid,cable_high,cable_dual,cable_adjustable}', false, true, 2.5, '{"멀티케이블"}', 41),
  ('CABLE_TOWER',   '케이블 타워 (1주)',   'Cable Tower',       'cable', '{cable_low,cable_mid,cable_high,cable_adjustable}',            false, true, 5,   '{"케이블머신"}', 42),
  ('LAT_PULLDOWN',  '랫풀다운',          'Lat Pulldown',      'cable', '{cable_high,machine_lat_pulldown}',        false, false, 5,   '{"랫풀","풀다운"}', 43),
  ('SEATED_ROW',    '시티드 로우',        'Seated Row',        'cable', '{cable_low,machine_row}',                  false, false, 5,   '{"로우머신"}', 44),

  -- 머신
  ('CHEST_PRESS',   '체스트 프레스',      'Chest Press',       'machine', '{machine_chest_press}',   false, false, 5,  '{"가슴머신"}', 50),
  ('PEC_DECK',      '펙덱 플라이',        'Pec Deck',          'machine', '{machine_pec_deck}',      false, false, 5,  '{"버터플라이"}', 51),
  ('SHOULDER_PR',   '숄더 프레스 머신',    'Shoulder Press',    'machine', '{machine_shoulder_press}',false, false, 5,  '{"어깨머신"}', 52),
  ('LEG_PRESS',     '레그프레스',        'Leg Press',         'machine', '{machine_leg_press}',     false, false, 10, '{"레그프래스"}', 53),
  ('HACK_SQUAT',    '핵 스쿼트',         'Hack Squat',        'machine', '{machine_hack_squat}',    false, false, 10, '{"핵스쿼트"}', 54),
  ('LEG_EXT',       '레그 익스텐션',      'Leg Extension',     'machine', '{machine_leg_ext}',       false, false, 5,  '{"레그익스"}', 55),
  ('LEG_CURL',      '레그 컬',           'Leg Curl',          'machine', '{machine_leg_curl}',      false, false, 5,  '{"레그컬"}', 56),
  ('HIP_ABD',       '아브덕션 머신',      'Hip Abduction',     'machine', '{machine_hip_abd}',       false, false, 5,  '{"아덕션","벌리기"}', 57),
  ('HIP_ADD',       '애덕션 머신',        'Hip Adduction',     'machine', '{machine_hip_add}',       false, false, 5,  '{"모으기"}', 58),
  ('HIP_THRUST_M',  '힙쓰러스트 머신',    'Hip Thrust Machine','machine', '{machine_glute}',         false, false, 5,  '{"글루트머신"}', 59),
  ('CALF_MACHINE',  '카프 레이즈 머신',   'Calf Raise',        'machine', '{machine_calf}',          false, false, 5,  '{"종아리"}', 60),
  ('BACK_EXT',      '백 익스텐션',        'Back Extension',    'machine', '{machine_back_ext}',      false, false, null,'{"허리기구","로만체어"}', 61),
  ('AB_MACHINE',    '복근 머신',          'Ab Crunch Machine', 'machine', '{machine_ab}',            false, false, 5,  '{"복근기구"}', 62),
  ('ASSIST_PULLUP', '어시스트 풀업 머신',  'Assisted Pull-up',  'machine', '{machine_assisted_pullup}',false,false, 5,  '{"보조턱걸이"}', 63),

  -- 유산소
  ('TREADMILL',     '트레드밀',          'Treadmill',         'cardio', '{treadmill}',   false, false, null, '{"러닝머신"}', 70),
  ('CYCLE',         '사이클',            'Stationary Bike',   'cardio', '{cycle}',       false, false, null, '{"실내자전거"}', 71),
  ('ROWER',         '로잉 머신',          'Rowing Machine',    'cardio', '{rower}',       false, false, null, '{"로잉"}', 72),
  ('ELLIPTICAL',    '일립티컬',          'Elliptical',        'cardio', '{elliptical}',  false, false, null, '{"천국의계단 아님"}', 73),
  ('STAIRMILL',     '스텝밀',            'Stairmill',         'cardio', '{stairmill}',   false, false, null, '{"천국의계단"}', 74),

  -- 소도구
  ('MAT',           '매트 · 스트레칭존',  'Mats',              'etc', '{floor_mat}', false, true,  null, '{"매트"}', 80),
  ('BAND',          '밴드',              'Resistance Bands',  'etc', '{band}',      false, true,  null, '{"세라밴드","루프밴드"}', 81),
  ('BOX',           '플라이오 박스',      'Plyo Box',          'etc', '{box}',       false, true,  null, '{"박스","스텝박스"}', 82),
  ('TRX',           'TRX · 서스펜션',    'Suspension Trainer','etc', '{trx}',       false, true,  null, '{"서스펜션"}', 83),
  ('MEDBALL',       '메디신볼',          'Medicine Ball',     'etc', '{medball}',   false, true,  4,    '{"메디신"}', 84),
  ('SLED',          '슬레드 · 푸시썰매',  'Sled',              'etc', '{sled}',      false, true,  5,    '{"썰매"}', 85)
on conflict (code) do update set
  name_ko = excluded.name_ko, provides = excluded.provides,
  category = excluded.category, is_generative = excluded.is_generative,
  default_step_kg = excluded.default_step_kg, aliases = excluded.aliases,
  sort = excluded.sort;


-- ─────────────────────────────────────────────────────────────
--  2. 종목 표준 목록
--
--     requires 가 비면 맨몸(어디서나 가능).
--     is_freeform = true 는 "정해진 세팅 없이 변형해도 되는 종목".
--     케이블·덤벨 종목이 대부분 여기 해당한다. 앱이 '변형 가능' 배지를
--     띄우고, 트레이너가 자기 버전을 만들 수 있게 한다.
--
--     avoid_areas 는 병명이 아니라 부위다. 이유는 docs/LEGAL.md 2장.
-- ─────────────────────────────────────────────────────────────
insert into public.exercises
  (code, name_ko, name_en, pattern, primary_muscles, requires, is_freeform,
   setup_note, is_compound, skill_level, avoid_areas)
values
  -- ── 수평 밀기 (가슴) ──
  ('BB_BENCH',        '바벨 벤치프레스',    'Barbell Bench Press',   'horizontal_push', '{가슴,삼두}', '{barbell,bench_flat,bench_press_rack}', false, null, true, 2, '{shoulder}'),
  ('DB_BENCH',        '덤벨 벤치프레스',    'Dumbbell Bench Press',  'horizontal_push', '{가슴,삼두}', '{dumbbell,bench_flat}', true, null, true, 1, '{shoulder}'),
  ('DB_INCLINE',      '인클라인 덤벨프레스', 'Incline DB Press',      'horizontal_push', '{윗가슴,삼두}', '{dumbbell,bench_incline}', true, '벤치 30~45도', true, 1, '{shoulder}'),
  ('BB_INCLINE',      '인클라인 바벨프레스', 'Incline Barbell Press', 'horizontal_push', '{윗가슴,삼두}', '{barbell,bench_incline,bench_press_rack}', false, '벤치 30도', true, 2, '{shoulder}'),
  ('SMITH_BENCH',     '스미스 벤치프레스',  'Smith Bench Press',     'horizontal_push', '{가슴,삼두}', '{smith,bench_flat}', false, null, true, 1, '{shoulder}'),
  ('SMITH_INCLINE',   '스미스 인클라인',    'Smith Incline Press',   'horizontal_push', '{윗가슴}', '{smith,bench_incline}', false, null, true, 1, '{shoulder}'),
  ('CHEST_PRESS_M',   '체스트 프레스',      'Machine Chest Press',   'horizontal_push', '{가슴,삼두}', '{machine_chest_press}', false, null, true, 1, '{}'),
  ('PUSHUP',          '푸시업',            'Push-up',               'horizontal_push', '{가슴,삼두}', '{}', true, null, true, 1, '{wrist,shoulder}'),
  ('DIP_CHEST',       '딥스 (가슴)',        'Chest Dip',             'horizontal_push', '{아랫가슴,삼두}', '{dip_bar}', true, '상체를 앞으로 기울인다', true, 2, '{shoulder}'),
  ('FLOOR_PRESS_DB',  '덤벨 플로어프레스',  'DB Floor Press',        'horizontal_push', '{가슴,삼두}', '{dumbbell,floor_mat}', true, '벤치가 없을 때', true, 1, '{}'),

  -- ── 수평 모으기 (가슴 고립) ──
  ('CABLE_FLY',       '케이블 플라이',      'Cable Fly',             'horizontal_adduction', '{가슴}', '{cable_dual}', true, '높이를 바꾸면 상·중·하 가슴', false, 1, '{shoulder}'),
  ('CABLE_FLY_LOW',   '로우 케이블 플라이', 'Low Cable Fly',         'horizontal_adduction', '{윗가슴}', '{cable_low,cable_dual}', true, '아래에서 위로', false, 1, '{shoulder}'),
  ('PEC_DECK_EX',     '펙덱 플라이',        'Pec Deck',              'horizontal_adduction', '{가슴}', '{machine_pec_deck}', false, null, false, 1, '{shoulder}'),
  ('DB_FLY',          '덤벨 플라이',        'Dumbbell Fly',          'horizontal_adduction', '{가슴}', '{dumbbell,bench_flat}', true, null, false, 2, '{shoulder}'),

  -- ── 수직 밀기 (어깨) ──
  ('OHP',             '오버헤드 프레스',    'Overhead Press',        'vertical_push', '{어깨,삼두}', '{barbell,squat_rack}', false, null, true, 2, '{shoulder,low_back}'),
  ('DB_SHOULDER_PR',  '덤벨 숄더프레스',    'DB Shoulder Press',     'vertical_push', '{어깨,삼두}', '{dumbbell}', true, '앉아서 하면 허리 부담이 준다', true, 1, '{shoulder}'),
  ('SHOULDER_PR_M',   '숄더 프레스 머신',   'Machine Shoulder Press','vertical_push', '{어깨,삼두}', '{machine_shoulder_press}', false, null, true, 1, '{}'),
  ('SMITH_OHP',       '스미스 숄더프레스',  'Smith Shoulder Press',  'vertical_push', '{어깨}', '{smith}', false, null, true, 1, '{shoulder}'),
  ('LANDMINE_PRESS',  '랜드마인 프레스',    'Landmine Press',        'vertical_push', '{어깨}', '{landmine}', true, '어깨가 불편할 때 대안', true, 2, '{}'),
  ('PIKE_PUSHUP',     '파이크 푸시업',      'Pike Push-up',          'vertical_push', '{어깨}', '{}', true, null, true, 2, '{wrist,shoulder}'),

  -- ── 수직 당기기 (등) ──
  ('PULLUP',          '턱걸이',            'Pull-up',               'vertical_pull', '{광배,이두}', '{pullup_bar}', true, '그립 폭을 바꾸면 자극이 달라진다', true, 3, '{shoulder,elbow}'),
  ('CHINUP',          '친업',              'Chin-up',               'vertical_pull', '{광배,이두}', '{pullup_bar}', true, '손바닥이 나를 향하게', true, 3, '{elbow}'),
  ('ASSISTED_PULLUP', '어시스트 턱걸이',    'Assisted Pull-up',      'vertical_pull', '{광배}', '{machine_assisted_pullup}', false, null, true, 1, '{shoulder}'),
  ('LAT_PULLDOWN_W',  '케이블 랫 풀다운',  'Cable Lat Pulldown',    'vertical_pull', '{광배,이두}', '{cable_high}', true, '와이드·클로즈·언더 그립', true, 1, '{shoulder}'),
  ('LAT_PULLDOWN_N',  '뉴트럴 랫풀다운',    'Neutral Lat Pulldown',  'vertical_pull', '{광배}', '{cable_high}', true, '평행 그립 핸들', true, 1, '{}'),
  ('STRAIGHT_PULLOVER','케이블 풀오버',     'Cable Pullover',        'vertical_pull', '{광배}', '{cable_high}', true, '팔을 편 채로', false, 2, '{shoulder}'),

  -- ── 수평 당기기 (등) ──
  ('BB_ROW',          '바벨 로우',          'Barbell Row',           'horizontal_pull', '{등,이두}', '{barbell}', false, null, true, 2, '{low_back}'),
  ('DB_ROW',          '원암 덤벨로우',      'One-arm DB Row',        'horizontal_pull', '{등,이두}', '{dumbbell}', true, '벤치가 있으면 한 손 지지', true, 1, '{low_back}'),
  ('CHEST_SUP_ROW',   '체스트 서포티드 로우','Chest-supported Row',  'horizontal_pull', '{등}', '{dumbbell,bench_incline}', true, '허리 부담이 적다', true, 1, '{}'),
  ('SEATED_ROW_N',    '시티드 케이블로우',  'Seated Cable Row',      'horizontal_pull', '{등,이두}', '{cable_low}', true, '핸들만 바꿔도 다른 운동', true, 1, '{low_back}'),
  ('CABLE_FACE_PULL', '페이스 풀',          'Face Pull',             'horizontal_abduction', '{후면삼각근,승모}', '{cable_high}', true, '어깨 건강에 좋다', false, 1, '{}'),
  ('INVERTED_ROW',    '인버티드 로우',      'Inverted Row',          'horizontal_pull', '{등}', '{smith}', true, '바 높이로 난이도 조절', true, 1, '{}'),
  ('TRX_ROW',         'TRX 로우',          'TRX Row',               'horizontal_pull', '{등}', '{trx}', true, '각도로 난이도 조절', true, 1, '{}'),
  ('LANDMINE_ROW',    '랜드마인 로우',      'Landmine Row',          'horizontal_pull', '{등}', '{landmine}', true, null, true, 2, '{low_back}'),

  -- ── 스쿼트 계열 ──
  ('BB_SQUAT',        '바벨 스쿼트',        'Barbell Back Squat',    'squat', '{대퇴사두,둔근}', '{barbell,squat_rack}', false, null, true, 3, '{knee,low_back}'),
  ('FRONT_SQUAT',     '프론트 스쿼트',      'Front Squat',           'squat', '{대퇴사두}', '{barbell,squat_rack}', false, null, true, 3, '{knee,wrist}'),
  ('SMITH_SQUAT',     '스미스 스쿼트',      'Smith Squat',           'squat', '{대퇴사두,둔근}', '{smith}', false, null, true, 1, '{knee}'),
  ('GOBLET_SQUAT',    '고블릿 스쿼트',      'Goblet Squat',          'squat', '{대퇴사두,둔근}', '{dumbbell}', true, '입문자에게 가장 좋은 스쿼트', true, 1, '{knee}'),
  ('KB_GOBLET',       '케틀벨 고블릿',      'KB Goblet Squat',       'squat', '{대퇴사두}', '{kettlebell}', true, null, true, 1, '{knee}'),
  ('LEG_PRESS_EX',    '레그프레스',        'Leg Press',             'squat', '{대퇴사두,둔근}', '{machine_leg_press}', false, '발 위치로 자극 조절', true, 1, '{knee}'),
  ('HACK_SQUAT_EX',   '핵 스쿼트',         'Hack Squat',            'squat', '{대퇴사두}', '{machine_hack_squat}', false, null, true, 2, '{knee}'),
  ('BULGARIAN',       '불가리안 스플릿',    'Bulgarian Split Squat', 'squat', '{대퇴사두,둔근}', '{dumbbell,bench_flat}', true, null, true, 2, '{knee}'),
  ('WALKING_LUNGE',   '워킹 런지',          'Walking Lunge',         'squat', '{대퇴사두,둔근}', '{dumbbell}', true, null, true, 2, '{knee}'),
  ('STEP_UP',         '스텝업',            'Step-up',               'squat', '{둔근,대퇴사두}', '{box,dumbbell}', true, '박스 높이로 강도 조절', true, 1, '{knee}'),
  ('BW_SQUAT',        '맨몸 스쿼트',        'Bodyweight Squat',      'squat', '{대퇴사두}', '{}', true, null, true, 1, '{knee}'),

  -- ── 힌지 (후면 사슬) ──
  ('DEADLIFT',        '데드리프트',        'Deadlift',              'hinge', '{햄스트링,둔근,등}', '{barbell}', false, null, true, 3, '{low_back}'),
  ('TRAP_BAR_DL',     '트랩바 데드리프트',  'Trap Bar Deadlift',     'hinge', '{햄스트링,둔근}', '{trap_bar}', false, '허리 부담이 바벨보다 적다', true, 2, '{low_back}'),
  ('RDL_BB',          '루마니안 데드리프트','Romanian Deadlift',     'hinge', '{햄스트링,둔근}', '{barbell}', false, null, true, 2, '{low_back}'),
  ('RDL_DB',          '덤벨 루마니안 데드', 'DB Romanian Deadlift',  'hinge', '{햄스트링,둔근}', '{dumbbell}', true, null, true, 1, '{low_back}'),
  ('KB_SWING',        '케틀벨 스윙',        'Kettlebell Swing',      'hinge', '{둔근,햄스트링}', '{kettlebell}', true, null, true, 2, '{low_back}'),
  ('HIP_THRUST_BB',   '바벨 힙쓰러스트',    'Barbell Hip Thrust',    'hinge', '{둔근}', '{barbell,bench_flat}', false, null, true, 2, '{}'),
  ('HIP_THRUST_MACH', '힙쓰러스트 머신',    'Machine Hip Thrust',    'hinge', '{둔근}', '{machine_glute}', false, null, true, 1, '{}'),
  ('CABLE_PULLTHRU',  '케이블 힙 힌지',     'Cable hip hinge',       'hinge', '{둔근,햄스트링}', '{cable_low}', true, '둔근 보조 힙힌지', false, 1, '{}'),
  ('BACK_EXT_EX',     '백 익스텐션',        'Back Extension',        'hinge', '{척추기립근,둔근}', '{machine_back_ext}', false, null, false, 1, '{low_back}'),
  ('GLUTE_BRIDGE',    '글루트 브릿지',      'Glute Bridge',          'hinge', '{둔근}', '{floor_mat}', true, null, false, 1, '{}'),

  -- ── 무릎 굴곡 · 신전 ──
  ('LEG_EXT_EX',      '레그 익스텐션',      'Leg Extension',         'extension', '{대퇴사두}', '{machine_leg_ext}', false, null, false, 1, '{knee}'),
  ('LEG_CURL_EX',     '레그 컬',           'Leg Curl',              'flexion', '{햄스트링}', '{machine_leg_curl}', false, null, false, 1, '{}'),
  ('NORDIC_CURL',     '노르딕 컬',          'Nordic Curl',           'flexion', '{햄스트링}', '{floor_mat}', true, '발을 고정할 것', false, 3, '{knee}'),
  ('BAND_LEG_CURL',   '밴드 레그컬',        'Band Leg Curl',         'flexion', '{햄스트링}', '{band,floor_mat}', true, '기구가 없을 때', false, 1, '{}'),

  -- ── 외전 · 내전 ──
  ('HIP_ABD_EX',      '아브덕션',          'Hip Abduction',         'abduction', '{중둔근}', '{machine_hip_abd}', false, null, false, 1, '{}'),
  ('HIP_ADD_EX',      '애덕션',            'Hip Adduction',         'adduction', '{내전근}', '{machine_hip_add}', false, null, false, 1, '{}'),
  ('BAND_CLAMSHELL',  '밴드 클램쉘',        'Band Clamshell',        'abduction', '{중둔근}', '{band,floor_mat}', true, null, false, 1, '{}'),
  ('CABLE_ABDUCTION', '케이블 힙 어브덕션', 'Cable Hip Abduction',   'abduction', '{중둔근}', '{cable_low}', true, null, false, 1, '{}'),
  ('DB_LATERAL',      '래터럴 레이즈',      'Lateral Raise',         'abduction', '{측면삼각근}', '{dumbbell}', true, null, false, 1, '{shoulder}'),
  ('CABLE_LATERAL',   '케이블 래터럴',      'Cable Lateral Raise',   'abduction', '{측면삼각근}', '{cable_low}', true, '덤벨보다 자극이 고르다', false, 1, '{shoulder}'),
  ('DB_REAR_FLY',     '리어 델트 플라이',   'Rear Delt Fly',         'horizontal_abduction', '{후면삼각근}', '{dumbbell}', true, null, false, 1, '{}'),
  ('CABLE_REAR_FLY',  '케이블 리어 플라이', 'Cable Rear Fly',        'horizontal_abduction', '{후면삼각근}', '{cable_dual}', true, null, false, 1, '{}'),

  -- ── 팔 ──
  ('DB_CURL',         '덤벨 컬',           'Dumbbell Curl',         'elbow_flexion', '{이두}', '{dumbbell}', true, '해머·인클라인 등 변형 자유', false, 1, '{elbow}'),
  ('EZ_CURL',         'EZ바 컬',           'EZ Bar Curl',           'elbow_flexion', '{이두}', '{ez_bar}', true, null, false, 1, '{elbow,wrist}'),
  ('CABLE_CURL',      '케이블 컬',          'Cable Curl',            'elbow_flexion', '{이두}', '{cable_low}', true, null, false, 1, '{elbow}'),
  ('BB_CURL',         '바벨 컬',           'Barbell Curl',          'elbow_flexion', '{이두}', '{barbell}', false, null, false, 1, '{elbow,wrist}'),
  ('PUSHDOWN',        '케이블 푸시다운',    'Cable Pushdown',        'elbow_extension', '{삼두}', '{cable_high}', true, '로프·바 자유', false, 1, '{elbow}'),
  ('OVERHEAD_EXT',    '오버헤드 익스텐션',  'Overhead Extension',    'elbow_extension', '{삼두}', '{dumbbell}', true, null, false, 1, '{elbow,shoulder}'),
  ('SKULL_CRUSHER',   '스컬 크러셔',        'Skull Crusher',         'elbow_extension', '{삼두}', '{ez_bar,bench_flat}', false, null, false, 2, '{elbow}'),
  ('DIP_TRICEPS',     '딥스 (삼두)',        'Triceps Dip',           'elbow_extension', '{삼두}', '{dip_bar}', true, '상체를 세운다', true, 2, '{shoulder}'),
  ('BENCH_DIP',       '벤치 딥스',          'Bench Dip',             'elbow_extension', '{삼두}', '{bench_flat}', true, null, false, 1, '{shoulder}'),

  -- ── 종아리 ──
  ('CALF_MACH_EX',    '카프 레이즈 머신',   'Machine Calf Raise',    'plantarflexion', '{비복근}', '{machine_calf}', false, null, false, 1, '{}'),
  ('DB_CALF',         '덤벨 카프 레이즈',   'DB Calf Raise',         'plantarflexion', '{비복근}', '{dumbbell}', true, '계단이나 박스 위에서', false, 1, '{ankle}'),
  ('SMITH_CALF',      '스미스 카프',        'Smith Calf Raise',      'plantarflexion', '{비복근}', '{smith}', false, null, false, 1, '{ankle}'),

  -- ── 코어 ──
  ('PLANK',           '플랭크',            'Plank',                 'core', '{복근}', '{floor_mat}', true, null, false, 1, '{shoulder}'),
  ('DEAD_BUG',        '데드버그',          'Dead Bug',              'core', '{복근}', '{floor_mat}', true, '허리가 불편할 때 안전', false, 1, '{}'),
  ('HANGING_LEG',     '행잉 레그레이즈',    'Hanging Leg Raise',     'core', '{복근}', '{pullup_bar}', true, null, false, 3, '{shoulder,low_back}'),
  ('CABLE_CRUNCH',    '케이블 크런치',      'Cable Crunch',          'core', '{복근}', '{cable_high}', true, null, false, 1, '{low_back}'),
  ('AB_MACHINE_EX',   '복근 머신',          'Ab Crunch Machine',     'core', '{복근}', '{machine_ab}', false, null, false, 1, '{low_back}'),
  ('PALLOF',          '팔로프 프레스',      'Pallof Press',          'core', '{복사근}', '{cable_mid}', true, '회전에 저항하는 운동', false, 2, '{}'),
  ('FARMER_CARRY',    '파머스 캐리',        'Farmer Carry',          'carry', '{전신}', '{dumbbell}', true, null, true, 1, '{}'),
  ('AB_WHEEL',        '앱 롤아웃',          'Ab Rollout',            'core', '{복근}', '{floor_mat}', true, null, false, 3, '{low_back}'),

  -- ── 유산소 ──
  ('ZONE2_TM',        '트레드밀 Zone2',     'Treadmill Zone 2',      'cardio', '{심폐}', '{treadmill}', false, '대화 가능한 강도', false, 1, '{}'),
  ('INCLINE_WALK',    '경사 걷기',          'Incline Walk',          'cardio', '{심폐}', '{treadmill}', false, '경사 10~15%', false, 1, '{}'),
  ('ZONE2_CYCLE',     '사이클 Zone2',       'Cycle Zone 2',          'cardio', '{심폐}', '{cycle}', false, null, false, 1, '{knee}'),
  ('ROWING',          '로잉',              'Rowing',                'cardio', '{심폐,등}', '{rower}', false, null, false, 2, '{low_back}'),
  ('STAIRMILL_EX',    '스텝밀',            'Stairmill',             'cardio', '{심폐}', '{stairmill}', false, null, false, 1, '{knee}'),
  ('ELLIPTICAL_EX',   '일립티컬',          'Elliptical',            'cardio', '{심폐}', '{elliptical}', false, '무릎 부담이 적다', false, 1, '{}'),
  ('SLED_PUSH',       '슬레드 푸시',        'Sled Push',             'cardio', '{전신}', '{sled}', true, null, true, 2, '{}')
on conflict (code) do update set
  name_ko = excluded.name_ko, pattern = excluded.pattern,
  requires = excluded.requires, is_freeform = excluded.is_freeform,
  setup_note = excluded.setup_note, is_compound = excluded.is_compound,
  skill_level = excluded.skill_level, avoid_areas = excluded.avoid_areas;


-- ─────────────────────────────────────────────────────────────
--  확인용 — 실행해서 숫자가 나오면 정상이다.
-- ─────────────────────────────────────────────────────────────
-- select count(*) from machine_catalog;   -- 46
-- select count(*) from exercises;         -- 90
--
-- 특정 역량 조합으로 몇 종목이 되는지 미리 보기:
-- select count(*) from exercises where requires <@ '{dumbbell,bench_flat,bench_incline}';
-- → 덤벨과 조절식 벤치만 있어도 이만큼 된다.
