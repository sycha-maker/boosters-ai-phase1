import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { readSession, saveSession } from "../lib/client";

const BETS = [10, 25, 50];

export default function Slot() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [reel, setReel] = useState(["🍒", "🔔", "💎"]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const s = readSession();
    if (!s) {
      router.replace("/");
      return;
    }
    setSession(s);
  }, []);

  async function spin() {
    if (!session || spinning) return;
    if ((session.chips ?? 0) < bet) {
      setError("칩이 부족합니다. 제보를 통해 칩을 모아보세요!");
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

      await new Promise((r) => setTimeout(r, 700));
      setReel(json.reel);
      const updated = { ...session, chips: json.chips };
      setSession(updated);
      saveSession(updated);

      if (json.tier === "jackpot") setMessage(`🎉 잭팟! +${json.payout} 칩 획득!`);
      else if (json.tier === "win") setMessage(`✨ 당첨! +${json.payout} 칩 획득!`);
      else setMessage(`꽝... -${bet} 칩. 다음 기회에!`);
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setSpinning(false);
    }
  }

  if (!session) return null;

  return (
    <div className="page">
      <div className="shell">
        <Link href="/lounge" className="back-link">← 라운지로 돌아가기</Link>
        <div className="title">🎰 슬롯머신</div>
        <div className="subtitle">보유 칩으로 베팅하고 굴려보세요.</div>

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
            <button
              key={b}
              className={bet === b ? "active" : ""}
              onClick={() => setBet(b)}
              disabled={spinning}
            >
              {b} 칩
            </button>
          ))}
        </div>

        <button className="btn" onClick={spin} disabled={spinning}>
          {spinning ? "돌아가는 중..." : `🎲 ${bet}칩 베팅하고 당기기`}
        </button>

        <div className="hint" style={{ marginTop: 14 }}>
          확률 예시(운영 전 조정 가능): 잭팟 5%(5배), 당첨 30%(2배), 꽝 65%
        </div>
      </div>
    </div>
  );
}
