---
name: commit
description: 이 저장소의 변경 사항을 검사하고 main에 커밋·push한다. 사용자가 "커밋해줘", "commit and push", "푸시해줘"처럼 커밋이나 push를 요청할 때 사용한다.
---

# 커밋과 push

이 저장소는 **main에 직접 커밋하고 바로 push한다.** 새 브랜치를 만들거나 PR을 열지 않는다. 같은 폴더에서 다른 세션이 동시에 작업할 수 있으므로, 매번 위치와 변경 내용을 다시 확인한다.

## 1. 위치 확인

```bash
git branch --show-current
git worktree list
```

- 기본 작업 폴더이고 브랜치가 `main`이면 main에 커밋한다.
- `.claude/worktrees/` 안이면(`claude -w`로 연 세션) 그 worktree 브랜치에 커밋하고, 4단계의 worktree 방식으로 main에 push한다.
- 기본 작업 폴더인데 `main`이 아니면 다른 세션이 브랜치를 바꿨을 수 있다. 멈추고 사용자에게 묻는다.

## 2. 변경 확인

```bash
git status --short
git diff --stat
```

이번 작업과 관계없어 보이는 변경(다른 세션의 작업일 수 있음)이 섞여 있으면, 목록을 보여 주고 포함할지 묻는다. 성격이 다른 변경은 커밋을 나눈다(예: 기능 추가와 훅 추가).

## 3. 검사 (하나라도 실패하면 커밋하지 않는다)

```bash
cd frontend && npm run check   # tsc -b + oxlint + vitest run
```

스테이징한 뒤 시크릿을 확인한다.

```bash
git diff --cached --name-only | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$'   # 출력이 있으면 중단
git diff --cached | grep -nE 'sk-[A-Za-z0-9_-]{20,}'                                    # 출력이 있으면 중단
```

## 4. 커밋과 push

메시지 형식은 기존 이력(`git log -3`)을 따른다.

```
<한국어 제목: "~ 추가", "~ 수정"처럼 명사형, 마침표 없음>

- <무엇을, 왜 바꿨는지 한 줄씩>
- ...

<harness가 지정한 Co-Authored-By 줄>
```

```bash
git commit -F - <<'EOF'
...
EOF
```

push 방식은 위치에 따라 다르다.

- **main**: `git fetch origin`으로 확인해 원격이 앞서 있으면 `git pull --rebase origin main`을 먼저 하고, `git push origin main`
- **worktree**: `git fetch origin && git rebase origin/main && git push origin HEAD:main`. worktree 브랜치 자체는 원격에 push하지 않는다.

rebase 충돌이 나면 직접 해결하지 말고 멈춘 뒤 상황을 보고한다.

## 5. 막혔을 때

`.claude/` 아래 파일을 커밋하다가 auto mode에서 차단되면(Self-Modification), 다른 방법으로 우회하지 않는다. 막힌 파일만 빼고 진행할지, 사용자가 명시적으로 허락할지 묻는다.

## 6. 보고

커밋 해시, 제목, 포함한 파일 수, push한 대상(`origin/main`)을 짧게 알린다. 커밋하지 못한 변경이 남았으면 그것도 적는다.
