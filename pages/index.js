import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession, signIn, signOut } from "next-auth/react";
import { saveSession } from "../lib/client";

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingProfile, setCheckingProfile] = useState(true);

  const email = session?.user?.email || "";
  const userKey = email.toLowerCase();

  // 이미 닉네임을 설정해둔 계정이면 굳이 다시 물어보지 않고 바로 월드로 보낸다.
  useEffect(() => {
    if (status !== "authenticated" || !userKey) {
      setCheckingProfile(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/me?userKey=${encodeURIComponent(userKey)}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.user && json.user.name) {
          saveSession({
            userKey,
            name: json.user.name,
            team: json.user.team || "",
            chips: json.user.chips,
            email,
          });
          router.replace("/world");
        } else {
          setCheckingProfile(false);
        }
      })
      .catch(() => setCheckingProfile(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userKey]);

  async function enter(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("게임에서 쓸 별명을 입력해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const resp = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userKey, name: name.trim(), team: team.trim(), email }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "로그인 실패");
      saveSession({ userKey, name: name.trim(), team: team.trim(), chips: json.user.chips, email });
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

        {status === "loading" || checkingProfile ? (
          <div className="card" style={{ textAlign: "center", color: "#9d9d9d" }}>
            확인 중...
          </div>
        ) : !session ? (
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ marginBottom: 16, color: "#c9c9c9" }}>
              boosters.kr 계정으로만 입장할 수 있어요.
            </div>
            <button className="btn" type="button" onClick={() => signIn("google")}>
              🔐 Google로 로그인
            </button>
            {router.query?.error === "AccessDenied" && (
              <div style={{ color: "#ff9c9c", fontSize: 13, marginTop: 12 }}>
                boosters.kr 계정으로만 로그인할 수 있어요. 다른 계정이면 접속이 제한됩니다.
              </div>
            )}
            {router.query?.error === "Configuration" && (
              <div style={{ color: "#ff9c9c", fontSize: 13, marginTop: 12 }}>
                로그인 서버 설정에 문제가 있어요 (환경변수 누락 가능성). 관리자에게 문의해주세요.
              </div>
            )}
            {router.query?.error && router.query.error !== "AccessDenied" && router.query.error !== "Configuration" && (
              <div style={{ color: "#ff9c9c", fontSize: 13, marginTop: 12 }}>
                로그인 중 오류가 발생했어요 ({router.query.error}). 다시 시도해주세요.
              </div>
            )}
          </div>
        ) : (
          <form className="card" onSubmit={enter}>
            <div style={{ fontSize: 13, color: "#9d9d9d", marginBottom: 12 }}>
              {email} 로 인증됨 ·{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  signOut({ callbackUrl: "/" });
                }}
              >
                다른 계정으로
              </a>
            </div>
            <input
              className="field"
              placeholder="게임에서 쓸 별명"
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
        )}

        <div className="hint">boosters.kr 계정 인증 후 게임에서 쓸 별명을 설정하면 바로 입장됩니다.</div>
      </div>
    </div>
  );
}
