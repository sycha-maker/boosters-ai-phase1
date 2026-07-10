const { readData } = require("../../../lib/db");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });
  const passcode = req.query.passcode;
  if (!passcode || passcode !== process.env.ADMIN_PASSCODE) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const data = await readData();
    const submissions = [...data.submissions].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    res.status(200).json({ ok: true, submissions });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
