import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { readSession } from "../lib/client";

export default function Report() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const s = readSession();
    if (!s) {
      router.replace("/");
      return;
    }
    setSession(s);
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!link.trim()) {
      setError("링크 또는 문서 위치를 입력해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const resp = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userKey: session.userKey,
          name: session.name,
          team: session.team,
          link: link.trim(),
          note: note.trim(),
          source: "web",
        }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "제출 실패");
      setResult(json);
      setLink("");
      setNote("");
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }

  if (!session) return null;

  return (
    <div className="page">
      <div className="shell">
        <Link href="/lounge" className="back-link">← 라운지로 돌아가기</Link>
        <div className="title">🕵️ 크리덴셜 제보</div>
        <div className="subtitle">
          슬랙, 노션, 드라이브 등에 방치된 개인정보·리스크 콘텐츠를 발견하면 링크와 상황을
          적어주세요. 검토 후 칩이 지급됩니다.
        </div>

        <form className="card" onSubmit={submit}>
          <input
            className="field"
            placeholder="링크 (예: notion.so/... , slack.com/archives/...)"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <textarea
            className="field"
            placeholder="상황 설명 (선택) — 예: 퇴사자 개인정보가 담긴 문서가 전체공개로 방치돼 있어요"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && <div style={{ color: "#ff9c9c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "제출 중..." : "🚨 제보하기"}
          </button>
        </form>

        {result && (
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>✅ 제보 접수 완료</div>
            <div className="hint" style={{ marginBottom: 8 }}>
              관리자 검토 후 승인되면 칩이 자동 지급됩니다. (1차 자동 필터 참고용 결과)
            </div>
            {result.flags && result.flags.length > 0 ? (
              result.flags.map((f) => (
                <span key={f} className="tag risk">
                  {f}
                </span>
              ))
            ) : (
              <span className="tag status-pending">감지된 신호 없음 — 그래도 검토합니다</span>
            )}
          </div>
        )}

        <div className="hint">
          이 채널은 슬랙 크리덴셜 아카이빙 채널과 <b>슬랙 슬래시 커맨드</b>로도 연동할 예정입니다.
          (관리자 설정 완료 후 슬랙에서 바로 <code>/제보</code> 명령으로 제출 가능)
        </div>
      </div>
    </div>
  );
}
