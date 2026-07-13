import { withData } from "../../../lib/db";
import { DROPZONE_PRIZES, kstDateKey, defaultStock } from "../../../lib/dropzone";
import { notifyDropzoneOpen } from "../../../lib/notifySlack";

// 매일 17:30(KST) Vercel Cron이 호출하는 엔드포인트.
// vercel.json의 crons 설정에서 UTC 08:30(=KST 17:30)에 GET 요청을 보낸다.
export default async function handler(req, res) {
  // Vercel Cron은 Authorization: Bearer $CRON_SECRET 헤더를 자동으로 붙여 보낸다
  // (CRON_SECRET 환경변수를 설정했을 때만 검증 — 미설정 시엔 검증을 건너뜀)
  const auth = req.headers["authorization"];
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const dateKey = kstDateKey();
    const opened = [];

    await withData((data) => {
      data.dropzone.stock = data.dropzone.stock || defaultStock();
      data.dropzone.rounds = data.dropzone.rounds || {};
      const today = (data.dropzone.rounds[dateKey] = data.dropzone.rounds[dateKey] || {});

      Object.entries(DROPZONE_PRIZES).forEach(([key, cfg]) => {
        if ((data.dropzone.stock[key] || 0) <= 0) return; // 소진된 상품은 다시 열지 않음
        if (today[key]) return; // 오늘 이미 오픈됨 (cron 중복 호출 대비)
        today[key] = { status: "open", entries: [], openedAt: new Date().toISOString() };
        opened.push(cfg.label);
      });
      return null;
    }, `dropzone cron-open ${dateKey}`);

    if (opened.length) await notifyDropzoneOpen(opened);
    res.status(200).json({ ok: true, opened });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
