# deck-kit — 3 슬라이드 쓰기 · 부품 · 차트

슬라이드를 쓰기 전에 다 읽고 시작한다 — 전에 읽었어도 다시(대화가 요약됐을 수 있다). **KIT** = deck-kit 스킬 폴더(`SKILL.md`가 있는 곳, 이 파일의 위 폴더). 모든 단계에 걸리는 규칙·색·글꼴은 `SKILL.md`에 있다.

3. **슬라이드 쓰기** — `presentation/deck.html`(이름은 바꿔도 된다. 폴더 안 .html은 하나만).
   - **견본은 부품 사전이다.** 부품(표·차트·카드·사진 벽…)의 마크업만 가져다 쓰고, 슬라이드 배치는 따라 하지 않는다. 레이아웃·위치·크기·이미지는 원본 내용을 보고 덱마다 새로 짠다. 원본 PPT의 배치도 따를 필요 없다(`DESIGN.md`). 견본 장을 그대로 고쳐 쓸 때는 `data-sample`을 지운다. 덱 전용 스타일은 `assets/deck.css`.
   - **다른 덱 폴더는 보지도 복사하지도 않는다**(HTML·CSS·도구·그림 모두). 부품은 키트에서만 가져온다. 키트에 없는 부품이 필요하면 `deck.css`에 만들고 `session.md`의 "키트에 없던 것"에 적는다(키트 피드백이 된다). 예외: 사용자가 "○○ 덱의 그 장을 그대로"라고 지정한 경우만.
   - 안 쓰는 견본 슬라이드와 예시 이미지(`assets/img/` 안 견본용 파일)·예시 데이터는 지운다.
   - `<title>`, `<html lang>`(한글 덱이면 `ko`), `<body data-logo="…" data-topline="…">`(상단 바의 로고와 문구)를 정한다.
   - `assets/notes.js`에 슬라이드마다 발표자 스크립트를 쓴다(원본 노트가 있으면 그대로). 키는 슬라이드 id.
   - `assets/data.js`는 상품 카드·콜라주를 쓸 때만, `assets/motion.js`는 카드 영상이 있을 때만 남긴다. 안 쓰면 파일과 `<script>` 줄을 지운다.
   - 원본에 빠진 것·틀린 것(깨진 그림, 맞지 않는 숫자)은 지어내지 않는다. 화면에는 눈에 띄는 자리표시를 두고 `session.md`의 "원본 문제"에 적는다.

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
| `product` | 상품 카드 | `.bs-grid data-bs` + `data.js`의 bestsellers(+ `motion.js` 카드 영상). 로고 없으면 `retailer`가 글자로, `style` = 스타일 번호 줄, 원단·스펙이 길면 묶음에 `lines`(기본 4) — 카드를 덱에서 새로 만들지 않는다 |
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
