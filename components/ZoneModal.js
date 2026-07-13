import { useEffect, useState } from "react";

const BETS = [10, 25, 50];

export default function ZoneModal({ type, session, onClose, onChipsUpdate }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
        {type === "slot" && <SlotPanel session={session} onChipsUpdate={onChipsUpdate} />}
        {type === "report" && <ReportPanel session={session} />}
        {type === "quiz" && <QuizPanel session={session} onChipsUpdate={onChipsUpdate} />}
        {type === "leaderboard" && <LeaderboardPanel />}
        {type === "dropzone" && <DropZonePanel session={session} onChipsUpdate={onChipsUpdate} />}
      </div>
    </div>
  );
}

function SlotPanel({ session, onChipsUpdate }) {
  const [bet, setBet] = useState(10);
  const [reel, setReel] = useState(["🍒", "🔔", "💎"]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [spinning, setSpinning] = useState(false);

  async function spin() {
    if (spinning) return;
    if ((session.chips ?? 0) < bet) {
      setError("칩이 부족합니다.");
      return;
    }
    setError("");
    setSpinning(true);
    setMessage("");
    try {
      const resp = await fetch("/api/game/slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userKey: session.userKey, bet }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "게임 오류");
      await new Promise((r) => setTimeout(r, 500));
      setReel(json.reel);
      onChipsUpdate(json.chips);
      if (json.tier === "jackpot") setMessage(`🎉 잭팟! +${json.payout} 칩`);
      else if (json.tier === "win") setMessage(`✨ 당첨! +${json.payout} 칩`);
      else setMessage(`꽝... -${bet} 칩`);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setSpinning(false);
    }
  }

  return (
    <div>
      <div className="title" style={{ fontSize: 20 }}>🎰 슬롯머신</div>
      <div className="chipbar">
        <span className="name">보유 칩</span>
        <span className="chips">🪙 {session.chips ?? 0}</span>
      </div>
      <div className={`slot-reel ${spinning ? "spin" : ""}`}>
        {reel.map((s, i) => (
          <span key={i}>{s}</span>
        ))}
      </div>
      {message && <div className="result-msg">{message}</div>}
      {error && <div style={{ color: "#ff9c9c", fontSize: 13, textAlign: "center", marginBottom: 10 }}>{error}</div>}
      <div className="betrow">
        {BETS.map((b) => (
          <button key={b} className={bet === b ? "active" : ""} onClick={() => setBet(b)} disabled={spinning}>
            {b} 칩
          </button>
        ))}
      </div>
      <button className="btn" onClick={spin} disabled={spinning}>
        {spinning ? "돌아가는 중..." : `${bet}칩 베팅하고 당기기`}
      </button>
    </div>
  );
}

function ReportPanel({ session }) {
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!link.trim()) {
      setError("링크를 입력해주세요.");
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
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="title" style={{ fontSize: 20 }}>🕵️ 크리덴셜 제보소</div>
      <form onSubmit={submit}>
        <input className="field" placeholder="링크" value={link} onChange={(e) => setLink(e.target.value)} />
        <textarea
          className="field"
          placeholder="상황 설명 (선택)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && <div style={{ color: "#ff9c9c", fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "제출 중..." : "제보하기"}
        </button>
      </form>
      {result && (
        <div className="hint" style={{ marginTop: 10 }}>
          접수 완료! 감지된 신호: {result.flags?.length ? result.flags.join(", ") : "없음"}
        </div>
      )}
    </div>
  );
}

function QuizPanel({ session, onChipsUpdate }) {
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/quiz/random?userKey=${encodeURIComponent(session.userKey)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.quiz) setQuiz(json.quiz);
      })
      .catch(() => setError("퀴즈를 불러오지 못했습니다."));
  }, []);

  async function submit() {
    if (selected === null) return;
    try {
      const resp = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userKey: session.userKey, quizId: quiz.id, answerIndex: selected }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "제출 실패");
      setResult(json);
      onChipsUpdate(json.chips);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  if (error) return <div style={{ color: "#ff9c9c" }}>{error}</div>;
  if (!quiz) return <div className="empty">퀴즈를 불러오는 중...</div>;

  return (
    <div>
      <div className="title" style={{ fontSize: 20 }}>📚 보안·법무 퀴즈</div>
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 12 }}>{quiz.question}</div>
        {quiz.options.map((opt, i) => (
          <div
            key={i}
            onClick={() => !result && setSelected(i)}
            style={{
              padding: "10px 14px",
              marginBottom: 8,
              borderRadius: 10,
              border: selected === i ? "2px solid #f5f5be" : "1px solid rgba(255,255,255,0.2)",
              cursor: result ? "default" : "pointer",
              background: result && i === result.correctIndex ? "rgba(120,220,150,0.2)" : "rgba(255,255,255,0.05)",
            }}
          >
            {opt}
          </div>
        ))}
        {!result && (
          <button className="btn" onClick={submit} disabled={selected === null}>
            제출하기
          </button>
        )}
        {result && (
          <div className="hint" style={{ marginTop: 10 }}>
            {result.correct ? `정답입니다! +${result.awarded}칩` : "아쉽게 틀렸어요."} {result.explanation}
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_LABEL = {
  closed: "17:30 오픈 예정",
  open: "베팅 접수 중",
  drawn: "오늘 추첨 완료",
  skipped: "오늘 참가자 미달",
  exhausted: "상품 소진 · 종료",
};

function DropZonePanel({ session, onChipsUpdate }) {
  const [zones, setZones] = useState(null);
  const [enteredToday, setEnteredToday] = useState(null);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState(null);
  const [stakeInput, setStakeInput] = useState(10);

  async function load() {
    try {
      const resp = await fetch(`/api/dropzone/status?userKey=${encodeURIComponent(session.userKey)}`);
      const json = await resp.json();
      if (json.ok) {
        setZones(json.zones);
        setEnteredToday(json.enteredToday);
      }
    } catch (e) {
      /* noop */
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function join(prizeKey) {
    setError("");
    setBusyKey(prizeKey);
    try {
      const resp = await fetch("/api/dropzone/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userKey: session.userKey, prizeKey, stake: stakeInput }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "참가 실패");
      onChipsUpdate(json.chips);
      await load();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div>
      <div className="title" style={{ fontSize: 20 }}>🎁 럭키 드롭존</div>
      <div className="hint" style={{ marginTop: -4 }}>
        매일 17:30 오픈 · 17:40(또는 30명) 마감 즉시 추첨 · 하루 1상품만 참가 가능
      </div>
      <div className="hint" style={{ color: "#f5f5be" }}>
        🪙 칩을 많이 모을수록 럭키 드롭존 당첨 확률이 높아져요! (특히 에어팟은 베팅액에 비례)
      </div>

      {error && <div style={{ color: "#ff9c9c", fontSize: 13, margin: "8px 0" }}>{error}</div>}
      {enteredToday && (
        <div className="hint" style={{ color: "#8ee6a6" }}>
          오늘은 이미 참가하셨어요 — 결과가 나오면 팝업으로 알려드릴게요.
        </div>
      )}

      {!zones && <div className="empty">불러오는 중...</div>}

      {zones &&
        zones.map((z) => {
          const canJoin = z.status === "open" && !z.joined && !enteredToday;
          return (
            <div className="card" key={z.key} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <b>{z.label}</b>
                <span className={`tag ${z.status === "open" ? "status-approved" : "status-pending"}`}>
                  {STATUS_LABEL[z.status] || z.status}
                </span>
              </div>
              <div className="hint" style={{ marginBottom: 6 }}>{z.flavor}</div>
              <div className="hint" style={{ marginBottom: 6 }}>
                남은 수량 {z.remaining}/{z.totalStock} · 참가 {z.participantCount}/{z.cap}명
                {z.winnerName ? ` · 당첨: ${z.winnerName}님` : ""}
              </div>

              {z.mode === "chip" && canJoin && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <input
                    className="field"
                    style={{ marginBottom: 0, flex: 1 }}
                    type="number"
                    min={1}
                    max={session.chips ?? 1}
                    value={stakeInput}
                    onChange={(e) => setStakeInput(Number(e.target.value))}
                  />
                  <span className="hint" style={{ margin: 0 }}>칩 베팅</span>
                </div>
              )}

              {z.joined ? (
                <div className="hint" style={{ color: "#8ee6a6" }}>✅ 참가 완료</div>
              ) : canJoin ? (
                <button className="btn secondary" disabled={busyKey === z.key} onClick={() => join(z.key)}>
                  {busyKey === z.key ? "참가 중..." : z.mode === "chip" ? `${stakeInput}칩 베팅하기` : "1칩 참가하기"}
                </button>
              ) : null}
            </div>
          );
        })}
    </div>
  );
}

function LeaderboardPanel() {
  const [list, setList] = useState(null);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((json) => setList(json.leaderboard || []))
      .catch(() => setList([]));
  }, []);

  return (
    <div>
      <div className="title" style={{ fontSize: 20 }}>🏆 리더보드</div>
      {!list && <div className="empty">불러오는 중...</div>}
      {list && (
        <table className="lb">
          <thead>
            <tr>
              <th>순위</th>
              <th>이름</th>
              <th>칩</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u, i) => (
              <tr key={i}>
                <td><span className="rank">{i + 1}</span></td>
                <td>{u.name}</td>
                <td>🪙 {u.chips}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
