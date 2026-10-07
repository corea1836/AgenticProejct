#!/bin/bash
# TDD Guard Hook — PreToolUse[Edit|Write]
# 원본: https://github.com/jha0313/ch5-silicon-valley-vibe-coding-technique/blob/main/scripts/hooks/tdd-guard.sh
# frontend/src의 구현 코드를 작성하려 할 때, 같은 폴더에 해당 모듈의 테스트 파일이 먼저 있는지 확인한다.
# 테스트 없이 구현 코드를 작성하려 하면 차단.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# frontend/src 밖의 파일은 검사하지 않는다
case "$FILE_PATH" in
  */frontend/src/*) ;;
  *) exit 0 ;;
esac

FILE_NAME=$(basename "$FILE_PATH")

case "$FILE_NAME" in
  # 테스트 파일 자체를 수정하는 건 허용
  *.test.*|*.spec.*) exit 0 ;;
  # 타입 선언, 엔트리포인트는 테스트 불필요
  *.d.ts|main.tsx) exit 0 ;;
  # App.tsx는 sample-chat.csv로 직접 확인한다 (CLAUDE.md)
  App.tsx) exit 0 ;;
  *.ts|*.tsx|*.js|*.jsx) ;;
  # 스타일 등 나머지 파일은 허용
  *) exit 0 ;;
esac

DIR=$(dirname "$FILE_PATH")
BASENAME=$(echo "$FILE_NAME" | sed -E 's/\.(ts|tsx|js|jsx)$//')

# 테스트는 소스와 같은 폴더에 둔다 (CLAUDE.md)
for EXT in ts tsx js jsx; do
  if [ -f "${DIR}/${BASENAME}.test.${EXT}" ] || [ -f "${DIR}/${BASENAME}.spec.${EXT}" ]; then
    exit 0
  fi
done

REASON="TDD GUARD: '${BASENAME}'에 대한 테스트 파일이 존재하지 않습니다. 구현 코드를 작성하기 전에 테스트를 먼저 작성하세요. (테스트 파일 예: ${BASENAME}.test.ts)"
jq -n --arg reason "$REASON" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $reason
  }
}'
exit 0
