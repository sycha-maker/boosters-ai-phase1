// 럭키 드롭존: 실물 상품 베팅 미니게임의 설정과 추첨 로직.
// 매일 KST 17:30에 열리고 17:40(또는 정원 30명 도달)에 마감, 그 즉시 추첨합니다.
// 상품별 재고가 0이 되면 그 부스는 영구 종료됩니다.

export const DROPZONE_PRIZES = {
  airpods: {
    label: "에어팟",
    totalStock: 1,
    mode: "chip",
    flavor: "칩을 많이 모아서 크게 베팅할수록 당첨 확률이 올라가요.",
  },
  musinsa: {
    label: "무신사 20만원 상품권",
    totalStock: 1,
    mode: "number",
    flavor: "참가하면 1~100 중 행운의 번호를 받아요. 마감 시 공개되는 숫자와 가장 가까우면 당첨!",
  },
  baemin: {
    label: "배달의민족 10만원 상품권",
    totalStock: 1,
    mode: "speed",
    flavor: "번개 배달처럼, 먼저 들어올수록 당첨에 유리해요.",
  },
  hotel: {
    label: "호텔 식사권",
    totalStock: 1,
    mode: "uniform",
    flavor: "휴식은 누구에게나 공평하게 — 완전 랜덤 추첨.",
  },
  coffee: {
    label: "커피쿠폰",
    totalStock: 10,
    mode: "nth",
    nth: 5,
    flavor: "오늘 정확히 5번째로 참가하면 무조건 당첨!",
  },
};

// 에어팟(칩 베팅형) 외 나머지 상품의 고정 참가비(칩)
export const DROPZONE_STAKE_FIXED = 1;
// 상품별 동시 참가 최대 인원
export const DROPZONE_CAP = 30;
export const DROPZONE_OPEN_HOUR_KST = 17;
export const DROPZONE_OPEN_MINUTE_KST = 30;
export const DROPZONE_CLOSE_MINUTE_KST = 40;

// KST(UTC+9) 기준 오늘 날짜(YYYY-MM-DD)
export function kstDateKey(d = new Date()) {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function kstHM(d = new Date()) {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return { h: kst.getUTCHours(), m: kst.getUTCMinutes() };
}

export function isPastOpenTime(d = new Date()) {
  const { h, m } = kstHM(d);
  return h > DROPZONE_OPEN_HOUR_KST || (h === DROPZONE_OPEN_HOUR_KST && m >= DROPZONE_OPEN_MINUTE_KST);
}

export function isPastCloseTime(d = new Date()) {
  const { h, m } = kstHM(d);
  return h > DROPZONE_OPEN_HOUR_KST || (h === DROPZONE_OPEN_HOUR_KST && m >= DROPZONE_CLOSE_MINUTE_KST);
}

function weightedPick(entries, weightFn) {
  const weights = entries.map((e, i) => Math.max(0, weightFn(e, i)));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return entries[Math.floor(Math.random() * entries.length)];
  let r = Math.random() * total;
  for (let i = 0; i < entries.length; i++) {
    r -= weights[i];
    if (r <= 0) return entries[i];
  }
  return entries[entries.length - 1];
}

// 상품별 추첨. entries: [{userKey, name, stake, numberGuess, enteredAt}]
// 반환: 당첨된 entry, 또는 null(인원 미달 등으로 오늘은 당첨자 없음 → 재고 유지, 내일 재도전)
export function drawWinner(prizeKey, entries) {
  if (!entries || entries.length === 0) return null;
  const cfg = DROPZONE_PRIZES[prizeKey];
  if (!cfg) return null;

  switch (cfg.mode) {
    case "chip":
      return weightedPick(entries, (e) => Math.max(1, e.stake || 1));
    case "number": {
      const target = 1 + Math.floor(Math.random() * 100);
      let best = entries[0];
      let bestDiff = Infinity;
      entries.forEach((e) => {
        const diff = Math.abs((e.numberGuess || 0) - target);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = e;
        }
      });
      return best;
    }
    case "speed":
      return weightedPick(entries, (e, i) => 1 / (i + 1));
    case "nth": {
      const n = cfg.nth || 5;
      if (entries.length < n) return null;
      return entries[n - 1];
    }
    case "uniform":
    default:
      return entries[Math.floor(Math.random() * entries.length)];
  }
}

export function defaultStock() {
  return Object.fromEntries(Object.entries(DROPZONE_PRIZES).map(([k, v]) => [k, v.totalStock]));
}
