# 아키텍처

현재는 `frontend/`만 있고 백엔드는 없다. 아래 파일 경로는 `frontend/src/` 기준이다.

## 데이터 흐름

1. `chat.ts` `parseKakaoCsv` — PapaParse로 CSV 파싱. `Date, User, Message` 헤더가 없으면 에러. "사진", "이모티콘", "메시지가 삭제되었습니다." 같은 내용 없는 메시지는 `NOISE` 정규식으로 제거한다.
2. `chat.ts` `filterRecentDays` — 기간 필터는 **오늘이 아니라 마지막 메시지 시점** 기준이다.
3. `chat.ts` `toTranscript` — 토큰 절약을 위해 `[YYYY-MM-DD HH:MM] 이름: 메시지` 한 줄 형식으로 압축(메시지 내 줄바꿈은 공백으로 치환).
4. `analyze.ts` `analyzeChat` — 브라우저에서 OpenAI API를 직접 호출해 분석 결과 JSON을 받는다. 자세한 내용은 `api/CLAUDE.md`.
5. `App.tsx` — 단일 컴포넌트에서 상태 관리와 렌더링을 모두 담당.
