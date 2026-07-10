import { useEffect, useState } from "react";
import Link from "next/link";

export default function Admin() {
  const [passcode, setPasscode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [subs, setSubs] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" && sessionStorage.getItem("ccm_admin_pass");
    if (saved) {
      setPasscode(saved);
      load(saved);
    }
  }, []);

  async function load(pass) {
    setError("");
    try {
      const resp = await fetch(`/api/admin/list?passcode=${encodeURIComponent(pass)}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "조회 실패");
      setSubs(json.submissions);
      setUnlocked(true);
      sessionStorage.setItem("ccm_admin_pass", pass);
    } catch (e) {
      setError(String(e.message || e));
      setUnlocked(false);
    }
  }

  async function review(id, action) {
    setBusyId(id);
    setError("");
    try {
      const resp = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, passcode }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "처리 실패");
      await load(passcode);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setBusyId(null);
    }
  }

  if (!unlocked) {
    return (
      <div className="page">
        <div className="shell">
          <Link href="/lounge" className="back-link">← 라운지로 돌아가기</Link>
          <div className="title">🔐 관리자 로그인</div>
          <div className="subtitle">담당자 전용 검수 페이지입니다.</div>
          <div className="card">
            <input
              className="field"
              type="password"
              placeholder="관리자 패스코드"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
            />
            {error && <div style={{ color: "#ff9c9c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
            <button className="btn" onClick={() => load(passcode)}>
              입장
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pending = (subs || []).filter((s) => s.status === "pending");
  const reviewed = (subs || []).filter((s) => s.status !== "pending");

  return (
    <div className="page">
      <div className="shell">
        <Link href="/lounge" className="back-link">← 라운지로 돌아가기</Link>
        <div className="title">🔐 제보 검수</div>
        <div className="subtitle">
          대기 중 {pending.length}건 · 처리 완료 {reviewed.length}건
        </div>
        {error && <div style={{ color: "#ff9c9c", marginBottom: 10 }}>{error}</div>}

        {pending.length === 0 && <div className="card empty">대기 중인 제보가 없습니다.</div>}

        {pending.map((s) => (
          <div className="card" key={s.id}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <b>{s.name}</b>
              <span className="hint" style={{ margin: 0 }}>
                {new Date(s.createdAt).toLocaleString("ko-KR")} · {s.source}
              </span>
            </div>
            <div style={{ wordBreak: "break-all", marginBottom: 6, fontSize: 14 }}>{s.link}</div>
            {s.note && <div style={{ color: "#c9c9c9", fontSize: 13, marginBottom: 8 }}>{s.note}</div>}
            <div style={{ marginBottom: 12 }}>
              {s.flags.length > 0 ? (
                s.flags.map((f) => (
                  <span key={f} className="tag risk">
                    {f}
                  </span>
                ))
              ) : (
                <span className="tag status-pending">감지된 신호 없음</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn secondary"
                style={{ width: "auto", flex: 1 }}
                disabled={busyId === s.id}
                onClick={() => review(s.id, "approve")}
              >
                ✅ 승인 (예상 {10 + s.riskScore * 5}칩)
              </button>
              <button
                className="btn danger"
                style={{ width: "auto", flex: 1 }}
                disabled={busyId === s.id}
                onClick={() => review(s.id, "reject")}
              >
                ✕ 반려
              </button>
            </div>
          </div>
        ))}

        {reviewed.length > 0 && (
          <>
            <div className="title" style={{ fontSize: 18, marginTop: 24 }}>
              처리 완료 내역
            </div>
            {reviewed.slice(0, 20).map((s) => (
              <div className="card" key={s.id}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>
                    <b>{s.name}</b> <span className="hint" style={{ margin: 0 }}>· {s.link}</span>
                  </span>
                  <span className={`tag status-${s.status}`}>
                    {s.status === "approved" ? "승인" : "반려"}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
