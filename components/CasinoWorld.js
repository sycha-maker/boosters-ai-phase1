import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import * as Ably from "ably";
import { ZONES, WORLD } from "../lib/zones";
import { getCharacter } from "../lib/characters";

const CHAT_MAX_LEN = 40;

// 클라이언트 전용 컴포넌트 (pages에서 반드시 { ssr: false }로 dynamic import 할 것).
// Phaser 씬 + Ably 실시간 포지션 동기화를 함께 관리한다.
export default function CasinoWorld({ userKey, name, characterId, onEnterZone, onExitZone }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const channelRef = useRef(null);
  const chatInputRef = useRef(null);
  const composingRef = useRef(false);
  // 채팅창이 열려 있는지를 이펙트 내부(클로저)에서도 항상 최신값으로 읽기 위한 ref.
  // (React state는 클로저 안에서 stale할 수 있어 별도로 동기화한다)
  const chatOpenRef = useRef(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    let ably;
    let channel;
    let destroyed = false;

    class MainScene extends Phaser.Scene {
      constructor() {
        super("main");
        this.insideZone = null;
        this.remoteContainers = new Map();
      }

      create() {
        this.cameras.main.setBackgroundColor("#141821");
        this.add
          .rectangle(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 0x1c2230)
          .setStrokeStyle(2, 0x333c4d);

        this.zoneRects = {};
        ZONES.forEach((z) => {
          const rect = this.add.rectangle(z.x + z.w / 2, z.y + z.h / 2, z.w, z.h, z.color, 0.22);
          rect.setStrokeStyle(2, z.color, 0.9);
          this.add
            .text(z.x + z.w / 2, z.y + z.h / 2, z.label, {
              fontSize: "14px",
              color: "#ffffff",
              align: "center",
              wordWrap: { width: z.w - 16 },
            })
            .setOrigin(0.5);
          this.zoneRects[z.id] = new Phaser.Geom.Rectangle(z.x, z.y, z.w, z.h);
        });

        const char = getCharacter(characterId);
        this.player = this.add.container(WORLD.width / 2, WORLD.height / 2 + 150);
        const circle = this.add.circle(0, 0, 18, char.color);
        circle.setStrokeStyle(2, 0xffffff, 0.85);
        const emoji = this.add.text(0, 0, char.emoji, { fontSize: "20px" }).setOrigin(0.5);
        const label = this.add
          .text(0, -30, name, {
            fontSize: "12px",
            color: "#ffffff",
            backgroundColor: "#00000088",
            padding: { x: 4, y: 2 },
          })
          .setOrigin(0.5);
        this.player.add([circle, emoji, label]);

        this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
        this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({ up: "W", down: "S", left: "A", right: "D" });

        // "/" 키로 채팅창을 열 때 그 "/"자가 그대로 게임 입력으로 처리되지 않도록 차단
        this.input.keyboard.addCapture("/");

        this.lastSent = 0;
        this.lastPos = { x: this.player.x, y: this.player.y };
      }

      addOrUpdateRemote(id, data) {
        let entry = this.remoteContainers.get(id);
        const char = getCharacter(data.characterId);
        if (!entry) {
          const container = this.add.container(data.x, data.y);
          const circle = this.add.circle(0, 0, 18, char.color, 1);
          circle.setStrokeStyle(2, 0xffffff, 0.6);
          const emoji = this.add.text(0, 0, char.emoji, { fontSize: "20px" }).setOrigin(0.5);
          const label = this.add
            .text(0, -30, data.name || "guest", {
              fontSize: "12px",
              color: "#ffffff",
              backgroundColor: "#00000088",
              padding: { x: 4, y: 2 },
            })
            .setOrigin(0.5);
          container.add([circle, emoji, label]);
          entry = { container, targetX: data.x, targetY: data.y };
          this.remoteContainers.set(id, entry);
        } else {
          entry.targetX = data.x;
          entry.targetY = data.y;
        }
      }

      removeRemote(id) {
        const entry = this.remoteContainers.get(id);
        if (entry) {
          entry.container.destroy();
          this.remoteContainers.delete(id);
        }
      }

      // 말풍선 채팅: id가 본인이면 this.player 위에, 아니면 해당 원격 플레이어 컨테이너 위에 표시
      showBubble(id, text) {
        const target = id === userKey ? this.player : this.remoteContainers.get(id)?.container;
        if (!target || !text) return;
        if (target.bubble) {
          target.bubble.destroy();
          target.bubble = null;
        }
        const clipped = text.length > CHAT_MAX_LEN ? `${text.slice(0, CHAT_MAX_LEN)}…` : text;
        const bubbleText = this.add
          .text(0, 0, clipped, {
            fontSize: "13px",
            color: "#1a1a1a",
            backgroundColor: "#f5f5be",
            padding: { x: 8, y: 5 },
            wordWrap: { width: 170 },
            align: "center",
          })
          .setOrigin(0.5, 1);
        const bubble = this.add.container(0, -46, [bubbleText]);
        target.add(bubble);
        target.bubble = bubble;
        this.time.delayedCall(4000, () => {
          if (target.bubble === bubble) {
            bubble.destroy();
            target.bubble = null;
          }
        });
      }

      update(time, delta) {
        // 루프 안에서 어떤 예외가 나더라도(원격 플레이어 데이터 이슈 등) 다음 프레임의
        // 키보드 입력 처리가 영구히 멈추지 않도록 방어적으로 감싼다.
        try {
          this.stepUpdate(time, delta);
        } catch (err) {
          if (!this._loggedUpdateError) {
            console.error("[world] update() error (movement should keep working):", err);
            this._loggedUpdateError = true;
          }
        }
      }

      stepUpdate(time, delta) {
        if (!this.player) return;
        const speed = 220 * (delta / 1000);
        let dx = 0;
        let dy = 0;
        // 채팅창이 열려 있을 때는 방향키 입력을 이동에 쓰지 않는다.
        if (!chatOpenRef.current) {
          if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= 1;
          if (this.cursors.right.isDown || this.wasd.right.isDown) dx += 1;
          if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= 1;
          if (this.cursors.down.isDown || this.wasd.down.isDown) dy += 1;
        }

        if (dx !== 0 || dy !== 0) {
          const len = Math.hypot(dx, dy) || 1;
          this.player.x = Phaser.Math.Clamp(this.player.x + (dx / len) * speed, 20, WORLD.width - 20);
          this.player.y = Phaser.Math.Clamp(this.player.y + (dy / len) * speed, 20, WORLD.height - 20);
        }

        let currentZone = null;
        for (const z of ZONES) {
          if (Phaser.Geom.Rectangle.Contains(this.zoneRects[z.id], this.player.x, this.player.y)) {
            currentZone = z;
            break;
          }
        }
        const currentId = currentZone ? currentZone.id : null;
        if (currentId !== this.insideZone) {
          if (this.insideZone && onExitZone) onExitZone(this.insideZone);
          if (currentZone && onEnterZone) onEnterZone(currentZone);
          this.insideZone = currentId;
        }

        if (time - this.lastSent > 120) {
          const moved = Math.hypot(this.player.x - this.lastPos.x, this.player.y - this.lastPos.y) > 1;
          if (moved && channel) {
            channel.publish("pos", { id: userKey, x: this.player.x, y: this.player.y, name, characterId });
            this.lastPos = { x: this.player.x, y: this.player.y };
          }
          this.lastSent = time;
        }

        this.remoteContainers.forEach((entry) => {
          entry.container.x = Phaser.Math.Linear(entry.container.x, entry.targetX, 0.25);
          entry.container.y = Phaser.Math.Linear(entry.container.y, entry.targetY, 0.25);
        });
      }
    }

    const config = {
      type: Phaser.AUTO,
      width: WORLD.width,
      height: WORLD.height,
      parent: containerRef.current,
      backgroundColor: "#141821",
      scene: MainScene,
      // 탭을 전환했다 돌아와도 게임 루프가 멈추지 않도록 (일부 브라우저에서
      // 캔버스 포커스/가시성 변화 후 키보드 입력이 안 먹는 문제 방지)
      disableVisibilityChange: true,
      input: {
        keyboard: { target: window },
      },
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    // 캔버스가 포커스를 잃어도 다시 클릭하면 확실히 포커스를 되찾도록 처리
    const focusCanvas = () => {
      if (containerRef.current) containerRef.current.setAttribute("tabindex", "0");
      game.canvas?.focus?.();
    };
    game.events.once(Phaser.Core.Events.READY, focusCanvas);
    containerRef.current.addEventListener("click", focusCanvas);
    window.addEventListener("focus", focusCanvas);

    // "/" 키를 누르면 채팅창을 연다 (슬래시 커맨드처럼). 이미 열려 있으면 무시.
    const openChatOnSlash = (e) => {
      if (chatOpenRef.current) return;
      if (e.key !== "/") return;
      e.preventDefault();
      chatOpenRef.current = true;
      setChatOpen(true);
    };
    window.addEventListener("keydown", openChatOnSlash);

    try {
      ably = new Ably.Realtime({
        authUrl: `/api/ably-auth?clientId=${encodeURIComponent(userKey)}`,
      });
      channel = ably.channels.get("casino-world");
      channelRef.current = channel;

      channel.subscribe("pos", (msg) => {
        if (destroyed) return;
        const data = msg.data;
        if (!data || data.id === userKey) return;
        const scene = game.scene.getScene("main");
        if (scene) scene.addOrUpdateRemote(data.id, data);
      });

      channel.subscribe("chat", (msg) => {
        if (destroyed) return;
        const data = msg.data;
        if (!data || data.id === userKey) return;
        const scene = game.scene.getScene("main");
        if (!scene) return;
        // 아직 pos 메시지를 한 번도 못 받은 상대(이동이 안 되거나 막 접속한 경우)여도
        // 말풍선이 보이도록, 없으면 임시 위치에 캐릭터를 먼저 만들어둔다.
        if (!scene.remoteContainers.has(data.id)) {
          scene.addOrUpdateRemote(data.id, {
            x: WORLD.width / 2,
            y: WORLD.height / 2 + 80,
            name: data.name,
            characterId: data.characterId,
          });
        }
        scene.showBubble(data.id, data.text);
      });

      channel.presence.subscribe("leave", (member) => {
        const scene = game.scene.getScene("main");
        if (scene) scene.removeRemote(member.clientId);
      });

      channel.presence.enter({ name, characterId }).catch((e) => console.error("presence enter failed", e));
    } catch (e) {
      console.error("Ably init failed", e);
    }

    return () => {
      destroyed = true;
      window.removeEventListener("keydown", openChatOnSlash);
      window.removeEventListener("focus", focusCanvas);
      try {
        channel?.presence.leave();
        ably?.close();
      } catch (e) {
        /* noop */
      }
      game.destroy(true);
      gameRef.current = null;
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 채팅창이 새로 열리면 입력창에 자동 포커스
  useEffect(() => {
    if (chatOpen) {
      const raf = requestAnimationFrame(() => chatInputRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
  }, [chatOpen]);

  const closeChat = () => {
    chatOpenRef.current = false;
    setChatOpen(false);
    setChatText("");
    // 채팅창을 닫는 즉시 캔버스로 포커스를 돌려줘서 화살표 키가 바로 다시 먹도록 함
    requestAnimationFrame(() => gameRef.current?.canvas?.focus());
  };

  const sendChat = () => {
    // 한글 IME 조합 중 Enter로 조합을 확정하는 시점과 React state 업데이트 타이밍이
    // 어긋나면 일부 글자만 전송되는 문제가 있어, 전송 시점엔 state가 아니라
    // 실제 DOM input의 값을 그대로 읽어 사용한다 (항상 화면에 보이는 그대로 전송됨).
    const raw = chatInputRef.current ? chatInputRef.current.value : chatText;
    const text = raw.trim();
    if (text) {
      const scene = gameRef.current?.scene?.getScene("main");
      if (scene) scene.showBubble(userKey, text);
      try {
        channelRef.current?.publish("chat", { id: userKey, text, name, characterId });
      } catch (e) {
        /* noop */
      }
    }
    closeChat();
  };

  return (
    <div>
      <div style={{ position: "relative" }}>
        <div
          ref={containerRef}
          style={{
            width: WORLD.width,
            maxWidth: "100%",
            aspectRatio: `${WORLD.width} / ${WORLD.height}`,
            margin: "0 auto",
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        />
        {chatOpen && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 16,
              transform: "translateX(-50%)",
              width: "88%",
              maxWidth: 420,
              display: "flex",
              gap: 8,
              background: "rgba(10,12,16,0.92)",
              border: "1px solid rgba(245,245,190,0.5)",
              borderRadius: 10,
              padding: 8,
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            <input
              ref={chatInputRef}
              className="field"
              style={{ marginBottom: 0, flex: 1 }}
              placeholder="메시지 입력 후 Enter (Esc 취소)"
              maxLength={CHAT_MAX_LEN}
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onCompositionStart={() => {
                composingRef.current = true;
              }}
              onCompositionEnd={() => {
                composingRef.current = false;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // 한글/일본어 등 IME로 글자를 조합 중일 때 누른 Enter는 조합 확정용이므로
                  // 여기서 바로 전송하면 안 됨 (마지막 글자만 전송되는 버그의 원인).
                  if (composingRef.current || e.nativeEvent?.isComposing) return;
                  e.preventDefault();
                  sendChat();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  closeChat();
                }
              }}
            />
            <button
              className="btn secondary"
              style={{ width: "auto", padding: "0 16px" }}
              onClick={sendChat}
              type="button"
            >
              전송
            </button>
          </div>
        )}
      </div>
      <div className="hint" style={{ marginTop: 10, textAlign: "center" }}>
        <b>/</b> 키를 누르면 말풍선 채팅창이 열려요 (Enter 전송 · Esc 취소)
      </div>
    </div>
  );
}
