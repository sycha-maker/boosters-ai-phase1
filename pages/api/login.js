import { withData } from "../../lib/db";
import { STARTER_CHIPS } from "../../lib/scoring";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const { userKey, name, team } = req.body || {};
  if (!userKey || !name) return res.status(400).json({ error: "userKey, name required" });

  try {
    let userOut;
    await withData((data) => {
      if (!data.users[userKey]) {
        data.users[userKey] = {
          name,
          team: team || "",
          points: 0,
          chips: STARTER_CHIPS,
          createdAt: new Date().toISOString(),
        };
      }
      userOut = data.users[userKey];
      return userOut;
    }, `login: ${userKey}`);
    res.status(200).json({ ok: true, user: userOut });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
