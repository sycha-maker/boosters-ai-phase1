import { useEffect, useState } from "react";
import Link from "next/link";

export default function Leaderboard() {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setList(json.leaderboard || []);
      })
      .catch((e) => setError(String(e.message || e)));
  }, []);

  return (
    <div className="page">
      <div className="shell">
        <Link href="/lounge" className="back-link">← 라운지로 돌아가기</Link>
        <div className="title">🏆 리더보드</div>
        <div className="subtitle">보유 칩 기준 랭킹입니다.</div>

        <div className="card">
          {error && <div style={{ color: "#ff9c9c" }}>{error}</div>}
          {!error && !list && <div className="empty">불러오는 중...</div>}
          {!error && list && list.length === 0 && (
            <div className="empty">아직 참여한 크루가 없습니다. 첫 번째 주인공이 되어보세요!</div>
          )}
          {!error && list && list.length > 0 && (
            <table className="lb">
              <thead>
                <tr>
                  <th>순위</th>
                  <th>이름</th>
                  <th>팀</th>
                  <th>칩</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u, i) => (
                  <tr key={i}>
                    <td><span className="rank">{i + 1}</span></td>
                    <td>{u.name}</td>
                    <td style={{ color: "#9d9d9d" }}>{u.team || "-"}</td>
                    <td>🪙 {u.chips}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
