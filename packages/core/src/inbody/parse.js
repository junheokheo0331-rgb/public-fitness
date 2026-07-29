/* ============================================================
   parse.js — 체성분 결과지 OCR 텍스트 → 수치

   이 파일은 사용자 기기 안에서만 돈다. 사진은 서버로 가지 않는다.
   OCR 로 뽑은 "글자 덩어리"를 받아서 숫자만 추려내는 게 전부다.

   ★ 제조사명을 코드·주석·UI 어디에도 쓰지 않는다.
     특정 브랜드와의 제휴로 오인되면 상표 문제가 된다.
     라벨 사전에 들어가는 문자열은 결과지에 인쇄된 "항목명"일 뿐이다.

   OCR 은 반드시 틀린다. 그래서 이 파서의 목표는 정확한 인식이 아니라
   "얼마나 못 믿을지"를 정직하게 계산해서 사용자에게 확인시키는 것이다.
   ============================================================ */

/* ---------- 1. 정규화 ----------
   OCR 이 숫자 자리에서 흔히 저지르는 혼동을 되돌린다.
   글자 자리에서는 이 치환을 하면 안 되므로, 숫자 문맥에서만 적용한다. */
const DIGIT_FIX = { O: '0', o: '0', D: '0', Q: '0', I: '1', l: '1', i: '1', '|': '1', S: '5', s: '5', B: '8', Z: '2', z: '2', G: '6', T: '7' };

function fixDigits(tok) {
  return tok.replace(/[OoDQIliS|sBZzGT]/g, (c) => DIGIT_FIX[c] ?? c);
}

export function normalize(raw) {
  return String(raw || '')
    .replace(/\r/g, '')
    .replace(/[，、]/g, ',')
    .replace(/[．·]/g, '.')
    .replace(/[：]/g, ':')
    // 천 단위 콤마를 먼저 없앤다. 순서를 바꾸면 1,652 가 1.652 가 된다.
    .replace(/(\d)\s*,\s*(\d{3})(?!\d)/g, '$1$2')
    // "12 . 3" / "12. 3" → "12.3"
    .replace(/(\d)\s*[.,]\s*(\d)/g, '$1.$2')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/* ---------- 2. 라벨 사전 ----------
   국문·영문·약어를 모두 넣는다. 결과지 종류마다 표기가 다르다.
   min/max 는 사람에게 물리적으로 가능한 범위. 벗어나면 인식 실패로 본다. */
const FIELDS = [
  {
    key: 'weight_kg',
    labels: ['체중', 'weight', 'wt'],
    unit: /kg/i, min: 20, max: 300, decimals: 1,
  },
  {
    key: 'skeletal_muscle_kg',
    labels: ['골격근량', '골격근', 'skeletal muscle mass', 'smm', 'muscle mass'],
    unit: /kg/i, min: 5, max: 80, decimals: 1,
  },
  {
    key: 'body_fat_kg',
    labels: ['체지방량', 'body fat mass', 'bfm', 'fat mass'],
    unit: /kg/i, min: 1, max: 150, decimals: 1,
  },
  {
    key: 'body_fat_pct',
    labels: ['체지방률', '체지방율', 'percent body fat', 'pbf', 'body fat %', 'bf%'],
    unit: /%/, min: 1, max: 70, decimals: 1,
  },
  {
    key: 'bmi',
    labels: ['bmi', '체질량지수'],
    unit: null, min: 8, max: 70, decimals: 1,
  },
  {
    key: 'bmr_kcal',
    labels: ['기초대사량', 'basal metabolic rate', 'bmr'],
    unit: /kcal/i, min: 500, max: 4000, decimals: 0,
  },
  {
    key: 'height_cm',
    labels: ['신장', '키', 'height'],
    unit: /cm/i, min: 100, max: 230, decimals: 1,
  },
];

/* 라벨 뒤에서 숫자를 찾을 때, 이 단어들을 만나면 멈춘다.
   (다음 항목의 라벨을 넘어가서 엉뚱한 숫자를 집는 걸 막는다) */
const ALL_LABELS = FIELDS.flatMap((f) => f.labels);

/* ---------- 3. 라벨 매칭 ----------
   OCR 은 글자도 틀린다. '체지방률'이 '체지방툴'로 나오는 식이다.
   완전일치 → 부분일치 → 편집거리 1 순으로 완화하며 찾는다. */
function editDistance1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diff > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
}

function labelScore(line, label) {
  const L = line.toLowerCase();
  const T = label.toLowerCase();
  if (L.startsWith(T)) return 1.0;
  if (L.includes(T)) return 0.9;
  const head = L.slice(0, T.length + 1);
  if (editDistance1(head.trim(), T)) return 0.65;
  return 0;
}

/* ---------- 4. 숫자 추출 ---------- */
function numbersIn(text) {
  const out = [];
  const re = /(-?[\dOoDQIliSsBZzGT]+(?:\.[\dOoDQIliSsBZzGT]+)?)\s*(kg|%|kcal|cm)?/gi;
  let m;
  while ((m = re.exec(text))) {
    const fixed = fixDigits(m[1]);
    if (!/\d/.test(fixed)) continue;
    const v = parseFloat(fixed);
    if (Number.isNaN(v)) continue;
    out.push({ value: v, unit: m[2] || null, index: m.index, raw: m[1] });
  }
  return out;
}

/**
 * 결과지 OCR 텍스트에서 체성분 수치를 뽑는다.
 *
 * @param {string} rawText  OCR 결과 전문
 * @returns {{
 *   values: Object,                 // { weight_kg: 72.4, ... }
 *   fields: Object,                 // 항목별 { value, confidence, source_line }
 *   confidence: number,             // 0~1 전체 신뢰도
 *   issues: string[],               // 사용자에게 보여줄 확인 요청
 *   needsReview: boolean            // true 면 확인 화면을 강제한다
 * }}
 */
export function parseBodySheet(rawText) {
  const text = normalize(rawText);
  const lines = text.split('\n');
  const fields = {};
  const issues = [];

  for (const f of FIELDS) {
    let best = null;

    lines.forEach((line, li) => {
      for (const label of f.labels) {
        const ls = labelScore(line, label);
        if (!ls) continue;

        // 라벨 뒤쪽에서 찾되, 없으면 다음 줄까지만 본다 (표 형식 대응)
        const at = line.toLowerCase().indexOf(label.toLowerCase());
        const tail = line.slice(at + label.length);
        let cands = numbersIn(tail);
        let usedLine = li;

        if (!cands.length && lines[li + 1]) {
          const nextIsLabel = ALL_LABELS.some((l) => labelScore(lines[li + 1], l) >= 0.9);
          if (!nextIsLabel) { cands = numbersIn(lines[li + 1]); usedLine = li + 1; }
        }

        for (const c of cands) {
          if (c.value < f.min || c.value > f.max) continue;

          // 점수는 0~1 안에서 곱으로 깎는다. 덧셈이면 상한에 걸려 감점이 사라진다.
          let score = ls;
          if (f.unit && c.unit) score *= f.unit.test(c.unit) ? 1.0 : 0.55;
          else if (f.unit) score *= 0.88;              // 단위가 안 찍혔다
          // 라벨에서 멀수록 엉뚱한 숫자일 가능성이 커진다
          score *= 1 - Math.min(c.index / 200, 0.15);
          // OCR 이 글자를 숫자로 고쳐야 했다면 덜 믿는다
          if (c.raw !== fixDigits(c.raw)) score *= 0.75;

          if (!best || score > best.score) {
            best = {
              score,
              value: f.decimals === 0 ? Math.round(c.value) : Math.round(c.value * 10) / 10,
              line: lines[usedLine],
            };
          }
        }
      }
    });

    if (best) {
      fields[f.key] = {
        value: best.value,
        confidence: Math.max(0, Math.min(1, best.score)),
        source_line: best.line,
      };
    }
  }

  /* ---------- 5. 교차검증 ----------
     여기가 이 파서의 핵심이다. 라벨 매칭만으로는 틀렸다는 걸 알 수 없다.
     체지방률 = 체지방량 ÷ 체중 × 100 이 어긋나면 셋 중 하나를 잘못 읽은 것이다.
     이 검산은 OCR 품질과 무관하게 성립하므로 가장 믿을 만한 신호다. */
  const v = (k) => fields[k]?.value ?? null;
  const w = v('weight_kg'), bfm = v('body_fat_kg'), pbf = v('body_fat_pct'), smm = v('skeletal_muscle_kg');

  if (w && bfm && pbf) {
    const derived = (bfm / w) * 100;
    const gap = Math.abs(derived - pbf);
    if (gap > 1.5) {
      issues.push(`체중·체지방량·체지방률이 서로 맞지 않습니다 (계산값 ${derived.toFixed(1)}% vs 인식값 ${pbf}%). 숫자를 확인해주세요.`);
      for (const k of ['weight_kg', 'body_fat_kg', 'body_fat_pct']) {
        if (fields[k]) fields[k].confidence *= 0.5;
      }
    }
  }

  if (w && smm && bfm && smm + bfm > w) {
    issues.push('골격근량과 체지방량의 합이 체중보다 큽니다. 숫자를 확인해주세요.');
    for (const k of ['skeletal_muscle_kg', 'body_fat_kg']) {
      if (fields[k]) fields[k].confidence *= 0.5;
    }
  }

  // BMI 검산 (신장이 같이 잡혔을 때만)
  const h = v('height_cm'), bmi = v('bmi');
  if (w && h && bmi) {
    const derived = w / ((h / 100) ** 2);
    if (Math.abs(derived - bmi) > 1.0) {
      issues.push(`신장·체중으로 계산한 BMI(${derived.toFixed(1)})와 인식값(${bmi})이 다릅니다.`);
      if (fields.bmi) fields.bmi.confidence *= 0.5;
    }
  }

  /* ---------- 6. 결론 ---------- */
  const required = ['weight_kg', 'skeletal_muscle_kg', 'body_fat_pct'];
  const missing = required.filter((k) => !fields[k]);
  if (missing.length) {
    const names = { weight_kg: '체중', skeletal_muscle_kg: '골격근량', body_fat_pct: '체지방률' };
    issues.push(`${missing.map((k) => names[k]).join(', ')}을(를) 읽지 못했습니다. 직접 입력해주세요.`);
  }

  const found = Object.values(fields);
  const confidence = found.length
    ? found.reduce((a, f) => a + f.confidence, 0) / found.length * (1 - missing.length / required.length * 0.5)
    : 0;

  const values = {};
  for (const [k, f] of Object.entries(fields)) values[k] = f.value;

  return {
    values,
    fields,
    confidence: Math.round(confidence * 100) / 100,
    issues,
    // 자동 저장은 절대 하지 않는다. 항상 사람이 확인한다.
    // 신뢰도가 높아도 확인 화면은 띄우되, 낮으면 경고를 강조할 뿐이다.
    needsReview: true,
    lowConfidence: confidence < 0.6 || missing.length > 0 || issues.length > 0,
  };
}

/* ---------- 7. 저장 페이로드 ----------
   서버로 나가는 것은 이 함수의 반환값이 전부다.
   이미지도, OCR 원문도 포함되지 않는다. 그게 설계의 핵심이다. */
export function toRecord(parsed, { memberId, gymId, measuredAt, source = 'photo_ocr', enteredBy = null, consentId = null }) {
  if (!memberId) throw new Error('memberId is required');
  if (source === 'proxy' && !consentId) {
    throw new Error('대리입력은 제3자 제공 동의(consent_id) 없이 저장할 수 없습니다');
  }
  return {
    member_id: memberId,
    gym_id: gymId ?? null,
    measured_at: measuredAt || new Date().toISOString(),
    source,
    entered_by: enteredBy ?? memberId,
    consent_id: consentId,
    weight_kg: parsed.values.weight_kg ?? null,
    skeletal_muscle_kg: parsed.values.skeletal_muscle_kg ?? null,
    body_fat_kg: parsed.values.body_fat_kg ?? null,
    body_fat_pct: parsed.values.body_fat_pct ?? null,
    bmr_kcal: parsed.values.bmr_kcal ?? null,
    height_cm: parsed.values.height_cm ?? null,
    ocr_confidence: parsed.confidence ?? null,
    verified_by_member: false,
  };
}

export const _internal = { FIELDS, normalize, numbersIn, labelScore };
