# deck-kit — 도구 표

도구의 옵션·쓰임이 필요할 때 다 읽고 시작한다 — 전에 읽었어도 다시(대화가 요약됐을 수 있다). **KIT** = deck-kit 스킬 폴더(`SKILL.md`가 있는 곳, 이 파일의 위 폴더). 모든 단계에 걸리는 규칙·색·글꼴은 `SKILL.md`에 있다.

## 도구 — `python KIT/tools/<도구>` (인자로 덱 폴더를 주거나, 덱 폴더에서 실행)

| 도구 | 쓰임 |
| --- | --- |
| `shots.py [덱] [--reports] [--size 1920,1080] [--jobs N] [--query lang=kr]` | 전 슬라이드 캡처 → `work/shots/`, 덱 저장 시각과 콘솔 오류 출력. 실패한 장은 따로 다시 찍고, 그래도 안 되면 목록을 낸다. `--reports`: 보고서 미리보기를 `assets/img/reports/`에 만든다. `--query`: 주소에 붙일 값(언어 전환 등) |
| `pdf.py [덱] [--out 파일] [--skip 2,7,id] [--query lang=kr]` | 덱을 PDF로 인쇄(캡처가 아니라 글자 그대로 — 선명·검색 가능). 한 장 = 한 쪽, 연출은 끝난 모습, 화면 가득 영상 장과 검수에서 "PDF에서 빼기"한 장은 빼고 카드 영상은 사진, `--skip`: 더 뺄 장(번호나 id). 기본 `<덱 폴더>/<폴더 이름>.pdf`. 내용이 쪽 밖으로 넘친 장은 PDF에서 잘리므로 WARN으로 알린다. 받은 사람이 브라우저에서 바로 인쇄해도 한 장 = 한 쪽으로 나온다(엔진 v1.8) |
| `compress.py [덱] [--dry-run]` | 공유 폴더 줄이기: 영상(1920px·6Mbit/s 넘으면 H.264로), 사진(긴 변 1600px), 보고서 .html 속 사진. 이름·형식 그대로, 10% 넘게 줄 때만 바꾸고 원본은 `work/compress_originals/`. 100MB 넘으면 경고 + 큰 파일 목록 |
| `lint.py [덱]` | 작업 폴더 점검(읽기만 함): 태그 짝, 슬라이드 id, 남은 견본, 빠진 파일, 노트 키, 덱 스크립트, deck.css 중복·안 쓰는 클래스, **내용이 쪽 밖으로 넘친 장**(브라우저로 재서 px로 알림 — PDF에서 잘린다), 엔진이 키트와 같은지, 백업이 쓰는 파일, 양식 칸 남김 |
| `snapshot.py vN_<이름> "설명" [덱]` | 피드백 반영 **전** 지금 덱 코드를 `versions/vN_<이름>/`에 백업하고(덱을 만드는 스크립트와 그 데이터 .json·.csv 등도 함께) `versions/README.md` 표에 줄을 더한다 |
| `extract.py <파일.pptx> [--deck 덱]` | PPT → 슬라이드별 글·노트·그림(`work/manifest.json`), 그림·내장 보고서는 `presentation/`에. 그림은 PPT에서 잘린 대로, SVG 그림은 .svg로. 읽지 못한 그림은 건너뛰고 끝에 목록 |
| `images.py web｜cut｜trim｜fit <이미지…> --out 폴더` | 웹용 크기 · 배경 제거(투명) · 로고 여백 자르기(`--clear`: 흰 배경도 투명 — 트리맵처럼 로고를 칠하는 곳에 필요) · 인물을 같은 크기 캔버스에 |
| `used_assets.py [덱] [--move]` | 안 쓰는 파일·빠진 파일 찾기(`--move`: `work/unused_assets/`로 옮김). `versions/` 백업이 쓰는 파일은 사용 중으로 친다 |
| `dedupe_presentation.py [덱] [--dry]` | 똑같은 파일 정리 |
| `review.py [덱] [--all] [--shots 폴더] [--resolve N "답"]` | 덱 안 검수 메모(R, `assets/review.js`) 읽기: 반영 안 한 핀 표(핀 · 장 · id · 메모 · 누른 곳), PDF에서 뺄 장. `--shots`: 핀이 찍힌 캡처. `--resolve`: 반영함 + 답(먼저 `assets/review_backup/`에 백업) |
| `notes_probe.py [덱]` · `review_probe.py [덱]` | 발표자 창·스크립트 저장 시험 · 검수 모드 시험(덱 사본에서) |
| `motion_run.py --plan plan.json [--dry-run]` | Higgsfield로 카드 영상 생성(기본 Kling 4.0 `kling4_0`, 5초 720p) — **크레딧. 먼저 `--dry-run`, 사용자 확인 후** |
| `motion_post.py <clip.mp4> --image … [--box 280:450] [--link]` | 영상을 끊김 없는 반복 영상으로 만들고 motion.js에 연결 |
| `motion_lib.py find｜add --key <스타일 번호> …` | 공용 영상 라이브러리에서 찾아 쓰기 · 새 영상 넣기. 위치는 사용자 설정 `DECKKIT_MOTION_LIB`(`/deck-kit:update`가 물어 저장), 없거나 접근 못 하면 건너뜀 |
| `anim_probe.py` · `perf_probe.py` | 애니메이션 흔들림 · 재생 성능 측정 |
