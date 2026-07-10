import { useEffect, useRef } from "react";
import Phaser from "phaser";
import * as Ably from "ably";
import { ZONES, WORLD } from "../lib/zones";
import { getCharacter } from "../lib/characters";

// 클라이언트 전용 컴포넌트 (pages에서 반드시 { ssr: false }로 dynamic import 할 것).
// Phaser 씬 + Ably 실시간 포지션 동기화를 함께 관리한다.
export default function CasinoWorld({ userKey, name, characterId, onEnterZone, onExitZone }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

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

      update(time, delta) {
        if (!this.player) return;
        const speed = 220 * (delta / 1000);
        let dx = 0;
        let dy = 0;
        if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= 1;
        if (this.cursors.right.isDown || this.wasd.right.isDown) dx += 1;
        if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= 1;
        if (this.cursors.down.isDown || this.wasd.down.isDown) dy += 1;

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
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    try {
      ably = new Ably.Realtime({
        authUrl: `/api/ably-auth?clientId=${encodeURIComponent(userKey)}`,
      });
      channel = ably.channels.get("casino-world");

      channel.subscribe("pos", (msg) => {
        if (destroyed) return;
        const data = msg.data;
        if (!data || data.id === userKey) return;
        const scene = game.scene.getScene("main");
        if (scene) scene.addOrUpdateRemote(data.id, data);
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
      try {
        channel?.presence.leave();
        ably?.close();
      } catch (e) {
        /* noop */
      }
      game.destroy(true);
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
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
  );
}
