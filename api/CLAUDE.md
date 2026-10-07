# API 연동 (OpenAI)

이 문서의 경로는 저장소 루트 기준이다. 현재 API 연동 코드는 `frontend/src/analyze.ts`에 있다. 백엔드 없이 브라우저에서 OpenAI Chat Completions API를 직접 호출하는 프로토타입 전용 구조다.

## 호출 방식

`analyzeChat(transcript, { apiKey, model, me })`가 `buildPrompt`로 프롬프트를 만들고, Structured Outputs(`response_format: json_schema`, `strict: true`)로 호출해 `Analysis` 형태의 JSON을 돌려준다.

- **mock 모드**: `npm run dev:mock`(`vite --mode mock`)으로 띄우면 `App.tsx`가 `import.meta.env.MODE === 'mock'`을 보고 `analyzeChat` 대신 `mockAnalyzeChat(transcript, { me })`를 부른다. API를 호출하지 않고 transcript의 참여자와 날짜로 예시 결과를 만든다. 담당자·기한이 있는 항목과 없는(null) 항목을 모두 넣어 화면 분기를 확인할 수 있게 한다.

## 프롬프트와 입력 형식

- `transcript`는 `frontend/src/chat.ts`의 `toTranscript`가 만든 `[YYYY-MM-DD HH:MM] 이름: 메시지` 형식이고, 프롬프트 첫 줄이 이 형식을 설명한다. 둘 중 하나를 바꾸면 다른 쪽도 같이 바꾼다.
- "내일" 같은 상대적인 기한은 각 줄의 메시지 날짜를 기준으로 실제 날짜로 바꾸게 지시한다. 그러므로 대화 기록에서 날짜를 빼면 안 된다.
- `me`는 UI의 "내 이름"에서 고른 참여자 이름(`getParticipants` 결과 중 하나)이다. 값이 있으면 그 사람이 할 일 위주로 뽑으라는 지시가 프롬프트에 추가된다.

## 분석 결과 스키마

`Analysis`, `ActionItem` 타입과 `ANALYSIS_SCHEMA`는 손으로 맞춰야 한다. strict 모드 규칙상 모든 필드가 `required`에 있어야 하고 `additionalProperties: false`여야 하며, 값이 없을 수 있는 필드는 `type: ['string', 'null']`로 표현한다. 필드를 바꾸면 결과를 그리는 `frontend/src/App.tsx`와 `mockAnalyzeChat`도 함께 수정한다. `frontend/src/analyze.test.ts`가 strict 규칙과, 타입과 스키마의 필드 일치를 검사한다.

## 환경 변수와 API 키

- `.env`는 `frontend/`가 아니라 **저장소 루트**에 둔다(`.env.example` 참고). `frontend/vite.config.ts`가 `loadEnv(mode, '..', 'OPENAI_')`로 읽으므로 접두사는 `VITE_`가 아니라 `OPENAI_`다.
- 값은 Vite `define`으로 `import.meta.env.OPENAI_API_KEY` / `OPENAI_MODEL`에 들어간다. API 키는 `npm run dev`(`command === 'serve'`이고 `mode === 'development'`)일 때만 주입된다. 빌드 결과물, mock 모드, 테스트에는 들어가지 않는다. Vitest도 설정을 `command: 'serve'`로 읽기 때문에(mode는 `'test'`) 모드까지 확인해야 한다. `analyze.test.ts`가 테스트에 키가 없는지 검사하며, 실패해도 키 값이 아니라 길이만 출력한다. 키가 없으면 UI에서 입력받아 `localStorage`(`openai-api-key`)에 저장한다.
- 환경 변수를 추가할 때는 `frontend/vite.config.ts`의 `define`과 `frontend/src/vite-env.d.ts`의 `ImportMetaEnv`를 함께 수정한다.
