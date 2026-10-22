---
name: update
description: deck-kit 플러그인을 GitHub의 최신 버전으로 업데이트한다. 사용자가 /deck-kit:update를 칠 때만 쓴다.
disable-model-invocation: true
---

# deck-kit 업데이트

1. 지금 버전을 확인한다: `claude plugin list` 출력에서 `deck-kit@gg-ax`의 버전.
2. 순서대로 실행한다(PowerShell이나 Bash 어느 쪽이든).
   - `claude plugin marketplace update gg-ax`
   - `claude plugin update deck-kit@gg-ax`
3. 결과를 한국어로 알린다: 이전 버전 → 새 버전(같으면 "이미 최신"). 새 버전이면 키트의 `README.md` 키트 버전 기록에서 그 사이에 바뀐 줄을 보여 준다.
4. 바뀌었으면 "`/reload-plugins`를 입력하거나 Claude Code를 다시 시작해야 적용된다"고 알린다.

실패하면 메시지를 그대로 보여 준다. 저장소 접근 오류(`Authentication`, `not found`, `403`)라면 원인은 보통 둘이다:
GitHub 로그인이 안 됨(`gh auth login` 후 `gh auth setup-git`), 또는 저장소 초대를 아직 수락하지 않음.
