import * as Ably from "ably";

// 서버(API 라우트)에서 클라이언트들에게 실시간 이벤트를 쏘기 위한 REST 발행 유틸.
// ABLY_API_KEY가 없으면(설정 전) 조용히 무시 — 앱 나머지 기능은 정상 동작.
let restClient;
function getClient() {
  if (!process.env.ABLY_API_KEY) return null;
  if (!restClient) restClient = new Ably.Rest(process.env.ABLY_API_KEY);
  return restClient;
}

export async function publishToWorld(eventName, payload) {
  const client = getClient();
  if (!client) return;
  try {
    const channel = client.channels.get("casino-world");
    await channel.publish(eventName, payload);
  } catch (e) {
    console.error("Ably server publish failed:", e);
  }
}
