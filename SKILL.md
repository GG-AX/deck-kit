---
name: deck-kit
description: 발표 자료(브라우저로 여는 HTML 프레젠테이션 덱)를 새로 만들거나 고칠 때 쓴다. 고정 엔진(슬라이드 넘기기·발표자 창·스크립트 저장·차트)과 견본 덱·공용 도구가 들어 있어, 새 덱 폴더를 만들고 슬라이드만 HTML로 쓴다. Use for any request to make or edit a presentation, slide deck, pitch deck, 발표 자료, 프레젠테이션, 슬라이드, or to turn a PPT/document into a web presentation.
---

# deck-kit — HTML 발표 덱 만들기

결과물은 `<덱 폴더>/presentation/` 폴더 하나다. 브라우저로 열어(인터넷 없이도) 발표하고, 공유할 때는 이 폴더를 zip으로 보낸다.
슬라이드 넘기기, 발표자 창(스크립트 편집·저장), 배경, 상·하단 바, 차트 그리기는 **엔진이 한다.** 너는 덱마다 슬라이드 내용만 HTML로 쓴다.

**KIT** = 이 스킬 폴더: `${CLAUDE_SKILL_DIR}`. 플러그인으로 설치되어 업데이트마다 경로(버전 폴더)가 바뀌니, 덱 문서에 KIT 경로를 적지 않는다.

| KIT 안 | 무엇 |
| --- | --- |
| `template/` | 새 덱 폴더의 양식 — 통째로 복사해서 시작한다 |
| `template/presentation/deck.html` | **견본 덱 16장** = 부품 사전(내용은 가짜). 견본 장의 `data-guide`는 화면 위쪽에 부품 설명을 띄운다(H로 숨김) — 덱에 가져올 때 `data-sample`과 함께 지운다. 정확한 마크업은 여기서 복사한다 |
| `sample-slides.jpg` | 견본 16장의 모습(번호 = deck.html 순서) |
| `DESIGN.md` | 디자인 원칙(짧다 — 작업 전에 읽는다) |
| `tools/` | 캡처·PPT 추출·이미지 손질 등 도구(아래 "도구") |

## 작업 순서

사용자는 **원본 파일만 주고, 1차 검수부터** 참여한다. 그 전까지(1~5)는 묻지 않고 끝까지 만든다.

- 정해지지 않은 것은 아래 기본값으로 하고, 기본값으로도 정할 수 없는 것은 판단해서 진행한 뒤 `session.md`의 "가정" 목록에 적는다. 검수 때 사용자가 고친다.
- 묻는 것은 진행이 불가능할 때뿐이다: 원본이 없다, 열리지 않는다, PPT가 PowerPoint에 열려 있어 잠겼다.
- 기본값: 문구·숫자·발표자 노트는 원본 그대로 · 언어는 원본의 언어 · 레이아웃은 보기 좋게 다시 짜도 된다 · `DESIGN.md` 원칙 전부 적용 · 발표 날짜·장소·청중은 원본에 있는 것만 쓰고, 없으면 비워 둔다.

1. **덱 폴더 만들기** — `KIT/template/`의 내용을 덱 폴더로 통째로 복사한 뒤 읽기 전용 속성을 푼다: `attrib -r "<덱 폴더>\*" /s /d` (OneDrive에서는 복사본이 읽기 전용이 되어 견본 삭제가 `Access denied`로 실패한다).
   - 사용자가 연 작업 폴더가 비어 있거나 원본 파일만 있으면 그 폴더가 덱 폴더다(원본은 `source/`로 옮긴다). 다른 작업이 들어 있으면 그 안에 원본 파일 이름으로 하위 폴더를 만든다.
   - 빈 폴더 `source ai work docs docs/feedback tools versions`가 없으면 만든다(압축·git에서 빠진다).
   - `CLAUDE.md`·`session.md`·`FEEDBACK.md`의 `<덱 이름>`과 "이 덱" 칸, `session.md`의 키트 버전(KIT `README.md` 버전 기록 맨 아래)을 채운다. 받은 원본은 `source/`에 둔다(고치지 않음).
   - 원본이 PPT면: `python KIT/tools/extract.py <파일.pptx>` → 글·노트·그림·내장 보고서가 `work/manifest.json`과 `presentation/`에 나온다. PPT에서 잘라 둔 그림은 잘린 대로 저장된다. 끝에 "SKIPPED"로 나온 그림(깨진 그림·EMF)은 "원본 문제"에 적는다.
   - 원본이 영상·HTML 툴이면: 영상은 `presentation/assets/video/`(+ 포스터 jpg), HTML 보고서는 `presentation/reports/`에 두고 보고서 카드로 연다. 미리보기는 `shots.py --reports`.
2. **구성안** — 슬라이드 목록(순서, id, 제목, 챕터, 레이아웃, 쓸 부품, 이미지)을 `session.md`에 적고 그대로 진행한다(확인받지 않는다).
3. **슬라이드 쓰기** — `presentation/deck.html`(이름은 바꿔도 된다. 폴더 안 .html은 하나만).
   - **견본은 부품 사전이다.** 부품(표·차트·카드·사진 벽…)의 마크업만 가져다 쓰고, 슬라이드 배치는 따라 하지 않는다. 레이아웃·위치·크기·이미지는 원본 내용을 보고 덱마다 새로 짠다. 원본 PPT의 배치도 따를 필요 없다(`DESIGN.md`). 견본 장을 그대로 고쳐 쓸 때는 `data-sample`을 지운다. 덱 전용 스타일은 `assets/deck.css`.
   - **다른 덱 폴더는 보지도 복사하지도 않는다**(HTML·CSS·도구·그림 모두). 부품은 키트에서만 가져온다. 키트에 없는 부품이 필요하면 `deck.css`에 만들고 `session.md`의 "키트에 없던 것"에 적는다(키트 피드백이 된다). 예외: 사용자가 "○○ 덱의 그 장을 그대로"라고 지정한 경우만.
   - 안 쓰는 견본 슬라이드와 예시 이미지(`assets/img/` 안 견본용 파일)·예시 데이터는 지운다.
   - `<title>`, `<html lang>`(한글 덱이면 `ko`), `<body data-logo="…" data-topline="…">`(상단 바의 로고와 문구)를 정한다.
   - `assets/notes.js`에 슬라이드마다 발표자 스크립트를 쓴다(원본 노트가 있으면 그대로). 키는 슬라이드 id.
   - `assets/data.js`는 상품 카드·콜라주를 쓸 때만, `assets/motion.js`는 카드 영상이 있을 때만 남긴다. 안 쓰면 파일과 `<script>` 줄을 지운다.
   - 원본에 빠진 것·틀린 것(깨진 그림, 맞지 않는 숫자)은 지어내지 않는다. 화면에는 눈에 띄는 자리표시를 두고 `session.md`의 "원본 문제"에 적는다.
4. **자체 검수** — 사용자에게 넘기기 전에 아래를 **통과할 때까지** 고치고 다시 본다.
   - 덱을 만드는 스크립트가 있으면 출력을 숨기지 않고 실행해 오류가 없는지 본다(`2>$null` 금지 — 빌드가 실패했는데 옛 덱을 캡처한 적이 있다).
   - `python KIT/tools/lint.py <덱 폴더>` — ERR이 없어야 한다. WARN은 이유가 있으면 둔다.
   - `python KIT/tools/shots.py <덱 폴더>` → `work/shots/sNN.png`를 **전부 직접 열어 본다**. 첫 줄의 저장 시각이 방금 고친 시각인지 확인한다. 보고서 카드가 있으면 `--reports`도.
   - 슬라이드마다 볼 것
     - 글자 넘침·잘림·겹침, 콘솔 오류, 남은 견본 내용
     - 빈 공간: 칸 아래쪽이 비었거나 패널이 내용보다 훨씬 크지 않은가(`DESIGN.md` 여백·위계)
     - 사진: 중요한 부분이 잘리지 않았나, 배경이 다른 상품 사진을 밝기만 바꾸지 않았나(배경 제거)
     - 같은 종류 그림(사진·로고·국기)의 보이는 크기, 인물 사진의 높이·머리선·발선
     - 12px 미만 글자
     - 챕터 커버·마무리 장이 `DESIGN.md` 슬라이드 구성대로인가(마무리 = 문장 하나 + 로고)
   - 원본과 나란히 볼 것: 숫자·문구, 정보 요소(아이콘·표시 기호), 원본에서 가려진 그림을 쓰지 않았나, 그림 사이 연결선·확대 표시를 살렸나
   - 숫자 검산: 비율의 합(100%), 합계 = 항목의 합, 금액 = 단가 × 수량. 원본이 틀렸으면 고치지 말고 "원본 문제"에 적는다
   - 덱 전체로 볼 것: 캡처를 한 장에 모아(`sNN.png` 여러 장을 격자로) 같은 종류 슬라이드끼리 제목 형식·칸 크기·핵심 문구 띠가 같은지
   - 마지막으로 `DESIGN.md`를 한 줄씩 다시 읽고 어긋난 곳이 없는지
   - 슬라이드가 많으면 서브에이전트에게 슬라이드를 나눠 맡겨 함께 본다(각자 캡처와 원본을 대조해 문제 목록만 돌려받는다).
5. **1차 검수 넘기기** — 사용자에게 한 번에 알린다. `session.md`도 이 기준으로 고친다.
   - 덱 위치와 여는 법(`presentation/` 안 .html을 Edge나 Chrome으로 더블클릭)
   - 슬라이드 구성(한 줄씩)
   - 가정 목록 — 묻지 않고 정한 것
   - 원본 문제 목록 — 화면에 자리표시로 둔 것
   - 자체 검수에서 고친 것과 남은 것
6. **피드백 반영** — 검수 의견을 받을 때마다 이 순서로 한다.
   1. **백업 먼저**: 코드를 하나라도 고치기 **전에** `python KIT/tools/snapshot.py vN_<이름> "한 줄 설명"`(N = 지금 라이브 번호). 고친 뒤에 백업하면 사본이 옛 덱과 어긋난다.
   2. **수정 계획 보여 주기**: 받은 피드백 원문(메일·메시지)은 `docs/feedback/`에 날짜 이름으로 저장하고, 피드백을 `FEEDBACK.md`에 적고, 슬라이드별 수정 계획표(슬라이드 · 피드백 · 고칠 방법)를 사용자에게 보여 주고 확인받는다.
   3. 반영 → 4번 자체 검수 → 고친 것과 남은 것을 보고하고 `FEEDBACK.md` 상태와 `session.md`(백업 번호·슬라이드 수·lint 결과)를 지금 기준으로 고친다.

### 예전 키트로 만든 덱을 이어서 고칠 때

- 엔진은 덱을 만들 때의 버전 그대로 둔다(lint가 WARN으로 알린다). 발표가 코앞이면 올리지 않는다.
- 올릴 때: `snapshot.py`로 백업 → KIT `template/presentation/assets/`의 `engine.js`·`engine.css`를 덱 `assets/`에 덮어쓰고, 덱에 `Start Presentation.bat`·`assets/notes_server.ps1`이 있으면 지운다(v1.5부터 안 씀) → `shots.py`로 전 장을 찍어 백업 캡처와 비교한다(KIT `README.md` 엔진 버전 기록에서 바뀐 점을 본다).
- 덱 `CLAUDE.md`나 덱 도구에 `.claude/skills/deck-kit` 같은 옛 KIT 경로가 있으면 지운다. KIT 도구는 늘 이 스킬을 불러온 뒤 KIT 경로로 실행한다.

## 규칙

- **엔진은 고치지 않는다**: `assets/engine.js`, `engine.css`, `fonts/`. 덱만의 스타일·색은 `assets/deck.css`에.
- **오프라인(file://)에서 동작**: 일반 `<script src>`만 쓴다(ES module·fetch·CDN 금지). 모든 파일은 `presentation/` 안에 두고 상대 경로로 쓴다.
- **슬라이드 형식**: `#deck` 바로 안에 `<section class="slide" data-src="id" data-title="제목" data-chapter="챕터">`.
  - id는 영문·숫자·`-`·`_`이고, 첫 글자는 영문이나 숫자다. 겹치지 않아야 하고, **한 번 정하면 바꾸지 않는다**(발표자 스크립트가 id에 붙어 있다).
  - 같은 `data-chapter`가 이어지는 슬라이드가 한 챕터다(상단 바와 하단 점에 표시된다).
- **무대는 1280×720 고정이다.**
  - 밝은 슬라이드: 흰 패널 위에 `.band`(작은 머리말) + `.page`(본문 영역)
  - `class="slide dark"`: 움직이는 배경 위 전체 화면(표지·챕터·영상·마무리)
- **숫자와 문구는 원본 그대로 쓴다.** 원본에 없는 숫자·사실은 지어내지 않는다. 비어 있으면 눈에 띄는 자리표시로 남기고 "원본 문제"에 적는다.
- **원본의 정보 요소를 빠뜨리지 않는다**: 표의 행 아이콘, 병합 칸, 별표 같은 표시 기호. 배치를 다시 짜는 것과 요소를 지우는 것은 다르다.
- **크레딧을 쓰는 AI 생성**(Higgsfield 영상 등)은 사용자 확인 후에만 한다. 생성 기록은 `ai/`에 둔다.
- `notes.js`는 발표자가 발표자 창에서 직접 고쳐 저장하는 파일이다. 사용자가 고친 뒤에는 통째로 덮어쓰지 않는다.
- **`DESIGN.md`와 다른 방향은 먼저 제안하지 않는다**(예: 모노톤 덱에 강조색 추가). 피드백이 모호해도 원칙 안에서 고칠 방법을 수정 계획표에 적는다.
- **설명할 때는 근거 파일 경로를 먼저 밝힌다**: 문구·스크립트를 어느 파일에서 가져왔는지, 무엇이 어디에 저장되는지, 어느 것이 최신인지.

## 부품 — 견본 덱의 예시 슬라이드

정확한 마크업은 `template/presentation/deck.html`에서 해당 id를 찾아 복사한다. 한 장에 부품 여러 개를 모아 보여 줄 뿐이니, 배치는 따라 하지 않는다. 그림은 `sample-slides.jpg`.

| 견본 id | 부품 | 핵심 |
| --- | --- | --- |
| `cover` | 표지 | `.title-wrap`: 로고·회사명·제목·날짜·기밀 고지 + 오른쪽 사진 |
| `video` | 화면 가득 영상 | `.video-full` > `.vbox`(video + `.play`). ▶ 클릭이나 Enter로 재생 |
| `chapter` | 챕터 커버 | `.divider`: 큰 번호 + 챕터명 + `.agenda`(지금 챕터만 `.on`) |
| `chart` | 숫자·차트 | 막대 `data-bars` + 추세 화살표 `svg.trend`(막대와 함께 그려짐)·`.trend-t`, 한 줄 비율 막대 `.cr.h`, 트리맵 `data-treemap` + 아래 `.top5`(로고 순위 줄, `data-logo-area`), 숫자 카드 `.kpi` + 카운트업 `data-count`, 비율 막대 `.cats`>`.cr` |
| `chart-2` | 추세·구성 | 선 그래프 `data-line`, 누적 막대 `data-stack`(조각 라벨 `"labels":true`), 결론 `.concl` |
| `logos` | 로고 격자 4×4 | `.logo-grid4 data-logo-area`>`.lg`(img + 상태 캡션 `.note`) — 로고 크기는 엔진이 면적으로 맞춘다 |
| `kpi` | 거점 비교 | 지도 `.mapbox` + 번호 핀 `.pin.n`, `.kv`(한 줄 요약), 거점 카드 안 도넛 `.dn-wrap`(`data-donut` + 가운데 `.dn-c` 카운트업), 아래 비율 막대 |
| `table` | 표 · 숫자 카드 · 상태 줄 | `.hd`(제목 줄 + `.stat`), `.tbl`(병합 칸 `td.g` rowspan, 숫자 `.r`, 소계 `tr.sub`, 합계 `tr.tot`, `.big` `.fill`), `.kpi` 카드, `.tl-rows` > `.tl-row`(칩 색 `--c` = 회색 단계) |
| `chart-3` | 조각 많은 구성(9개 넘음) | 구분 팔레트 `--cat` 도넛 `.dn-wrap` + 가운데 `.dn-c`, 큰 값 범례 `.lgd`, 컬러칩 범례 `.chips`(`--cols`), 결론 `.concl` |
| `map-photos` | 지도 · 사진 벽 · 그림 위 표시 | `.mapbox`(`--ar`) + `.pin`(이름표) · `.pin.n`(번호), 숫자 줄 `.stat`, `.pnl` + `.wall`(같은 높이 `--h`, `.cut` = 배경 지운 사진, `i.br` 줄바꿈), `.pic` + `.box` `.tick` `.tag`(그림 기준 %), `.stp`(번호 단계), `.lgs`(한 줄 `--n`칸 로고), `.todo`(자료 기다리는 자리) |
| `columns` | 3단 카드 + 결론 | `.rule` 칼럼(제목·숫자 `.stat`·`ul.list`·`.hl`) + `.concl` + 출처 `.foot` |
| `photo-steps` | 사진 + 글 + 단계 | `.figure`(+ 출처 `.src`), `.chip`, 01→05 `.flow`. 스크린샷 한 장을 크게 보일 때는 글 칸을 빼고 `.figure`만 키운다 |
| `collage` | 콜라주 | `data-collage`(칸 좌표, 1192×578 기준) + `data.js`의 portfolio(배경 지운 인물 사진) |
| `product` | 상품 카드 | `.bs-grid data-bs` + `data.js`의 bestsellers(+ `motion.js` 카드 영상) |
| `report` | 보고서 카드 | `.stepline`(단계 표시) + `.report`: 미리보기 + `button data-report="reports/…html"` → 같은 화면 위 보고서 창 |
| `closing` | 마무리 | `.closing`: 로고 + 큰 문장 하나 |

### 공통 클래스

- 카드류: `.card` `.rule`(위 굵은 선) `.hl`(강조 한 줄) `.concl`(결론 띠) `.chip` `.tag`
- 글: `.label`(작은 머리말) `.title` `.sub` `ul.list`
- 제목 크기: `.title`(30px) · `.title.l`(32) · `.title.m`(24) · `.title.s`(21). **인라인 `font-size`는 쓰지 않는다**(lint가 잡는다). 덱 전체 제목을 작게 하려면 `deck.css`에 `.title{font-size:28px}` 한 줄
- 배치: `.grid`(+ 인라인 `grid-template-columns`) `.figure` `.src`
- 흐름: `.flow`(`.st` + `.ar`) `.stepline`
- 슬라이드 글자 크기: `class="slide roomy"`(크게) / `"slide compact"`(작게)
- 등장 애니메이션: `class="reveal" style="--i:N"` — N 순서대로 나타난다

### 차트 — 숫자만 적으면 엔진이 그린다

슬라이드에 들어올 때마다 애니메이션한다.

- 막대: `<div class="vbars" data-bars='[["2023",420],["2026 (F)",480,"fc"],["2027 (F)",560,"fc2"]]'></div>`
  - 각 항목은 `[이름, 값, 강조 "fc"·"fc2"(선택), 표시 글(선택)]`이다.
  - 가장 큰 막대가 높이의 85%다. 메모는 `<div class="anno" style="left:40%;top:3%">…</div>`를 안에 넣는다.
- 선 그래프: `<div class="lc" data-line='{"x":["Jan","Feb",…],"series":[["2026",[42,45,…]],["2025",[…]]]}'></div>`
- 누적 막대: `<div class="stack" data-stack='{"x":["2024",…],"series":[["Stores",[300,…]],["Online",[…]]],"labels":true}'></div>`
  - `"labels":true`: 범례 대신 조각마다 "이름 (비율%)"을 붙인다. 넓은 조각은 안에, 좁은 조각은 막대 옆에 겹치지 않게 놓고, 자리가 모자라면 막대를 좁힌다. 빼면 범례만 나온다.
- 로고 크기: 로고를 담은 칸(예: `.logo-grid4`)에 `data-logo-area="2400"`(로고 하나의 보이는 면적, 무대 px²). 가로로 긴 로고와 네모난 로고가 같은 무게로 보인다. 상한은 `data-logo-max="190,64"`(가로,세로), 한 로고만 크거나 작아 보이면 그 img에 `data-optical="0.8"`. 로고 파일의 여백은 먼저 `images.py trim`으로 잘라 낸다.
- 도넛: `<div class="donut" style="width:52px;height:52px" data-donut='[["A",55,"var(--tone-2)"],["",45,"var(--fill)"]]'><div class="svg-host"></div></div>`
- 트리맵: `<div class="tm" data-treemap='[["Brand A",24,"assets/img/…/logo.webp"],…]'></div>` — 큰 값부터 쓴다.
- 카운트업: `<b data-count="128" data-suffix="%">128%</b>`
- 공통: JSON은 작은따옴표 속성 안에 쓴다. 글에 `'`가 있으면 `&#39;`로 쓴다.

### 색·글꼴

- 테마는 `engine.css` 맨 위의 토큰이다. HTML에서는 hex 대신 토큰을 쓴다(`var(--key)` `var(--body)` `var(--muted)` `var(--line)` `var(--tile)`).
- 차트 색 단계는 `--tone-1`(가장 진함)부터 `--tone-9`까지다.
- 조각이 9개를 넘는 차트만 구분 팔레트 `--cat-1`…`--cat-12`(12 = 기타)를 쓰고 컬러칩 범례를 붙인다. 예: `data-donut='[["Cotton",34,"var(--cat-1)"],…]'`. 테마를 바꿔도 이 색은 그대로다.
- 기본은 모노톤이다. 테마는 `assets/themes/`의 `navy`(남색)·`warm`(웜 뉴트럴)·`sage`(세이지) 중 하나를 `deck.html`의 주석 처리된 `<link>` 줄로 켠다(배경 애니메이션·차트까지 함께 바뀐다). **사용자가 테마를 정했을 때만** 켠다.
- 테마 파일은 고치지 않는다. 한 덱만 색을 더 바꾸려면 `deck.css`에서 `:root{…}` 토큰을 덮어쓴다.
- 글꼴은 Inter(영문)·JetBrains Mono(라벨)·Pretendard(한글, 자동)다.

## 도구 — `python KIT/tools/<도구>` (인자로 덱 폴더를 주거나, 덱 폴더에서 실행)

| 도구 | 쓰임 |
| --- | --- |
| `shots.py [덱] [--reports] [--size 1920,1080] [--jobs N]` | 전 슬라이드 캡처 → `work/shots/`, 덱 저장 시각과 콘솔 오류 출력. 실패한 장은 따로 다시 찍고, 그래도 안 되면 목록을 낸다. `--reports`: 보고서 미리보기를 `assets/img/reports/`에 만든다 |
| `lint.py [덱]` | 작업 폴더 점검(읽기만 함): 태그 짝, 슬라이드 id, 남은 견본, 빠진 파일, 노트 키, 덱 스크립트, deck.css 중복·안 쓰는 클래스, 엔진이 키트와 같은지, 백업이 쓰는 파일, 양식 칸 남김 |
| `snapshot.py vN_<이름> "설명" [덱]` | 피드백 반영 **전** 지금 덱 코드를 `versions/vN_<이름>/`에 백업하고 `versions/README.md` 표에 줄을 더한다 |
| `extract.py <파일.pptx> [--deck 덱]` | PPT → 슬라이드별 글·노트·그림(`work/manifest.json`), 그림·내장 보고서는 `presentation/`에. 그림은 PPT에서 잘린 대로, SVG 그림은 .svg로. 읽지 못한 그림은 건너뛰고 끝에 목록 |
| `images.py web｜cut｜trim｜fit <이미지…> --out 폴더` | 웹용 크기 · 배경 제거(투명) · 로고 여백 자르기 · 인물을 같은 크기 캔버스에 |
| `used_assets.py [덱] [--move]` | 안 쓰는 파일·빠진 파일 찾기(`--move`: `work/unused_assets/`로 옮김). `versions/` 백업이 쓰는 파일은 사용 중으로 친다 |
| `dedupe_presentation.py [덱] [--dry]` | 똑같은 파일 정리 |
| `notes_probe.py [덱]` | 발표자 창·스크립트 저장 시험 |
| `motion_run.py --plan plan.json [--dry-run]` | Higgsfield로 카드 영상 생성 — **크레딧. 먼저 `--dry-run`, 사용자 확인 후** |
| `motion_post.py <clip.mp4> --image … [--box 280:450] [--link]` | 영상을 끊김 없는 반복 영상으로 만들고 motion.js에 연결 |
| `anim_probe.py` · `perf_probe.py` | 애니메이션 흔들림 · 재생 성능 측정 |

필요한 것: Python 3 + `pip install pillow websocket-client playwright`(배경 제거는 numpy·scipy·rembg, PPT 추출은 olefile) + `python -m playwright install chromium`(캡처용 브라우저, 약 150MB, 한 번), 영상 작업은 ffmpeg.
도구를 돌리다 `ModuleNotFoundError`나 "브라우저 없음"이 나오면 사용자에게 명령을 보여 주지 말고 `/deck-kit:update`의 환경 점검·설치 단계(`skills/update/SKILL.md`)를 그대로 수행한다.

## 사용자에게 알려 줄 사용법

- 열기: `presentation/` 안 .html을 Edge나 Chrome으로 연다(더블클릭). 스크립트를 처음 저장할 때 한 번 `assets/notes.js`를 고르면 다음부터 바로 저장된다(Safari 등은 notes.js가 내려받아진다).
- 키: ← → 이동 · F 전체 화면 · G 전체 보기 · P 발표자 창(스크립트 편집, Ctrl+S 저장) · Enter 영상 재생
- 공유: `presentation` 폴더를 통째로 zip으로 보낸다. zip은 `presentation` **밖**(덱 폴더 `work/` 등)에 만든다 — 안에 두면 다음 zip에 zip이 들어간다. 자세한 안내는 폴더 안 `사용법 (How to use).txt`에 있다.
