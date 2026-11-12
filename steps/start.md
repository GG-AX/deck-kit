# deck-kit — 1·2 덱 폴더 만들기·구성안

덱을 새로 시작할 때 다 읽고 시작한다 — 전에 읽었어도 다시(대화가 요약됐을 수 있다). **KIT** = deck-kit 스킬 폴더(`SKILL.md`가 있는 곳, 이 파일의 위 폴더). 모든 단계에 걸리는 규칙·색·글꼴은 `SKILL.md`에 있다.

1. **덱 폴더 만들기** — `KIT/template/`의 내용을 덱 폴더로 통째로 복사한다. Windows에서는 그다음 읽기 전용 속성을 푼다: `attrib -r "<덱 폴더>\*" /s /d` (Mac은 필요 없음. OneDrive에서는 복사본이 읽기 전용이 되어 견본 삭제가 `Access denied`로 실패한다).
   - 사용자가 연 작업 폴더가 비어 있거나 원본 파일만 있으면 그 폴더가 덱 폴더다(원본은 `source/`로 옮긴다). 다른 작업이 들어 있으면 그 안에 원본 파일 이름으로 하위 폴더를 만든다.
   - 빈 폴더 `source ai work docs docs/feedback tools versions`가 없으면 만든다(압축·git에서 빠진다).
   - `CLAUDE.md`·`session.md`·`FEEDBACK.md`의 `<덱 이름>`과 "이 덱" 칸, `session.md`의 키트 버전(KIT `README.md` 버전 기록 맨 아래)을 채운다. 받은 원본은 `source/`에 둔다(고치지 않음).
   - 원본이 PPT면: `python KIT/tools/extract.py <파일.pptx>` → 글·노트·그림·내장 보고서가 `work/manifest.json`과 `presentation/`에 나온다. PPT에서 잘라 둔 그림은 잘린 대로 저장된다. 끝에 "SKIPPED"로 나온 그림(깨진 그림·EMF)은 "원본 문제"에 적는다.
   - 원본이 영상·HTML 툴이면: 영상은 `presentation/assets/video/`(+ 포스터 jpg), HTML 보고서는 `presentation/reports/`에 두고 보고서 카드로 연다. 미리보기는 `shots.py --reports`.
2. **구성안** — 슬라이드 목록(순서, id, 제목, 챕터, 레이아웃, 쓸 부품, 이미지)을 `session.md`에 적고 그대로 진행한다(확인받지 않는다).
