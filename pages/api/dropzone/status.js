import { readData, withData } from "../../../lib/db";
import {
  DROPZONE_PRIZES,
  DROPZONE_CAP,
  kstDateKey,
  isPastCloseTime,
  drawWinner,
  defaultStock,
} from "../../../lib/dropzone";
import { notifyDropzoneWinner } from "../../../lib/notifySlack";
import { publishToWorld } from "../../../lib/ablyServer";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });
  const userKey = (req.query.userKey || "").toString();

  try {
    const dateKey = kstDateKey();
    let newlyDrawn = [];

    // 마감 시각이 지났고, 아직 처리 안 된(open) 라운드가 있을 때만 추첨을 시도한다
    // (불필요한 쓰기를 피하기 위해 먼저 가볍게 확인)
    if (isPastCloseTime()) {
      const snapshot = await readData();
      const todaySnap = snapshot.dropzone?.rounds?.[dateKey] || {};
      const hasOpenRound = Object.values(todaySnap).some((r) => r.status === "open");

      if (hasOpenRound) {
        await withData((data) => {
          data.dropzone.stock = data.dropzone.stock || defaultStock();
          data.dropzone.rounds = data.dropzone.rounds || {};
          data.dropzone.winners = data.dropzone.winners || [];
          const today = (data.dropzone.rounds[dateKey] = data.dropzone.rounds[dateKey] || {});

          Object.keys(DROPZONE_PRIZES).forEach((prizeKey) => {
            const round = today[prizeKey];
            if (!round || round.status !== "open") return;

            const winnerEntry = drawWinner(prizeKey, round.entries);
            if (winnerEntry) {
              round.status = "drawn";
              round.winnerUserKey = winnerEntry.userKey;
              round.winnerName = winnerEntry.name;
              round.drawnAt = new Date().toISOString();
              data.dropzone.stock[prizeKey] = Math.max(0, (data.dropzone.stock[prizeKey] || 0) - 1);
              data.dropzone.winners.push({
                prizeKey,
                prizeLabel: DROPZONE_PRIZES[prizeKey].label,
                winnerUserKey: winnerEntry.userKey,
                winnerName: winnerEntry.name,
                date: dateKey,
                drawnAt: round.drawnAt,
              });
              newlyDrawn.push({ prizeKey, prizeLabel: DROPZONE_PRIZES[prizeKey].label, winnerName: winnerEntry.name });
            } else {
              // 인원 미달 — 당첨자 없이 오늘은 스킵, 재고는 유지해서 내일 다시 오픈
              round.status = "skipped";
            }
          });
          return null;
        }, `dropzone draw ${dateKey}`);
      }
    }

    // 방금 새로 추첨이 일어났다면 실시간 팝업 + 슬랙 알림
    for (const w of newlyDrawn) {
      // eslint-disable-next-line no-await-in-loop
      await publishToWorld("dropzone-winner", w);
      // eslint-disable-next-line no-await-in-loop
      await notifyDropzoneWinner(w);
    }

    const data = await readData();
    const stock = data.dropzone?.stock || defaultStock();
    const today = data.dropzone?.rounds?.[dateKey] || {};

    const zones = Object.entries(DROPZONE_PRIZES).map(([key, cfg]) => {
      const round = today[key];
      const remaining = stock[key] ?? cfg.totalStock;
      let status = "closed"; // 아직 오늘 오픈 전
      if (remaining <= 0) status = "exhausted";
      else if (round) status = round.status; // open | drawn | skipped

      return {
        key,
        label: cfg.label,
        flavor: cfg.flavor,
        mode: cfg.mode,
        remaining,
        totalStock: cfg.totalStock,
        status,
        participantCount: round?.entries?.length || 0,
        cap: DROPZONE_CAP,
        joined: !!round?.entries?.some((e) => e.userKey === userKey),
        winnerName: round?.winnerName || null,
      };
    });

    let enteredToday = null;
    Object.entries(today).forEach(([key, round]) => {
      if (round.entries?.some((e) => e.userKey === userKey)) enteredToday = key;
    });

    res.status(200).json({ ok: true, zones, enteredToday, dateKey });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
