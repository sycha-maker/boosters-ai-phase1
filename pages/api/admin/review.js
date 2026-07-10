import { withData } from "../../../lib/db";
import { pointsForSubmission } from "../../../lib/scoring";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const { id, action, passcode } = req.body || {};
  if (!passcode || passcode !== process.env.ADMIN_PASSCODE) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!id || !["approve", "reject"].includes(action)) {
    return res.status(400).json({ error: "id, action(approve|reject) required" });
  }

  try {
    let awarded = 0;
    await withData((data) => {
      const sub = data.submissions.find((s) => s.id === id);
      if (!sub) throw Object.assign(new Error("submission not found"), { status: 404 });
      if (sub.status !== "pending") throw Object.assign(new Error("already reviewed"), { status: 409 });

      if (action === "approve") {
        awarded = pointsForSubmission(sub.riskScore);
        const user = data.users[sub.userKey] || (data.users[sub.userKey] = {
          name: sub.name,
          team: sub.team,
          points: 0,
          chips: 0,
          createdAt: new Date().toISOString(),
        });
        user.points = (user.points || 0) + awarded;
        user.chips = (user.chips || 0) + awarded;
        sub.status = "approved";
      } else {
        sub.status = "rejected";
      }
      sub.reviewedAt = new Date().toISOString();
      sub.reviewer = "admin";
      return null;
    }, `review ${action}: ${id}`);
    res.status(200).json({ ok: true, awarded });
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e.message || e) });
  }
}
