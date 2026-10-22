# deck-kit

발표 덱 키트 — 고정 엔진 + 견본 덱 + 새 덱 작업 공간 양식 + 공용 도구. Claude Code 스킬로 설치해서 쓴다.
에이전트용 사용 설명은 `SKILL.md`, 디자인 원칙은 `DESIGN.md`.

## 설치 (Claude Code 스킬)

1. 이 `deck-kit` 폴더를 통째로 `C:\Users\<사용자>\.claude\skills\deck-kit`에 복사한다. 키트 새 버전이 나오면 다시 복사한다(아래 버전 기록 확인).
2. 새 발표 자료용 빈 폴더를 만들어 VS Code(또는 Claude Desktop 앱의 Code 탭)에서 연다.
3. Claude Code에 "deck-kit으로 ○○ 발표 자료 만들어줘"라고 하고 원본 자료(PPT·문서·사진)를 준다. `/deck-kit`으로 불러도 된다.

도구에 필요한 것: Python 3(`pip install pillow websocket-client`, PPT 추출은 `olefile`, 배경 제거는 `numpy scipy rembg`), Microsoft Edge, 영상 작업은 ffmpeg(`winget install Gyan.FFmpeg`).

## 키트 버전 기록

키트 = 이 폴더 전체(문서·양식·도구·엔진). 덱을 만들 때 덱의 `session.md`에 맨 아래 버전을 적는다.

| 버전 | 날짜 | 바뀐 점 |
| --- | --- | --- |
| v1.0 | 2026-10-07 | 첫 버전 (엔진 v1.0) |
| v1.1 | 2026-10-08 | 첫 실전 덱 피드백 반영. 작업 순서: 원본만 받고 묻지 않고 만든 뒤 1차 검수로 넘김(가정·원본 문제 목록), 자체 검수, 피드백 반영 전 백업·수정 계획. 디자인 원칙: 원본 배치 재구성 허용, 정보 요소 유지, 로고 면적 맞춤, 사진 크기 통일·가운데 정렬. 도구: `lint.py`·`snapshot.py` 추가, `extract.py`(깨진 그림 건너뜀, PPT 자르기 적용, SVG 그림), `shots.py`(실패한 장 다시 찍기, 덱 저장 시각). 엔진은 그대로 v1.0 |
| v1.2 | 2026-10-08 | 엔진 v1.1: 누적 막대 조각 라벨, 로고 면적 맞춤(B1·B2). 견본 `chart-2`·`logos`에 적용, `sample-slides.jpg` 5·6번 갱신 |
| v1.3 | 2026-10-22 | 덱 3개(Target·Carhartt·Loft) 피드백 1차 반영. 테마 3개(`assets/themes/` navy·warm·sage, 미리보기 `sample-themes.jpg`). DESIGN: 여백·위계, 사진 자르기, 덱 전체 통일, 원본 대조, 지도, 강조색·테마 규칙. SKILL: 자체 검수 목록 보강, `shots.py`는 PowerShell에서, 영상·HTML 원본, DESIGN과 다른 제안 금지, 근거 경로 먼저. 양식 CLAUDE.md 안내문 수정, `lint.py`가 사용법 txt도 검사, 도구가 Mac의 Edge·Chrome도 찾음. 엔진 v1.2 |

## 엔진 버전 기록

엔진 = `template/presentation/assets/engine.js` · `engine.css` (+ `notes_server.ps1`). 바꾸면 `engine.js` 첫 줄의 버전과 이 표를 함께 올린다.

| 버전 | 날짜 | 바뀐 점 |
| --- | --- | --- |
| v1.0 | 2026-10-07 | 첫 버전 — 기존 발표 덱의 엔진을 정리해 분리. 상·하단 바를 엔진이 만듦, 스크립트 저장 키를 덱 폴더별로, 색을 토큰으로, 한글 글꼴(Pretendard), 숫자로 그리는 막대·선 그래프·누적 막대, 부품별 오류 처리, 캡처 모드(`?static`) 고정, 새로고침 뒤 발표자 창 문제 수정 |
| v1.1 | 2026-10-08 | 누적 막대 조각 라벨(`data-stack`의 `"labels":true`), 로고 면적 맞춤(`data-logo-area`). 둘 다 속성을 쓴 곳에만 적용 — 기존 덱 화면은 그대로 |
| v1.2 | 2026-10-22 | 챕터 커버 큰 번호를 외곽선 대신 옅은 채움으로(외곽선이 글꼴 획 겹침을 보였음). 챕터 커버가 있는 기존 덱은 번호 모양이 바뀐다 |
