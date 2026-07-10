const { readData } = require("../../lib/db");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });
  try {
    const data = await readData();
    const list = Object.values(data.users)
      .map((u) => ({ name: u.name, team: u.team, chips: u.chips || 0, points: u.points || 0 }))
      .sort((a, b) => b.chips - a.chips)
      .slice(0, 30);
    res.status(200).json({ ok: true, leaderboard: list });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
