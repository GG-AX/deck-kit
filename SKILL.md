---
name: deck-kit
description: 발표 자료(브라우저로 여는 HTML 프레젠테이션 덱)를 새로 만들거나 고칠 때 쓴다. 고정 엔진(슬라이드 넘기기·발표자 창·스크립트 저장·차트)과 견본 덱·공용 도구가 들어 있어, 새 덱 폴더를 만들고 슬라이드만 HTML로 쓴다. Use for any request to make or edit a presentation, slide deck, pitch deck, 발표 자료, 프레젠테이션, 슬라이드, or to turn a PPT/document into a web presentation.
---

# deck-kit — HTML 발표 덱 만들기

결과물은 `<덱 폴더>\presentation\` 폴더 하나다. 브라우저로 열어(인터넷 없이도) 발표하고, 공유할 때는 이 폴더를 zip으로 보낸다.
슬라이드 넘기기, 발표자 창(스크립트 편집·저장), 배경, 상·하단 바, 차트 그리기는 **엔진이 한다.** 너는 덱마다 슬라이드 내용만 HTML로 쓴다.

**KIT** = 이 스킬 폴더(보통 `%USERPROFILE%\.claude\skills\deck-kit`).

| KIT 안 | 무엇 |
| --- | --- |
| `template\` | 새 덱 폴더의 양식 — 통째로 복사해서 시작한다 |
| `template\presentation\deck.html` | **견본 덱 14장** = 부품마다 예시 슬라이드 한 장(내용은 가짜). 정확한 마크업은 여기서 복사한다 |
| `sample-slides.jpg` | 견본 14장의 모습(번호 = deck.html 순서) |
| `DESIGN.md` | 디자인 원칙(짧다 — 작업 전에 읽는다) |
| `tools\` | 캡처·PPT 추출·이미지 손질 등 도구(아래 "도구") |

## 작업 순서

1. **요청 확인** — 주제, 청중, 발표 날짜, 언어(정해지지 않으면 영어), 원본 자료(PPT·문서·사진·데이터)와 그 위치. 모르는 것은 묻는다.
2. **덱 폴더 만들기** — `KIT\template\`의 내용을 덱 폴더로 통째로 복사한다.
   - 사용자가 연 작업 폴더가 비어 있으면 그 폴더가 덱 폴더다. 아니면 위치와 덱 이름을 묻는다.
   - 빈 폴더 `source ai work docs tools versions`가 없으면 만든다(압축하면 빠질 수 있음).
   - `CLAUDE.md`·`session.md`·`FEEDBACK.md`의 `<덱 이름>`과 "이 덱" 칸을 채운다. 받은 원본은 `source\`에 둔다(고치지 않음).
   - 원본이 PPT면: `python KIT\tools\extract.py <파일.pptx>` → 글·노트·그림·내장 보고서가 `work\manifest.json`과 `presentation\`에 나온다.
3. **구성안** — 슬라이드 목록(순서, id, 제목, 챕터, 레이아웃, 쓸 부품, 이미지)을 먼저 사용자에게 보여 주고 확인받는다.
4. **슬라이드 쓰기** — `presentation\deck.html`(이름은 바꿔도 된다. 폴더 안 .html은 하나만).
   - **견본은 참고용이다. 레이아웃·위치·크기·이미지는 덱마다 자유다.** 맞는 견본이 있으면 복사해서 내용을 바꾸고 `data-sample`을 지운다. 맞는 게 없으면 공통 클래스와 토큰으로 새 레이아웃을 직접 만든다(덱 전용 스타일은 `assets\deck.css`).
   - 안 쓰는 견본 슬라이드와 예시 이미지(`assets\img\` 안 견본용 파일)·예시 데이터는 지운다.
   - `<title>`, `<html lang>`(한글 덱이면 `ko`), `<body data-logo="…" data-topline="…">`(상단 바의 로고와 문구)를 정한다.
   - `assets\notes.js`에 슬라이드마다 발표자 스크립트를 쓴다(원본 노트가 있으면 그대로). 키는 슬라이드 id.
   - `assets\data.js`는 상품 카드·콜라주를 쓸 때만, `assets\motion.js`는 카드 영상이 있을 때만 남긴다. 안 쓰면 파일과 `<script>` 줄을 지운다.
5. **확인** — `python KIT\tools\shots.py <덱 폴더>` → `work\shots\sNN.png`를 **전부 직접 열어 보고** 고친다.
   - 볼 것: 글자 넘침·잘림·겹침, 빈 곳, 이미지 비율, 남은 견본 내용, 콘솔 오류(shots.py가 출력)
   - 보고서 카드가 있으면 `--reports`로 미리보기 이미지도 만든다.
6. **보고** — 덱 위치, 여는 법(`presentation\Start Presentation.bat` 더블클릭), 확인이 필요한 것. `session.md`를 현재 상태로 고친다.

## 규칙

- **엔진은 고치지 않는다**: `assets\engine.js`, `engine.css`, `notes_server.ps1`, `fonts\`, `Start Presentation.bat`. 덱만의 스타일·색은 `assets\deck.css`에.
- **오프라인(file://)에서 동작**: 일반 `<script src>`만 쓴다(ES module·fetch·CDN 금지). 모든 파일은 `presentation\` 안에 두고 상대 경로로 쓴다.
- **슬라이드 형식**: `#deck` 바로 안에 `<section class="slide" data-src="id" data-title="제목" data-chapter="챕터">`.
  - id는 영문·숫자·`-`·`_`이고, 첫 글자는 영문이나 숫자다. 겹치지 않아야 하고, **한 번 정하면 바꾸지 않는다**(발표자 스크립트가 id에 붙어 있다).
  - 같은 `data-chapter`가 이어지는 슬라이드가 한 챕터다(상단 바와 하단 점에 표시된다).
- **무대는 1280×720 고정이다.**
  - 밝은 슬라이드: 흰 패널 위에 `.band`(작은 머리말) + `.page`(본문 영역)
  - `class="slide dark"`: 움직이는 배경 위 전체 화면(표지·챕터·영상·마무리)
- **숫자와 문구는 원본 그대로 쓴다.** 원본에 없는 숫자·사실은 지어내지 않는다. 비어 있으면 묻거나, 눈에 띄는 자리표시로 남기고 보고한다.
- **크레딧을 쓰는 AI 생성**(Higgsfield 영상 등)은 사용자 확인 후에만 한다. 생성 기록은 `ai\`에 둔다.
- `notes.js`는 발표자가 발표자 창에서 직접 고쳐 저장하는 파일이다. 사용자가 고친 뒤에는 통째로 덮어쓰지 않는다.

## 부품 — 견본 덱의 예시 슬라이드

정확한 마크업은 `template\presentation\deck.html`에서 해당 id를 찾아 복사한다.

| 견본 id | 부품 | 핵심 |
| --- | --- | --- |
| `cover` | 표지 | `.title-wrap`: 로고·회사명·제목·날짜·기밀 고지 + 오른쪽 사진 |
| `video` | 화면 가득 영상 | `.video-full` > `.vbox`(video + `.play`). ▶ 클릭이나 Enter로 재생 |
| `chapter` | 챕터 커버 | `.divider`: 큰 번호 + 챕터명 + `.agenda`(지금 챕터만 `.on`) |
| `chart` | 숫자·차트 | 막대 `data-bars`, 트리맵 `data-treemap`, 비율 막대 `.cats`>`.cr`, 카운트업 `data-count` |
| `chart-2` | 추세·구성 | 선 그래프 `data-line`, 누적 막대 `data-stack`, 결론 `.concl` |
| `logos` | 로고 격자 4×4 | `.logo-grid4`>`.lg`(img + 상태 캡션 `.note`) |
| `kpi` | 숫자 카드 + 도넛 | 카드 안 `.donut`(`data-donut`) + 카운트업, 아래 비율 막대 |
| `columns` | 3단 카드 + 결론 | `.rule` 칼럼(제목·`ul.list`·`.hl`) + `.concl` + 출처 `.foot` |
| `photo-steps` | 사진 + 글 + 단계 | `.figure`(+ 출처 `.src`), `.chip`, 01→05 `.flow` |
| `collage` | 콜라주 | `data-collage`(칸 좌표, 1192×578 기준) + `data.js`의 portfolio(배경 지운 인물 사진) |
| `product` | 상품 카드 | `.bs-grid data-bs` + `data.js`의 bestsellers(+ `motion.js` 카드 영상) |
| `big-image` | 큰 그림 | `.stepline`(단계 표시) + 큰 `.figure` |
| `report` | 보고서 카드 | `.report`: 미리보기 + `button data-report="reports/…html"` → 같은 화면 위 보고서 창 |
| `closing` | 마무리 | `.closing`: 로고 + 큰 문장 하나 |

### 공통 클래스

- 카드류: `.card` `.rule`(위 굵은 선) `.hl`(강조 한 줄) `.concl`(결론 띠) `.chip` `.tag`
- 글: `.label`(작은 머리말) `.title` `.sub` `ul.list`
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
- 누적 막대: `<div class="stack" data-stack='{"x":["2024",…],"series":[["Stores",[300,…]],["Online",[…]]]}'></div>`
- 도넛: `<div class="donut" style="width:52px;height:52px" data-donut='[["A",55,"var(--tone-2)"],["",45,"var(--fill)"]]'><div class="svg-host"></div></div>`
- 트리맵: `<div class="tm" data-treemap='[["Brand A",24,"assets/img/…/logo.webp"],…]'></div>` — 큰 값부터 쓴다.
- 카운트업: `<b data-count="128" data-suffix="%">128%</b>`
- 공통: JSON은 작은따옴표 속성 안에 쓴다. 글에 `'`가 있으면 `&#39;`로 쓴다.

### 색·글꼴

- 테마는 `engine.css` 맨 위의 토큰이다. HTML에서는 hex 대신 토큰을 쓴다(`var(--key)` `var(--body)` `var(--muted)` `var(--line)` `var(--tile)`).
- 차트 색 단계는 `--tone-1`(가장 진함)부터 `--tone-9`까지다.
- 한 덱만 테마를 바꾸려면 `deck.css`에서 `:root{…}` 토큰을 덮어쓴다(배경 애니메이션·차트까지 함께 바뀐다).
- 글꼴은 Inter(영문)·JetBrains Mono(라벨)·Pretendard(한글, 자동)다.

## 도구 — `python KIT\tools\<도구>` (인자로 덱 폴더를 주거나, 덱 폴더에서 실행)

| 도구 | 쓰임 |
| --- | --- |
| `shots.py [덱] [--reports] [--size 1920,1080]` | 전 슬라이드 캡처 → `work\shots\`, 콘솔 오류 출력. `--reports`: 보고서 미리보기를 `assets\img\reports\`에 만든다 |
| `extract.py <파일.pptx> [--deck 덱]` | PPT → 슬라이드별 글·노트·그림(`work\manifest.json`), 그림·내장 보고서는 `presentation\`에 |
| `images.py web｜cut｜trim｜fit <이미지…> --out 폴더` | 웹용 크기 · 배경 제거(투명) · 로고 여백 자르기 · 인물을 같은 크기 캔버스에 |
| `used_assets.py [덱] [--move]` | 안 쓰는 파일·빠진 파일 찾기(`--move`: `work\unused_assets\`로 옮김) |
| `dedupe_presentation.py [덱] [--dry]` | 똑같은 파일 정리 |
| `notes_probe.py [덱] [--save]` | 발표자 창·스크립트 저장 시험 |
| `motion_run.ps1 -Plan plan.json [-DryRun]` | Higgsfield로 카드 영상 생성 — **크레딧. 먼저 `-DryRun`, 사용자 확인 후** |
| `motion_post.py <clip.mp4> --image … [--box 280:450] [--link]` | 영상을 끊김 없는 반복 영상으로 만들고 motion.js에 연결 |
| `anim_probe.py` · `perf_probe.py` | 애니메이션 흔들림 · 재생 성능 측정 |

필요한 것: Python 3 + Pillow·websocket-client(배경 제거는 numpy·scipy·rembg, PPT 추출은 olefile), Microsoft Edge, 영상 작업은 ffmpeg.

## 사용자에게 알려 줄 사용법

- 열기: `presentation\Start Presentation.bat` 더블클릭. 이렇게 열어야 스크립트가 바로 저장된다.
- 키: ← → 이동 · F 전체 화면 · G 전체 보기 · P 발표자 창(스크립트 편집, Ctrl+S 저장) · Enter 영상 재생
- 공유: `presentation` 폴더를 통째로 zip으로 보낸다. 자세한 안내는 폴더 안 `사용법 (How to use).txt`에 있다.
