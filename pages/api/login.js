import { withData } from "../../lib/db";
import { STARTER_CHIPS } from "../../lib/scoring";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const { userKey, name, team, email } = req.body || {};
  if (!userKey || !name) return res.status(400).json({ error: "userKey, name required" });

  try {
    let userOut;
    await withData((data) => {
      if (!data.users[userKey]) {
        data.users[userKey] = {
          name,
          team: team || "",
          email: email || "",
          points: 0,
          chips: STARTER_CHIPS,
          createdAt: new Date().toISOString(),
        };
      } else {
        // 닉네임은 재입장 시 바뀔 수 있으니 최신값으로 갱신하고, 인증 이메일은 항상 최신으로 보정
        data.users[userKey].name = name;
        if (team) data.users[userKey].team = team;
        if (email) data.users[userKey].email = email;
      }
      userOut = data.users[userKey];
      return userOut;
    }, `login: ${userKey}`);
    res.status(200).json({ ok: true, user: userOut });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
