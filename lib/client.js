// 브라우저 쿠키 기반의 초경량 "로그인" 유틸 (MVP 전용 — 실사용 시 사내 SSO로 교체)
const COOKIE = "ccm_user";

function slugify(str) {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-가-힣]/g, "");
}

export function makeUserKey(name, team) {
  return `${slugify(team || "unknown")}__${slugify(name)}`;
}

export function saveSession(user) {
  document.cookie = `${COOKIE}=${encodeURIComponent(
    JSON.stringify(user)
  )}; path=/; max-age=${60 * 60 * 24 * 30}`;
}

export function readSession() {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(COOKIE + "="));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match.split("=").slice(1).join("=")));
  } catch (e) {
    return null;
  }
}

export function clearSession() {
  document.cookie = `${COOKIE}=; path=/; max-age=0`;
}
