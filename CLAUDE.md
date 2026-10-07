# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

카카오톡 대화 내보내기 CSV를 올리면 LLM(OpenAI)으로 요약·주요 논의 사항·액션 아이템을 뽑아 주는 프로토타입. 현재는 `frontend/`(React 19 + TypeScript + Vite)만 있고 백엔드는 없다. UI 문구와 코드 주석은 한국어로 작성한다.

## 명령어

모든 npm 명령은 `frontend/`에서 실행한다.

```bash
npm install
npm run dev       # 개발 서버 (루트 .env의 API 키가 주입되는 유일한 모드)
npm run dev:mock  # API를 호출하지 않고 예시 결과를 보여주는 개발 서버 (키·크레딧 불필요)
npm run build     # tsc -b(타입 체크) + vite build
npm run lint      # oxlint
npm test          # Vitest 전체 실행
npm run check     # tsc -b + oxlint + vitest run. 커밋 전에 실행
npm run coverage  # 커버리지 리포트 (frontend/coverage/)
npm run preview   # 빌드 결과물 미리보기
npm run chat -- <csv> [--days 30|all] [--me 이름] [--prompt] [--live]  # CSV 통계·프롬프트·실제 분석
```

- 타입 체크만 하려면 `npx tsc -b`.
- 파일 하나만 테스트하려면 `npx vitest run src/chat.test.ts`, 테스트 이름으로 거르려면 `-t '<이름>'`.
- 테스트는 `src/*.test.ts`에 소스와 나란히 둔다. 지금은 `chat.ts`, `analyze.ts`, `upload.ts`만 테스트하고, `App.tsx`는 `npm run dev:mock`으로 띄워 `frontend/public/sample-chat.csv`로 직접 확인한다.
- TDD 가드: `frontend/src`의 `.ts`/`.tsx` 파일은 같은 폴더에 `<이름>.test.ts`가 없으면 PreToolUse 훅(`.claude/hooks/tdd-guard.sh`)이 Edit/Write를 막는다. 새 모듈은 테스트 파일부터 만든다. `App.tsx`, `main.tsx`, `*.d.ts`는 예외.
- `frontend/scripts/chat-cli.ts`는 `src/chat.ts`와 `src/analyze.ts`의 함수를 그대로 import해 Node로 바로 실행한다. CSV를 확인하거나 프롬프트를 볼 때 일회성 스크립트를 새로 짜지 말고 이걸 쓴다. 타입 체크는 `tsconfig.scripts.json`(DOM lib + Node 타입)이 맡는다.
- `npm run chat -- ... --live`는 비용이 들고 대화 내용을 OpenAI로 보내므로 사용자가 요청할 때만 실행한다.

## 아키텍처

데이터 흐름과 모듈 구성은 `architecture.md`에서 관리한다. 아키텍처 관련 내용은 root가 아니라 그 파일에 추가한다.

@architecture.md

## 코드 컨벤션

- TypeScript 설정상 `verbatimModuleSyntax`(타입 import에는 `type` 키워드 필요), `erasableSyntaxOnly`(`enum`, `namespace`, 생성자 parameter property 사용 불가), `noUnusedLocals`/`noUnusedParameters`가 켜져 있다.
- 스타일은 세미콜론 없음, 작은따옴표. 스타일링은 CSS 프레임워크 없이 `src/index.css`의 CSS 변수와 `prefers-color-scheme` 다크 모드로 처리한다.

## Git과 동시 작업

- 커밋은 main에 직접 하고 바로 push한다. 브랜치를 새로 만들지 않는다. 절차(검사, 메시지 형식, push 방식)는 `/commit` 스킬(`.claude/skills/commit/SKILL.md`)을 따른다.
- 세션을 여러 개 동시에 돌릴 때는 `claude -w <이름>`으로 연다. 그러면 `.claude/worktrees/<이름>`에 별도 worktree가 생겨 브랜치 전환과 파일 충돌이 서로에게 번지지 않는다. worktree의 커밋은 `git rebase origin/main` 후 `git push origin HEAD:main`으로 main에 올린다.
- 새 worktree에는 `node_modules`가 없으므로 `cd frontend && npm install`부터 한다. 루트 `.env`는 `.worktreeinclude`에 적혀 있어 자동으로 복사된다.

## API 연동

OpenAI 호출 방식, 프롬프트, 분석 결과 스키마, 환경 변수·API 키 처리는 `api/CLAUDE.md`에서 관리한다. API 관련 내용은 root가 아니라 그 파일에 추가한다.

@api/CLAUDE.md
