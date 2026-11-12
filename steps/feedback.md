# deck-kit — 6 피드백 반영 · 예전 키트로 만든 덱

검수 의견을 받을 때마다, 예전 키트로 만든 덱을 고치기 전에 다 읽고 시작한다 — 전에 읽었어도 다시(대화가 요약됐을 수 있다). **KIT** = deck-kit 스킬 폴더(`SKILL.md`가 있는 곳, 이 파일의 위 폴더). 모든 단계에 걸리는 규칙·색·글꼴은 `SKILL.md`에 있다.

6. **피드백 반영** — 검수 의견을 받을 때마다 이 순서로 한다. 덱 안 검수 메모(R)가 있으면 먼저 `python KIT/tools/review.py <덱 폴더> --shots work/review_shots`로 읽는다 — 핀마다 메모와 누른 곳(`at`: 그 자리의 글자·그림 파일)이 표로 나오고, 캡처에 핀 번호가 찍혀 있다. 메모가 가리키는 곳이 애매하면 계획표에서 "이렇게 이해했다"고 적고 확인받는다.
   1. **백업 먼저**: 코드를 하나라도 고치기 **전에** `python KIT/tools/snapshot.py vN_<이름> "한 줄 설명"`(N = 지금 라이브 번호). 고친 뒤에 백업하면 사본이 옛 덱과 어긋난다.
   2. **수정 계획 보여 주기**: 받은 피드백 원문(메일·메시지, 검수 메모는 `review.py` 표)은 `docs/feedback/`에 날짜 이름으로 저장하고, 피드백을 `FEEDBACK.md`에 적고, 슬라이드별 수정 계획표(슬라이드 · 피드백 · 고칠 방법)를 사용자에게 보여 주고 확인받는다.
   3. 반영 → 검수 메모는 핀마다 `review.py --resolve N "한 줄 답"`(무엇을 어떻게 고쳤는지 — 사용자가 덱의 "지난 의견 보기"에서 본다. 반영하지 않은 핀은 그대로 두고 이유를 보고) → 4번 자체 검수(`KIT/steps/check.md`를 다시 읽고 그대로 한다) → 압축(`compress.py`, 새로 넣은 파일만 바뀜)·PDF 다시 만들기(`pdf.py`, "PDF에서 빼기" 장은 알아서 빠짐) → 고친 것과 남은 것을 보고하고 `FEEDBACK.md` 상태와 `session.md`(백업 번호·슬라이드 수·lint 결과)를 지금 기준으로 고친다.

### 예전 키트로 만든 덱을 이어서 고칠 때

- 엔진은 덱을 만들 때의 버전 그대로 둔다(lint가 WARN으로 알린다). 발표가 코앞이면 올리지 않는다.
- 올릴 때: `snapshot.py`로 백업 → KIT `template/presentation/assets/`의 `engine.js`·`engine.css`를 덱 `assets/`에 덮어쓰고, 덱에 `Start Presentation.bat`·`assets/notes_server.ps1`이 있으면 지운다(v1.5부터 안 씀). v1.7 전 덱이면 KIT의 빈 `assets/review.js`를 복사하고 덱 .html의 notes.js 줄 다음에 `<script src="assets/review.js"></script>`를 넣는다(검수 모드) → `shots.py`로 전 장을 찍어 백업 캡처와 비교한다(KIT `README.md` 엔진 버전 기록에서 바뀐 점을 본다).
- 덱 `CLAUDE.md`나 덱 도구에 `.claude/skills/deck-kit` 같은 옛 KIT 경로가 있으면 지운다. KIT 도구는 늘 이 스킬을 불러온 뒤 KIT 경로로 실행한다.
