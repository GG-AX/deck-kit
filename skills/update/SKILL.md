---
name: update
description: deck-kit 플러그인을 GitHub의 최신 버전으로 업데이트한다. 사용자가 /deck-kit:update를 칠 때만 쓴다.
disable-model-invocation: true
---

# deck-kit 업데이트

0. 자동 업데이트가 꺼져 있으면 켠다. 사용자 설정 `~/.claude/settings.json`(Windows `%USERPROFILE%\.claude\settings.json`)의 `extraKnownMarketplaces.gg-ax`에 `"autoUpdate": true`가 없으면 그 한 키만 더한다(다른 내용은 건드리지 않고, 고친 뒤 JSON으로 읽히는지 확인). 더했으면 "자동 업데이트를 켰다"고 알린다. `gg-ax` 항목이 없으면 건드리지 않는다.
1. 지금 버전을 확인한다: `claude plugin list` 출력에서 `deck-kit@gg-ax`의 버전.
2. 순서대로 실행한다(PowerShell이나 Bash 어느 쪽이든).
   - `claude plugin marketplace update gg-ax`
   - `claude plugin update deck-kit@gg-ax`
3. 결과를 한국어로 알린다: 이전 버전 → 새 버전(같으면 "이미 최신"). 새 버전이면 키트의 `README.md` 키트 버전 기록에서 그 사이에 바뀐 줄을 보여 준다.
4. 바뀌었으면 "`/reload-plugins`를 입력하거나 Claude Code를 다시 시작해야 적용된다"고 알린다.
5. 환경 점검·설치 — 도구(캡처·점검)에 필요한 프로그램을 갖춘다. 먼저 모두 점검하고, 빠진 것이 있으면 무엇을 설치하는지 한 줄로 말한 뒤 사용자의 "네"를 한 번 받고 빠진 것만 설치한다. 다 있으면 묻지 않고 바로 확인(④)만 한다(10초 안에 끝나야 한다).
   ① `python --version`이 3.10 이상인가. 없으면 Windows `winget install Python.Python.3.12`, Mac `brew install python`(brew가 없으면 `xcode-select --install`을 안내). 설치 뒤에는 새 터미널에서 `python`이 잡히는지 본다.
   ② `python -c "import PIL, websocket, playwright, olefile"`가 되는가. 안 되면 `python -m pip install --user pillow websocket-client playwright olefile`.
   ③ ②를 설치했거나 ④가 "브라우저 없음"으로 실패하면 `python -m playwright install chromium`(약 150MB, 한 번).
   ④ 확인: `python ${CLAUDE_SKILL_DIR}/../../tools/shots.py ${CLAUDE_SKILL_DIR}/../../template --to 1 --out <임시 폴더>`가 PNG 1장을 만들면 "준비 끝". 아니면 어느 단계에서 막혔는지 오류와 함께 알린다.

`claude` 명령을 찾을 수 없으면(VS Code 확장만 깔린 PC) 2단계 대신 "Manage plugins → Plugins 탭 → `deck-kit`의 🔄 버튼"을 누르라고 안내한다. 0·5단계는 그대로 한다.

실패하면 메시지를 그대로 보여 준다. 저장소 접근 오류(`Authentication`, `not found`, `403`)라면 원인은 보통 둘이다:
GitHub 로그인이 안 됨(`gh auth login` 후 `gh auth setup-git`), 또는 저장소 초대를 아직 수락하지 않음.
