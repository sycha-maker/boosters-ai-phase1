import crypto from "crypto";
import { withData, makeId } from "../../../lib/db";
import { scanText } from "../../../lib/keywordFilter";
import { STARTER_CHIPS } from "../../../lib/scoring";

// Slack Slash Command 수신 엔드포인트.
// 설정 방법(Slack 관리자가 진행): Slack API 콘솔 > Slash Commands > /제보 생성 후
// Request URL을 https://<배포도메인>/api/slack/command 로 지정하면 바로 연동됩니다.
// SLACK_SIGNING_SECRET 환경변수를 설정하면 요청 서명을 검증합니다(미설정 시 검증 생략 — 데모 전용).

export const config = {
  api: { bodyParser: false },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function verifySlackSignature(rawBody, req) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return true; // 데모 모드: 서명 검증 생략
  const timestamp = req.headers["x-slack-request-timestamp"];
  const sig = req.headers["x-slack-signature"];
  if (!timestamp || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 60 * 5) return false;
  const base = `v0:${timestamp}:${rawBody}`;
  const hmac = "v0=" + crypto.createHmac("sha256", secret).update(base).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(sig));
  } catch (e) {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("method not allowed");

  const rawBody = await readRawBody(req);
  if (!verifySlackSignature(rawBody, req)) {
    return res.status(401).send("invalid signature");
  }

  const params = new URLSearchParams(rawBody);
  const userId = params.get("user_id") || "unknown";
  const userName = params.get("user_name") || "익명 크루";
  const text = (params.get("text") || "").trim();

  if (!text) {
    return res.status(200).json({
      response_type: "ephemeral",
      text: "사용법: `/제보 <노션 또는 슬랙 링크> 설명(선택)`\n예) /제보 https://notion.so/xxxx 퇴사자 인사 문서가 전체공개로 방치돼 있어요",
    });
  }

  const [link, ...rest] = text.split(/\s+/);
  const note = rest.join(" ");
  const userKey = `slack:${userId}`;
  const scan = scanText(`${link}\n${note}`);
  const submission = {
    id: makeId(),
    userKey,
    name: userName,
    team: "",
    link,
    note,
    source: "slack",
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
          name: userName,
          team: "",
          points: 0,
          chips: STARTER_CHIPS,
          createdAt: new Date().toISOString(),
        };
      }
      return null;
    }, `slack report: ${submission.id}`);

    return res.status(200).json({
      response_type: "ephemeral",
      text: `✅ 제보 접수 완료! 검토 후 칩이 지급됩니다. (감지된 신호: ${
        scan.flags.length ? scan.flags.join(", ") : "없음 — 그래도 검토합니다"
      })`,
    });
  } catch (e) {
    return res.status(200).json({
      response_type: "ephemeral",
      text: `⚠️ 접수 중 오류가 발생했습니다: ${String(e.message || e)}`,
    });
  }
}
