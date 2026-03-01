# A lonely green slime

웹 기반 슬라임 생존 게임입니다.

**버전**: `src/config/constants.js`의 `GAME_VERSION`만 바꾸면 메뉴·설정 화면과 `index.html` 메타에 반영됩니다. 배포 전 해당 값과 `index.html`의 `<meta name="version">`을 맞춰 주세요.

## 디렉터리 구조

- **루트**: 게임 프론트엔드 (`index.html`, `src/`, `assets/`)
- **backend/**: Django 프로젝트 (점수·피드백 API, `scores`, `feedback` 앱)

### 추후 추가 예정