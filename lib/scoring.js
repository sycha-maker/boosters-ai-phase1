const STARTER_CHIPS = Number(process.env.STARTER_CHIPS || 10);
const BASE_POINTS = 10;
const POINTS_PER_FLAG = 5;
const MAX_POINTS = 50;

function pointsForSubmission(riskScore) {
  return Math.min(MAX_POINTS, BASE_POINTS + riskScore * POINTS_PER_FLAG);
}

module.exports = { STARTER_CHIPS, pointsForSubmission };
