# 플레이 로그 수집 가이드

이 문서는 회원가입 없이 수집하는 플레이 로그의 동작 원리, `playlogs_playlog` 테이블 칼럼 의미, 난이도 밸런스 개선에 활용하는 방법을 정리한다.

## 1) 구현 흐름 (Frontend -> Backend -> DB)

### 1.1 식별자 생성
- 프론트엔드(`src/api/scoreApi.js`)에서 브라우저 `localStorage`를 사용해 식별자를 만든다.
- `anonymous_id`: `anon_1`, `anon_2` 같은 유저 단위 단순 ID
- `run_id`: `run_1`, `run_2` 같은 판(run) 단위 단순 ID
- `anonymous_id`는 재방문 시 유지되고, `run_id`는 새 게임 시작 때 증가한다.

### 1.2 플레이 중 수집 (메모리)
- `GameScene`에서 게임 진행 중 로그를 메모리 변수에 누적한다.
- 피격 카운트:
  - `contact_hits` (본체 접촉 피격)
  - `projectile_hits` (발사체 피격)
  - `shooter_contact_hits` / `shooter_projectile_hits` (shooter 관련 피격)
- 1분 스냅샷:
  - `elapsedTime`이 60초, 120초, 180초...를 넘을 때마다 스냅샷 추가
  - 스냅샷 항목: `t_sec`, `minute`, `hp`, `max_hp`, `cells`, `attack`, `badges`, `kills`

### 1.3 게임 종료 시 전송
- `endGame()`에서 `submitPlayLog(payload)`를 호출한다.
- `payload`를 JSON으로 `POST /api/playlogs/`에 전송한다.
- 전송 데이터는 시작/종료 시각, 플레이 시간, 피격 통계, 킬/점수, 스냅샷 배열을 포함한다.

### 1.4 백엔드 저장
- Django `playlogs` 앱의 `playlog_create` 뷰가 요청을 받는다.
- 숫자/날짜/스냅샷을 sanitize한 뒤 `update_or_create(anonymous_id, run_id)`로 저장한다.
- 결과적으로 한 유저의 한 run은 1행으로 저장된다.

## 2) `playlogs_playlog` 테이블 칼럼 설명

| 칼럼 | 타입 | 의미 |
|---|---|---|
| `id` | bigint PK | 로그 행 ID |
| `anonymous_id` | varchar(64), index | 브라우저 단위 익명 유저 ID (`anon_n`) |
| `run_id` | varchar(64), index | 한 판(run) 식별자 (`run_n`) |
| `started_at` | datetime, nullable | 게임 시작 시각(프론트 기준 ISO 문자열) |
| `ended_at` | datetime, nullable | 게임 종료 시각 |
| `play_seconds` | float | 총 플레이 시간(초) |
| `contact_hits` | unsigned int | 본체 접촉 피격 횟수 |
| `projectile_hits` | unsigned int | 발사체 피격 횟수 |
| `shooter_contact_hits` | unsigned int | shooter 본체 접촉 피격 횟수 |
| `shooter_projectile_hits` | unsigned int | shooter 발사체 피격 횟수 |
| `kills_total` | unsigned int | 총 처치 수 |
| `final_score` | int | 최종 점수 |
| `is_clear` | bool | 15분 도달(클리어 달성) 여부 |
| `snapshots` | JSON | 1분 단위 스냅샷 배열 |
| `created_at` | datetime | 서버 저장 시각 |

추가 제약:
- `(anonymous_id, run_id)` 유니크 제약
  - 같은 run이 재전송되면 행을 새로 만들지 않고 업데이트한다.

## 3) `snapshots` JSON 구조

`snapshots`는 아래 객체들의 배열이다.

```json
{
  "t_sec": 300,
  "minute": 5,
  "hp": 4,
  "max_hp": 8,
  "cells": 5,
  "attack": 32,
  "badges": ["critical", "runner"],
  "kills": 148
}
```

## 4) 개발자가 로그를 활용하는 방법 (예시)

### 4.1 난이도 곡선 점검
- `play_seconds` 분포로 이탈 구간 파악
  - 예: 6~9분 구간에서 급격히 많이 죽으면 중반 스파이크 의심
- `is_clear` 비율로 목표 난이도 확인
  - 예: 클리어율이 과도하게 낮으면 후반 압박 완화 필요

### 4.2 피격 원인 분석
- `contact_hits` vs `projectile_hits` 비교로 사망 주원인 분리
- `shooter_*` 비중이 높으면 shooter 탄속/쿨다운/등장비율 조정 검토

### 4.3 성장 대비 생존력 분석
- 스냅샷에서 `minute`별 `hp`, `cells`, `attack`, `kills` 추세 확인
- 같은 시간대라도 성장치가 높은데 사망이 빠르면 적 HP/스폰/원거리 압박 과다 가능성

### 4.4 뱃지 밸런스 검증
- 스냅샷 `badges`와 `play_seconds`/`final_score`를 함께 보면
  - 특정 뱃지 조합 과강/과약
  - 리스크-리턴 뱃지(`regen`, `blood_hungry`) 체감 난이도
  를 실데이터로 확인할 수 있다.

## 5) 운영 팁

- 현재 방식은 비회원 기반의 익명 로그라 기기/브라우저가 바뀌면 다른 유저로 잡히는 한계가 존재한다.
- 밸런스 조정 목적에는 충분히 유효하며, 구현/운영 비용이 낮다.
- 분석 정확도를 높이려면 날짜 범위(패치 전/후)로 나눠 비교하는 것을 권장한다.
