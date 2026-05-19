# 테트리스 배포 가이드

이 게임은 **프론트엔드(정적 파일)**와 **백엔드(FastAPI 서버)** 두 부분으로 구성됩니다.  
각각 따로 배포해야 하며, 배포 후 프론트엔드가 백엔드 주소를 알도록 설정을 한 번 바꿔줘야 합니다.

---

## 목차

1. [로컬에서 실행하기 (배포 전 테스트)](#1-로컬에서-실행하기)
2. [백엔드 배포 — Render](#2-백엔드-배포--render)
3. [프론트엔드 배포 — GitHub Pages](#3-프론트엔드-배포--github-pages)
4. [배포 후 연결 설정](#4-배포-후-연결-설정)

---

## 1. 로컬에서 실행하기

배포 전에 내 컴퓨터에서 먼저 잘 돌아가는지 확인합니다.

### 필요한 것
- Python 3.10 이상
- 터미널(명령 프롬프트 / PowerShell / bash)

### 백엔드 실행

```bash
# 1. 백엔드 폴더로 이동
cd day02/tetris/backend

# 2. 패키지 설치 (최초 1회만)
pip install -r requirements.txt

# 3. 서버 시작
uvicorn main:app --reload
```

> 브라우저에서 `http://localhost:8000/docs` 를 열면 API 목록을 확인할 수 있습니다.

### 프론트엔드 실행 (별도 터미널)

```bash
# tetris 폴더에서
cd day02/tetris
python3 -m http.server 8765
```

브라우저에서 `http://localhost:8765/index.html` 접속.

---

## 2. 백엔드 배포 — Render

[Render](https://render.com)는 FastAPI 서버를 **무료**로 배포할 수 있는 서비스입니다.

### 2-1. 사전 준비

1. [https://render.com](https://render.com) 에 GitHub 계정으로 가입
2. 이 프로젝트가 GitHub에 올라가 있어야 합니다 (private도 가능)

### 2-2. 새 Web Service 만들기

1. Render 대시보드 → **New → Web Service** 클릭
2. 배포할 GitHub 저장소 선택 → **Connect**
3. 아래 설정값 입력:

| 항목 | 값 |
|------|-----|
| **Name** | `tetris-api` (원하는 이름) |
| **Region** | Singapore (한국과 가장 가까움) |
| **Branch** | `main` |
| **Root Directory** | `src/exercise/ksl3011/day02/tetris/backend` |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Instance Type** | `Free` |

4. **Create Web Service** 클릭

### 2-3. 배포 확인

- 배포가 완료되면 `https://tetris-api-xxxx.onrender.com` 형태의 URL이 생깁니다.
- 이 URL + `/docs` (예: `https://tetris-api-xxxx.onrender.com/docs`) 에 접속해서 API가 뜨면 성공.

> **주의**: Render 무료 플랜은 15분간 요청이 없으면 서버가 잠들었다가 다음 요청 시 30~60초 후에 깨어납니다. 첫 접속이 느린 건 정상입니다.

---

## 3. 프론트엔드 배포 — GitHub Pages

HTML/CSS/JS 정적 파일은 GitHub Pages로 무료 배포합니다.

### 3-1. 별도 저장소로 배포하는 경우 (권장)

1. GitHub에 새 저장소 생성 (예: `tetris-game`)
2. `day02/tetris/` 폴더 내용물을 그 저장소에 복사해서 push
3. 저장소 → **Settings → Pages → Source: Deploy from a branch → Branch: main / (root)** 선택
4. 저장 후 1~2분 기다리면 `https://<username>.github.io/tetris-game/` 으로 접속 가능

### 3-2. 모노레포에서 배포하는 경우

현재 저장소(`weable-kosa/kosa-vibecoding-2026-2nd`)에서 특정 폴더만 Pages로 배포하려면 GitHub Actions가 필요합니다.  
간단히 하려면 3-1 방법(별도 저장소)을 쓰세요.

---

## 4. 배포 후 연결 설정

프론트엔드가 로컬 백엔드(`localhost:8000`)가 아닌 **배포된 백엔드**를 바라보도록 한 줄을 수정해야 합니다.

### 수정 파일: `api.js` 3번째 줄

```js
// 수정 전 (로컬 개발용)
const BASE = 'http://localhost:8000';

// 수정 후 (배포된 Render URL로 교체)
const BASE = 'https://tetris-api-xxxx.onrender.com';
```

`xxxx` 부분은 Render에서 생성된 실제 URL로 바꾸면 됩니다.

수정 후 저장 → GitHub에 push → GitHub Pages가 자동으로 반영됩니다 (1~2분 소요).

---

## 전체 흐름 요약

```
[내 컴퓨터]
  ↓ git push
[GitHub 저장소]
  ├── backend/ → Render가 자동 감지 → https://tetris-api-xxxx.onrender.com
  └── 나머지  → GitHub Pages → https://<username>.github.io/tetris-game/
                                    ↓ api.js의 BASE 주소를 Render URL로 설정
                               [브라우저] ←→ [Render 백엔드]
```

---

## 자주 묻는 문제

**Q. 회원가입/로그인이 안 돼요**  
A. `api.js`의 `BASE` 주소가 배포된 백엔드 URL인지 확인하세요. `localhost:8000`이면 로컬에서만 작동합니다.

**Q. Render에서 "Build failed" 오류가 나요**  
A. Root Directory 설정이 `src/exercise/ksl3011/day02/tetris/backend` 인지 확인하세요.

**Q. 게임은 되는데 점수가 저장 안 돼요**  
A. 로그인이 되어있는지, 브라우저 콘솔(F12)에 CORS 오류가 없는지 확인하세요.  
Render 백엔드가 잠들어 있을 수 있으니 `/docs` 페이지를 먼저 열어 깨워두세요.

**Q. SQLite 데이터가 사라졌어요**  
A. Render 무료 플랜은 디스크 데이터가 재배포 시 초기화됩니다. 데이터를 영구 보존하려면 Render의 유료 Persistent Disk 옵션이나 외부 DB(PostgreSQL 등)로 전환해야 합니다.
