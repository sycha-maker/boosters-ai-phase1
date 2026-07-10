// GitHub Contents API를 백엔드 저장소로 사용하는 초경량 데이터스토어.
// MVP 단계에서 별도 DB 프로비저닝 없이 동작하도록 설계했습니다.
// 운영 전환 시 Vercel Postgres/Supabase 등 실제 DB로 교체를 권장합니다.

const GH_API = "https://api.github.com";

function envOrThrow(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function ghHeaders() {
  return {
    Authorization: `token ${envOrThrow("GH_TOKEN")}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

function repoPath() {
  const owner = envOrThrow("GH_OWNER");
  const repo = envOrThrow("GH_REPO");
  const path = process.env.DATA_PATH || "data/db.json";
  const branch = process.env.GH_BRANCH || "main";
  return { owner, repo, path, branch };
}

const DEFAULT_DATA = { users: {}, submissions: [] };

async function fetchFile() {
  const { owner, repo, path, branch } = repoPath();
  const url = `${GH_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(
    path
  )}?ref=${branch}`;
  const resp = await fetch(url, { headers: ghHeaders() });
  if (resp.status === 404) {
    return { data: DEFAULT_DATA, sha: null };
  }
  if (!resp.ok) {
    throw new Error(`GitHub GET failed: ${resp.status} ${await resp.text()}`);
  }
  const json = await resp.json();
  const content = Buffer.from(json.content, "base64").toString("utf-8");
  let data;
  try {
    data = JSON.parse(content);
  } catch (e) {
    data = DEFAULT_DATA;
  }
  return { data, sha: json.sha };
}

async function putFile(data, sha, message) {
  const { owner, repo, path, branch } = repoPath();
  const url = `${GH_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(
    path
  )}`;
  const body = {
    message: message || "update data",
    content: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;
  const resp = await fetch(url, {
    method: "PUT",
    headers: ghHeaders(),
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    const err = new Error(`GitHub PUT failed: ${resp.status} ${text}`);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

// 낙관적 락 충돌(409/422 sha mismatch) 대비 재시도 래퍼.
// mutator(data) => data (동기적으로 data를 변경하고 반환)
export async function withData(mutator, message) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, sha } = await fetchFile();
    data.users = data.users || {};
    data.submissions = data.submissions || [];
    const result = mutator(data);
    try {
      await putFile(data, sha, message);
      return result;
    } catch (e) {
      lastErr = e;
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export async function readData() {
  const { data } = await fetchFile();
  data.users = data.users || {};
  data.submissions = data.submissions || [];
  return data;
}

export function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
