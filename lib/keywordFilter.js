// 1차 자동 필터: 제보 텍스트/링크에서 개인정보·사내 리스크 신호를 정규식으로 스캔합니다.
// 여기서 나온 결과는 "참고용 힌트"이며, 최종 인정 여부는 관리자 수동 승인으로 확정합니다.

const RULES = [
  { label: "주민등록번호 패턴", re: /\d{6}\s?[-]?\s?[1-4]\d{6}/ },
  { label: "휴대폰 번호", re: /01[016789]\s?[-.]?\s?\d{3,4}\s?[-.]?\s?\d{4}/ },
  { label: "이메일 주소", re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ },
  { label: "카드/계좌번호 패턴", re: /\d{3,6}[-\s]\d{2,6}[-\s]\d{2,6}(?:[-\s]\d{2,6})?/ },
  { label: "비밀번호/시크릿 노출", re: /(비밀번호|패스워드|password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]/i },
  { label: "노션/드라이브 공유 링크", re: /(notion\.so|notion\.site|docs\.google\.com|drive\.google\.com)/i },
  { label: "슬랙 파일/메시지 링크", re: /slack\.com\/(archives|files)/i },
  { label: "주소 정보 추정", re: /(로|길)\s?\d+(-\d+)?/ },
];

function scanText(text) {
  const t = text || "";
  const flags = [];
  for (const rule of RULES) {
    if (rule.re.test(t)) flags.push(rule.label);
  }
  // 링크가 있고 PII 신호가 하나라도 있으면 위험도 가중
  const riskScore = flags.length;
  return { flags, riskScore };
}

module.exports = { scanText };
