# 과학 시뮬레이션 프로젝트 (하네스)

중학교 과학 개념을 눈으로 확인하는 웹 시뮬레이션 모음. 작성자 표기는 "두리쌤".
지금까지의 과정은 [docs/PROCESS.md](docs/PROCESS.md)에 정리되어 있다.

## 구조

- 루트가 GitHub repo(`mrdoolee/science-simulation-project`). 시뮬레이션은 폴더 하나에 하나씩 넣는다.
- `friction-electricity/` : 마찰전기 (배포: https://friction-electricity.vercel.app)
  - `index.html` 화면 뼈대, 푸터 크레딧, 모달
  - `style.css` 디자인 토큰(`:root` 변수)과 컴포넌트 스타일
  - `main.js` 실험 2(풍선과 털가죽) + 공용 도우미(`el`, `chargeMark`, `place`, `latticeSites`, `createCharges`)
  - `observe.js` 실험 1(마찰 전기 현상 관찰하기). `main.js`의 공용 도우미를 재사용
  - `app.js` 실험 메뉴 전환, 제작자 모달
- `.claude/` : `launch.json`(로컬 미리보기), `settings.json` + `hooks/`(하네스)

## 기술 원칙

- 빌드 도구, 프레임워크, 외부 JS 라이브러리를 쓰지 않는다. 바닐라 JS + Canvas(왼쪽) + SVG(오른쪽).
- 각 시뮬레이션은 폴더 안에서 독립적으로 동작하는 정적 사이트여야 한다.
- 새 파일의 전역 이름이 기존 `main.js`와 충돌하지 않게 주의한다(IIFE로 감싼다).
- 비밀값(API 키, 토큰)을 코드나 커밋에 넣지 않는다.

## 디자인 규칙

- 기준: https://ionformation.vercel.app/ (다크 인디고 배경, 반투명 패널, 인디고 포인트색, 알약형 버튼).
- 색과 반경은 `style.css`의 `:root` 변수만 쓴다. 새로운 톤을 만들지 않는다.
- 375px 폭에서 가로 스크롤이 없어야 한다.

## 개념 정확성 (과학 콘텐츠)

- 개념은 명확해야 한다. 학생에게 오개념을 줄 수 있는 표현, 배치, 설명 문구는 만들지 않는다.
- 최대한 과학적 원리를 올바르게 구현한다. 교육용으로 단순화가 필요하면 원리를 왜곡하지 않는 선에서 하고, 단순화한 부분은 코드 주석이나 문서에 남긴다.

## 작업 흐름

1. 새 기능이나 구조 변경은 `superpowers:brainstorming`으로 설계를 짧게 제시하고 승인받은 뒤 구현한다. 사용자가 방향을 명확히 지시한 작은 수정은 바로 진행해도 된다.
2. 구현 후 브라우저에서 직접 확인한다(아래 체크리스트).
3. 커밋 메시지는 한국어, `feat:` / `fix:` / `docs:` 접두어. 커밋 끝에 `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
4. `main`에 push하면 Vercel이 자동 배포한다. 배포는 `list_deployments`로 READY를 확인하고, 라이브 URL에서 다시 확인한다.
5. 새 시뮬레이션을 추가할 때: 루트에 폴더 생성 → 같은 디자인 토큰, 푸터, 크레딧 모달 재사용 → Vercel 프로젝트를 새로 만들어 Root Directory를 그 폴더로 지정 → 루트 `README.md` 표에 추가.

## 검증 체크리스트

- [ ] 개념이 명확하고 과학적으로 올바른가 (오개념을 줄 표현이나 화면이 없는가)
- [ ] 다시 하기로 처음 상태 복귀
- [ ] 마우스와 터치 모두 동작 (`touch-action: none`)
- [ ] 콘솔 에러 없음, 375px 폭 가로 스크롤 없음
- [ ] 푸터 크레딧과 모달 유지(재배포 시 출처 표기 유지 조건), 모달 열고 닫아도 시뮬레이션 상태 불변
- [ ] push 후 배포 READY, 라이브 URL 동작

## 미리보기 검증 요령

- 로컬 서버: `preview_start`의 `friction-electricity`(포트 5173, `python -m http.server`).
- 코드를 고친 뒤에는 `?v=숫자`를 붙여 다시 열거나 강력 새로고침한다. 안 하면 이전 스크립트가 캐시되어 헷갈린다.
- 가려진 탭에서는 `requestAnimationFrame`이 느리다. 상태를 코드로 직접 진행시켜 검증하고, 스크린샷은 한 번 더 찍어 확인한다.
- 실제 드래그가 필요하면 캔버스에 `PointerEvent`(`pointerdown`, `pointermove`, `pointerup`)를 발생시킨다.

## 자동화 (훅)

- `.claude/settings.json`의 PostToolUse 훅: Edit/Write로 `.js` 파일을 고치면 `.claude/hooks/check-js.mjs`가 `node --check`로 문법을 검사한다.
  - 문법 오류면 exit 2로 Claude에게 오류를 돌려주어 바로 고치게 한다. 정상이거나 `.js`가 아니면 조용히 넘어간다.
  - 새 세션에서 훅이 안 뜨면 `/hooks`를 한 번 열거나 세션을 다시 시작한다.

## 하지 말 것

- 요청하지 않은 기능(점수, 퀴즈, 로그인 등) 추가
- 기존 시뮬레이션 폴더 구조나 배포 설정을 사용자 확인 없이 변경
- repo 생성, 공개 범위 변경, 배포 대상 변경은 사용자에게 확인한 뒤에만
- 크레딧 문구와 모달 삭제(출처 표기 유지가 이용 조건)
