import { withData } from "../../../lib/db";
import { getQuizById } from "../../../lib/quizData";

const QUIZ_REWARD = 8;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const { userKey, quizId, answerIndex } = req.body || {};
  if (!userKey || !quizId || answerIndex === undefined) {
    return res.status(400).json({ error: "userKey, quizId, answerIndex required" });
  }
  const quiz = getQuizById(quizId);
  if (!quiz) return res.status(404).json({ error: "quiz not found" });

  const correct = Number(answerIndex) === quiz.correctIndex;

  try {
    let chips = null;
    let alreadyAnswered = false;
    await withData((data) => {
      const user = data.users[userKey];
      if (!user) throw Object.assign(new Error("user not found"), { status: 404 });
      user.answeredQuizzes = user.answeredQuizzes || [];
      if (user.answeredQuizzes.includes(quizId)) {
        alreadyAnswered = true;
        chips = user.chips;
        return null;
      }
      user.answeredQuizzes.push(quizId);
      if (correct) {
        user.points = (user.points || 0) + QUIZ_REWARD;
        user.chips = (user.chips || 0) + QUIZ_REWARD;
      }
      chips = user.chips;
      return null;
    }, `quiz answer: ${userKey} ${quizId} ${correct ? "correct" : "wrong"}`);

    res.status(200).json({
      ok: true,
      correct,
      alreadyAnswered,
      correctIndex: quiz.correctIndex,
      explanation: quiz.explanation,
      awarded: correct && !alreadyAnswered ? QUIZ_REWARD : 0,
      chips,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: String(e.message || e) });
  }
}
