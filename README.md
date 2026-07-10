# 크리덴셜 카지노 (MVP)

boosters AX Phase 1.5 보안 캠페인용 게이미피케이션 MVP입니다. 2D 라운지 UI에서 방치된 크리덴셜을 제보하고, 승인되면 칩을 받아 슬롯머신 미니게임으로 굴릴 수 있습니다.

## 구성

- `pages/index.js` — 입장(이름/팀 입력, 데모용 로그인)
- `pages/lounge.js` — 카지노 라운지 메인
- `pages/report.js` — 크리덴셜 제보 폼
- `pages/slot.js` — 슬롯머신 미니게임
- `pages/leaderboard.js` — 리더보드
- `pages/admin.js` — 관리자 검수 큐 (패스코드 보호)
- `pages/api/slack/command.js` — 슬랙 슬래시 커맨드(`/제보`) 수신 엔드포인트
- `lib/db.js` — GitHub Contents API를 백엔드로 쓰는 초경량 데이터스토어 (`data/db.json`)
- `lib/keywordFilter.js` — PII/리스크 1차 자동 필터 (참고용, 최종 승인은 관리자 수동)

## 로컬 실행

```bash
npm install
npm run dev
```

## 환경변수

Vercel 프로젝트 설정 > Environment Variables 에 아래 값을 등록하세요.

| 변수명 | 설명 | 예시 |
|---|---|---|
| `GH_TOKEN` | 이 저장소에 쓰기 권한이 있는 GitHub 토큰 (데이터 저장용) | 기존 배포 스크립트에 쓰던 토큰 재사용 가능 |
| `GH_OWNER` | GitHub 계정/조직명 | `sycha-maker` |
| `GH_REPO` | 저장소명 | `boosters-ai-phase1` |
| `GH_BRANCH` | 데이터를 커밋할 브랜치 | `credential-casino-mvp` |
| `DATA_PATH` | 데이터 파일 경로 (기본값 사용 권장) | `data/db.json` |
| `ADMIN_PASSCODE` | 관리자 검수 페이지 패스코드 (직접 정하기) | `boosters-2026` 등 원하는 값 |
| `STARTER_CHIPS` | 최초 입장 시 지급할 칩 (선택, 기본 10) | `10` |
| `SLACK_SIGNING_SECRET` | 슬랙 앱 생성 후 발급되는 Signing Secret (선택) | 나중에 추가 |

## Vercel 배포 (수동 3단계)

이 코드는 GitHub `sycha-maker/boosters-ai-phase1` 저장소의 `credential-casino-mvp` 브랜치에 푸시되어 있습니다.

1. https://vercel.com/new 접속 → "Import Git Repository" → `boosters-ai-phase1` 선택
2. Branch를 `credential-casino-mvp`로 지정 (Root Directory는 기본값 그대로)
3. 위 표의 환경변수를 등록하고 Deploy 클릭 (첫 배포 후 환경변수를 추가/수정했다면 Redeploy 한 번 더 필요)

배포가 끝나면 발급되는 `*.vercel.app` 주소를 공유해주시면, 제보→승인→포인트지급→슬롯게임→리더보드 흐름을 함께 점검해드릴 수 있습니다.

## 슬랙 `/제보` 명령 연동 (선택, 나중에)

1. https://api.slack.com/apps 에서 새 앱 생성 (또는 기존 앱에 기능 추가)
2. **Slash Commands** 메뉴에서 `/제보` 명령 생성, Request URL을 `https://<배포도메인>/api/slack/command` 로 지정
3. **Basic Information > App Credentials** 에서 Signing Secret을 복사해 Vercel 환경변수 `SLACK_SIGNING_SECRET`에 등록 후 재배포
4. 워크스페이스에 앱 설치 → 아카이빙 채널에서 `/제보 <링크> 설명` 형태로 바로 제보 가능

Signing Secret을 등록하기 전에는 요청 서명 검증을 생략하는 데모 모드로 동작합니다(내부 테스트용으로만 사용 권장).

## 알려진 한계 (MVP 범위)

- **로그인**: 이름/팀 입력 방식의 임시 로그인입니다. 실제 운영 전 사내 Google/Slack SSO 연동이 필요합니다.
- **데이터 저장**: 별도 DB 없이 GitHub 저장소의 JSON 파일을 데이터스토어로 사용합니다. 소규모 파일럿에는 충분하지만, 참여 인원이 늘어나면 Vercel Postgres/Supabase 등 실제 DB로 교체를 권장합니다.
- **키워드 필터**: 정규식 기반 1차 필터로, 오탐/누락이 있을 수 있어 관리자 수동 승인이 최종 게이트입니다.
- **실물 상품 지급**: 시스템 밖에서 별도 운영(리더보드 상위/목표 칩 달성자 수동 확인 후 지급)이 필요합니다.
