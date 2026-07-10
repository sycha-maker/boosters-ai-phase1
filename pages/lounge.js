import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { readSession, saveSession, clearSession } from "../lib/client";

export default function Lounge() {
  const router = useRouter();
  const [session, setSession] = useState(null);

  useEffect(() => {
    const s = readSession();
    if (!s) {
      router.replace("/");
      return;
    }
    setSession(s);
    // 쿠키에 캐시된 칩 수는 오래됐을 수 있으므로 서버 기준 최신값으로 동기화
    fetch(`/api/me?userKey=${encodeURIComponent(s.userKey)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.user) {
          const updated = { ...s, chips: json.user.chips ?? s.chips };
          setSession(updated);
          saveSession(updated);
        }
      })
      .catch(() => {});
  }, []);

  if (!session) return null;

  return (
    <div className="page">
      <div className="shell">
        <div className="brandbar">
          <span>boosters AX Phase 1.5 · MVP</span>
          <span>boosters</span>
        </div>
        <div className="title">🎰 크리덴셜 카지노 라운지</div>
        <div className="subtitle">오늘도 안전한 부스터스를 위해 한 바퀴 둘러볼까요?</div>

        <div className="chipbar">
          <span className="name">{session.name}님{session.team ? ` · ${session.team}` : ""}</span>
          <span className="chips">🪙 {session.chips ?? 0}</span>
        </div>

        <div className="floor">
          <Link href="/report" className="station">
            <div className="emoji">🕵️</div>
            <div className="label">크리덴셜 제보</div>
            <div className="desc">방치된 링크·문서 줍줍하기</div>
          </Link>
          <Link href="/slot" className="station">
            <div className="emoji">🎰</div>
            <div className="label">슬롯머신</div>
            <div className="desc">칩으로 베팅해보기</div>
          </Link>
          <Link href="/leaderboard" className="station">
            <div className="emoji">🏆</div>
            <div className="label">리더보드</div>
            <div className="desc">이번 주 랭킹 보기</div>
          </Link>
          <Link href="/admin" className="station">
            <div className="emoji">🔐</div>
            <div className="label">관리자</div>
            <div className="desc">제보 검수 (담당자 전용)</div>
          </Link>
        </div>

        <button
          className="btn ghost"
          style={{ marginTop: 20 }}
          onClick={() => {
            clearSession();
            router.replace("/");
          }}
        >
          나가기
        </button>
      </div>
    </div>
  );
}
