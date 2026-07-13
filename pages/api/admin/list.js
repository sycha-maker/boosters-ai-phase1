import { readData } from "../../../lib/db";

export default async function handler(req, res) {
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
    const dropzoneWinners = [...(data.dropzone?.winners || [])]
      .sort((a, b) => new Date(b.drawnAt) - new Date(a.drawnAt))
      .map((w) => ({
        ...w,
        winnerEmail: data.users?.[w.winnerUserKey]?.email || w.winnerUserKey,
      }));
    res.status(200).json({ ok: true, submissions, dropzoneWinners });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
