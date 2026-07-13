import { withData } from "../../../lib/db";
import {
  DROPZONE_PRIZES,
  DROPZONE_CAP,
  DROPZONE_STAKE_FIXED,
  kstDateKey,
  isPastCloseTime,
  isPastOpenTime,
  defaultStock,
} from "../../../lib/dropzone";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const { userKey, prizeKey, stake } = req.body || {};
  if (!userKey || !prizeKey) return res.status(400).json({ error: "userKey, prizeKey required" });
  const cfg = DROPZONE_PRIZES[prizeKey];
  if (!cfg) return res.status(400).json({ error: "unknown prize" });

  try {
    const dateKey = kstDateKey();
    let result = null;

    await withData((data) => {
      data.dropzone.stock = data.dropzone.stock || defaultStock();
      data.dropzone.rounds = data.dropzone.rounds || {};
      const today = (data.dropzone.rounds[dateKey] = data.dropzone.rounds[dateKey] || {});
      const user = data.users[userKey];

      if (!user) {
        result = { error: "먼저 로그인해주세요." };
        return null;
      }
      if (!isPastOpenTime()) {
        result = { error: "럭키 드롭존은 매일 17:30에 열려요. 그때 다시 와주세요!" };
        return null;
      }
      if (isPastCloseTime()) {
        result = { error: "오늘 접수는 마감됐어요. 내일 17:30에 다시 도전해주세요." };
        return null;
      }
      if ((data.dropzone.stock[prizeKey] || 0) <= 0) {
        result = { error: "이미 소진된 상품이에요." };
        return null;
      }

      // 하루 1상품 제한
      const alreadyEntered = Object.values(today).some((r) =>
        r.entries?.some((e) => e.userKey === userKey)
      );
      if (alreadyEntered) {
        result = { error: "오늘은 이미 다른 상품에 참가하셨어요. 내일 다시 도전해주세요." };
        return null;
      }

      const round = (today[prizeKey] = today[prizeKey] || { status: "open", entries: [], openedAt: new Date().toISOString() });
      if (round.status !== "open") {
        result = { error: "이미 마감된 라운드예요." };
        return null;
      }
      if (round.entries.length >= DROPZONE_CAP) {
        result = { error: `이미 정원(${DROPZONE_CAP}명)이 찼어요.` };
        return null;
      }

      const isChipMode = cfg.mode === "chip";
      let finalStake = DROPZONE_STAKE_FIXED;
      if (isChipMode) {
        finalStake = Math.max(1, Math.floor(Number(stake) || 1));
      }
      if (finalStake > (user.chips || 0)) {
        result = { error: "보유 칩이 부족해요. 칩이 무조건 1개 이상 있어야 참가할 수 있어요." };
        return null;
      }

      user.chips = (user.chips || 0) - finalStake;
      round.entries.push({
        userKey,
        name: user.name,
        stake: finalStake,
        numberGuess: cfg.mode === "number" ? 1 + Math.floor(Math.random() * 100) : undefined,
        enteredAt: new Date().toISOString(),
      });
      result = { ok: true, chips: user.chips, stake: finalStake };
      return null;
    }, `dropzone enter: ${userKey} -> ${prizeKey}`);

    if (result?.error) return res.status(400).json({ error: result.error });
    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
