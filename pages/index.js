import { useState } from "react";
import { useRouter } from "next/router";
import { makeUserKey, saveSession } from "../lib/client";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function enter(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    const userKey = makeUserKey(name, team);
    try {
      const resp = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userKey, name: name.trim(), team: team.trim() }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "로그인 실패");
      saveSession({ userKey, name: name.trim(), team: team.trim(), chips: json.user.chips });
      router.push("/world");
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="shell">
        <div className="brandbar">
          <span>boosters AX Phase 1.5 · MVP</span>
          <span>boosters</span>
        </div>
        <div className="title">🎰 크리덴셜 카지노</div>
        <div className="subtitle">
          방치된 크리덴셜 하나가 누군가의 잭팟이 되기 전에 — 부스터스 크루 전용 보안 캠페인
        </div>

        <form className="card" onSubmit={enter}>
          <input
            className="field"
            placeholder="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="field"
            placeholder="팀 (선택)"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          />
          {error && <div style={{ color: "#ff9c9c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "입장 중..." : "🚪 입장하기"}
          </button>
        </form>
        <div className="hint">
          MVP 데모 버전입니다. 실제 운영 시 이름 입력 대신 사내 Google/Slack SSO 로그인으로 대체할
          예정입니다.
        </div>
      </div>
    </div>
  );
}
