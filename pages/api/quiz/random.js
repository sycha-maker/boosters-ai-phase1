import { readData } from "../../../lib/db";
import { getRandomQuiz } from "../../../lib/quizData";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });
  const { userKey } = req.query;
  try {
    let answered = [];
    if (userKey) {
      const data = await readData();
      answered = (data.users[userKey] && data.users[userKey].answeredQuizzes) || [];
    }
    const quiz = getRandomQuiz(answered);
    // 정답 인덱스는 절대 클라이언트로 내려주지 않음
    const { correctIndex, ...safeQuiz } = quiz;
    res.status(200).json({ ok: true, quiz: safeQuiz, allAnswered: answered.length >= 10 });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
