const { withData } = require("../../../lib/db");

const SYMBOLS = ["🍒", "🔔", "💎", "7️⃣", "🍋"];

function spinResult() {
  const roll = Math.random();
  if (roll < 0.05) return { tier: "jackpot", mult: 5 };
  if (roll < 0.35) return { tier: "win", mult: 2 };
  return { tier: "lose", mult: 0 };
}

function reelFor(tier) {
  if (tier === "jackpot") return ["7️⃣", "7️⃣", "7️⃣"];
  if (tier === "win") {
    const s = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    return [s, s, SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]];
  }
  return [
    SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
  ];
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const { userKey, bet } = req.body || {};
  const betNum = Number(bet);
  if (!userKey || !betNum || betNum <= 0) {
    return res.status(400).json({ error: "userKey, bet required" });
  }

  try {
    let outcome, newChips;
    await withData((data) => {
      const user = data.users[userKey];
      if (!user) throw Object.assign(new Error("user not found"), { status: 404 });
      if ((user.chips || 0) < betNum) {
        throw Object.assign(new Error("insufficient chips"), { status: 400 });
      }
      const { tier, mult } = spinResult();
      const payout = betNum * mult;
      user.chips = (user.chips || 0) - betNum + payout;
      outcome = { tier, mult, payout, reel: reelFor(tier) };
      newChips = user.chips;
      return null;
    }, `slot: ${userKey} bet ${betNum}`);
    res.status(200).json({ ok: true, ...outcome, chips: newChips });
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e.message || e) });
  }
};
