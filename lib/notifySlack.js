// 신규 제보가 들어올 때 슬랙 채널로 알림을 보내는 유틸.
// SLACK_WEBHOOK_URL 환경변수가 없으면 조용히 아무것도 하지 않습니다(설정 전에도 앱이 정상 동작).

export async function notifyNewSubmission(sub) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;

  const flagsText = sub.flags && sub.flags.length ? sub.flags.join(", ") : "감지된 신호 없음";
  const text =
    `🚨 *새 크리덴셜 제보* (${sub.source === "slack" ? "슬랙" : "웹"})\n` +
    `제보자: *${sub.name}*${sub.team ? ` (${sub.team})` : ""}\n` +
    `링크: ${sub.link}\n` +
    (sub.note ? `설명: ${sub.note}\n` : "") +
    `1차 필터 결과: ${flagsText}\n` +
    `→ 관리자 페이지에서 승인/반려 해주세요.`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    // 알림 실패는 제보 접수 자체를 막지 않도록 조용히 무시
    console.error("Slack notify failed:", e);
  }
}
