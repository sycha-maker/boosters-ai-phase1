// 캐릭터 선택지 10종. 실제 아트 에셋이 준비되면 emoji 대신 스프라이트 이미지로 교체하면 됨.
export const CHARACTERS = [
  { id: "duck", emoji: "🦆", label: "오리", color: 0xf5d76e },
  { id: "bear", emoji: "🐻", label: "곰", color: 0xa9744f },
  { id: "rabbit", emoji: "🐰", label: "토끼", color: 0xf2f2f2 },
  { id: "penguin", emoji: "🐧", label: "펭귄", color: 0x3a3a3a },
  { id: "fox", emoji: "🦊", label: "여우", color: 0xe08030 },
  { id: "cat", emoji: "🐱", label: "고양이", color: 0xd9b48f },
  { id: "panda", emoji: "🐼", label: "판다", color: 0x2b2b2b },
  { id: "koala", emoji: "🐨", label: "코알라", color: 0x9aa3ab },
  { id: "tiger", emoji: "🐯", label: "호랑이", color: 0xf0a13c },
  { id: "hamster", emoji: "🐹", label: "햄스터", color: 0xf0c987 },
];

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}
