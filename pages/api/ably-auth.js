import * as Ably from "ably";

// 클라이언트에는 절대 ABLY_API_KEY 원본을 내려주지 않고, 서버에서 단기 토큰만 발급.
// Ably 무료 티어(가입: ably.com)에서 API Key 발급 후 ABLY_API_KEY 환경변수로 등록하면 동작.
export default async function handler(req, res) {
  if (!process.env.ABLY_API_KEY) {
    return res.status(500).json({ error: "ABLY_API_KEY not configured" });
  }
  const clientId = req.query.clientId || `guest-${Date.now()}`;
  try {
    const client = new Ably.Rest(process.env.ABLY_API_KEY);
    const tokenRequestData = await client.auth.createTokenRequest({ clientId });
    res.status(200).json(tokenRequestData);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
