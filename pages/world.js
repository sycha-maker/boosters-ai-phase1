import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import { readSession, saveSession } from "../lib/client";
import { CHARACTERS } from "../lib/characters";
import ZoneModal from "../components/ZoneModal";

const CasinoWorld = dynamic(() => import("../components/CasinoWorld"), { ssr: false });

export default function World() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [characterId, setCharacterId] = useState(null);
  const [activeZone, setActiveZone] = useState(null);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    const s = readSession();
    if (!s) {
      router.replace("/");
      return;
    }
    setSession(s);
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

  const handleEnter = useCallback((zone) => {
    setActiveZone(zone);
  }, []);
  const handleExit = useCallback(() => {
    setActiveZone(null);
    setModal(null);
  }, []);
  const handleChipsUpdate = useCallback(
    (chips) => {
      setSession((prev) => {
        const updated = { ...prev, chips };
        saveSession(updated);
        return updated;
      });
    },
    []
  );

  if (!session) return null;

  if (!characterId) {
    return (
      <div className="page">
        <div className="shell">
          <Link href="/lounge" className="back-link">← 라운지로 돌아가기</Link>
          <div className="title">🧭 캐릭터를 선택하세요</div>
          <div className="subtitle">방향키 또는 WASD로 라운지를 돌아다니고, 부스에 가까이 가면 자동으로 참여할 수 있어요.</div>
          <div className="floor" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
            {CHARACTERS.map((c) => (
              <button
                key={c.id}
                className="station"
                style={{ cursor: "pointer", border: "1px solid rgba(255,255,255,0.14)" }}
                onClick={() => setCharacterId(c.id)}
              >
                <div className="emoji">{c.emoji}</div>
                <div className="label">{c.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="shell" style={{ maxWidth: 1000 }}>
        <Link href="/lounge" className="back-link">← 라운지로 돌아가기</Link>
        <div className="chipbar">
          <span className="name">{session.name}님</span>
          <span className="chips">🪙 {session.chips ?? 0}</span>
        </div>

        <CasinoWorld
          userKey={session.userKey}
          name={session.name}
          characterId={characterId}
          onEnterZone={handleEnter}
          onExitZone={handleExit}
        />

        {activeZone && !modal && (
          <div className="card" style={{ marginTop: 12, textAlign: "center" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{activeZone.label}에 도착했어요</div>
            <button className="btn secondary" style={{ width: "auto", padding: "10px 24px" }} onClick={() => setModal(activeZone.type)}>
              참여하기
            </button>
          </div>
        )}

        <div className="hint" style={{ marginTop: 14, textAlign: "center" }}>
          방향키/WASD로 이동 · 부스 근처에 서면 참여 버튼이 나타나요 · 다른 크루들도 실시간으로 보여요
        </div>
      </div>

      {modal && (
        <ZoneModal type={modal} session={session} onClose={() => setModal(null)} onChipsUpdate={handleChipsUpdate} />
      )}
    </div>
  );
}
