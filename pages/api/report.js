import { withData, makeId } from "../../lib/db";
import { scanText } from "../../lib/keywordFilter";
import { STARTER_CHIPS } from "../../lib/scoring";
import { notifyNewSubmission } from "../../lib/notifySlack";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const { userKey, name, team, link, note, source } = req.body || {};
  if (!userKey || !name || !link) {
    return res.status(400).json({ error: "userKey, name, link required" });
  }

  const scan = scanText(`${link}\n${note || ""}`);
  const submission = {
    id: makeId(),
    userKey,
    name,
    team: team || "",
    link,
    note: note || "",
    source: source || "web",
    flags: scan.flags,
    riskScore: scan.riskScore,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  try {
    await withData((data) => {
      data.submissions.unshift(submission);
      if (!data.users[userKey]) {
        data.users[userKey] = {
          name,
          team: team || "",
          points: 0,
          chips: STARTER_CHIPS,
          createdAt: new Date().toISOString(),
        };
      }
      return null;
    }, `report: ${submission.id}`);
    await notifyNewSubmission(submission);
    res.status(200).json({ ok: true, flags: scan.flags, riskScore: scan.riskScore });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
