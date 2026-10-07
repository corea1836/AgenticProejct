# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

카카오톡 대화 내보내기 CSV를 올리면 LLM(OpenAI)으로 요약·주요 논의 사항·액션 아이템을 뽑아 주는 프로토타입. 현재는 `frontend/`(React 19 + TypeScript + Vite)만 있고 백엔드는 없다. UI 문구와 코드 주석은 한국어로 작성한다.

## 명령어

모든 npm 명령은 `frontend/`에서 실행한다.

```bash
npm install
npm run dev       # 개발 서버 (루트 .env의 API 키가 주입되는 유일한 모드)
npm run build     # tsc -b(타입 체크) + vite build
npm run lint      # oxlint
npm test          # Vitest 전체 실행
npm run coverage  # 커버리지 리포트 (frontend/coverage/)
npm run preview   # 빌드 결과물 미리보기
```

- 타입 체크만 하려면 `npx tsc -b`.
- 파일 하나만 테스트하려면 `npx vitest run src/chat.test.ts`, 테스트 이름으로 거르려면 `-t '<이름>'`.
- 테스트는 `src/*.test.ts`에 소스와 나란히 둔다. 지금은 `chat.ts`와 `analyze.ts`만 테스트하고, `App.tsx`는 `frontend/public/sample-chat.csv`로 직접 확인한다.

## 아키텍처

데이터 흐름과 모듈 구성은 `architecture.md`에서 관리한다. 아키텍처 관련 내용은 root가 아니라 그 파일에 추가한다.

@architecture.md

## 코드 컨벤션

- TypeScript 설정상 `verbatimModuleSyntax`(타입 import에는 `type` 키워드 필요), `erasableSyntaxOnly`(`enum`, `namespace`, 생성자 parameter property 사용 불가), `noUnusedLocals`/`noUnusedParameters`가 켜져 있다.
- 스타일은 세미콜론 없음, 작은따옴표. 스타일링은 CSS 프레임워크 없이 `src/index.css`의 CSS 변수와 `prefers-color-scheme` 다크 모드로 처리한다.

## API 연동

OpenAI 호출 방식, 프롬프트, 분석 결과 스키마, 환경 변수·API 키 처리는 `api/CLAUDE.md`에서 관리한다. API 관련 내용은 root가 아니라 그 파일에 추가한다.

@api/CLAUDE.md
