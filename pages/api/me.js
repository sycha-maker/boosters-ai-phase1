import { readData } from "../../lib/db";

// 로그인된 사용자의 최신 칩/포인트 잔액을 서버 기준으로 조회.
// 쿠키에 캐시된 값이 아니라 항상 이 엔드포인트로 최신값을 동기화해야 함.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });
  const { userKey } = req.query;
  if (!userKey) return res.status(400).json({ error: "userKey required" });
  try {
    const data = await readData();
    const user = data.users[userKey] || null;
    res.status(200).json({ ok: true, user });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
