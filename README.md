# 미니게임 플랫폼 · 이어 그리기

쉬는 시간에 2~4명이 각자 iPad로 같은 방에 들어가 만화 한 편을 한 칸씩 이어 그리는 게임.

- 요구사항: [docs/PRD.md](docs/PRD.md)
- 결정과 이유: [docs/DECISIONS.md](docs/DECISIONS.md)
- 현재 진행 상황: [STATUS.md](STATUS.md)

## 기술 구성

Vite + React + TypeScript · Convex (실시간 DB, 서버 함수) · Vercel (배포) · GitHub

## 처음 실행하기

```bash
npm install
npx convex dev      # 처음 한 번: 브라우저에서 Convex 로그인 → 새 프로젝트 생성
                    # .env.local과 convex/_generated/가 자동으로 만들어진다
```

`npx convex dev`를 켜 둔 채로 다른 터미널에서:

```bash
npm run dev         # http://localhost:5173
```

"이어 그리기" 홈 화면이 나오면 성공.

### 여러 명 흉내 내기 (T0)

같은 브라우저의 탭은 같은 기기로 취급된다 (기기 정보를 localStorage에 저장하기 때문). 여러 명을 흉내 내려면 **일반 창 + InPrivate(시크릿) 창**, 또는 **서로 다른 브라우저**(Edge, Chrome)를 쓴다.

같은 와이파이의 iPad에서 개발 서버에 접속하려면 `npm run dev -- --host`로 실행하고, 터미널에 나오는 `Network:` 주소로 접속한다.

`npx convex dev`에서 인증서 오류가 나면 (학교 프록시 환경) 인증서 검증을 끄지 말고 다음처럼 실행한다.

```powershell
$env:NODE_OPTIONS="--use-system-ca"; npx convex dev
```

## 비밀값

- `.env.local`은 git에 올라가지 않는다 (`.gitignore`).
- 교사 코드(`TEACHER_PASSCODE`)는 Convex 대시보드 → Settings → Environment Variables에만 넣는다. 개발 배포와 운영(prod) 배포에 각각 넣어야 한다. Vercel에는 넣지 않는다.

## 교사 페이지

`/teacher` (예: 배포 주소 뒤에 `/teacher`). 최근 24시간 안에 끝난 만화를 이미지로 저장한다.

비밀번호 설정: Convex 대시보드 → 프로젝트 → Settings → Environment Variables → `TEACHER_PASSCODE`.
**Development와 Production 배포에 각각** 넣는다 (배포 선택을 바꿔 가며). 8자 이상, 추측하기 어려운 값으로.

## 배포 (Vercel)

개발(로컬)과 운영(Vercel)은 서로 다른 Convex 배포를 쓴다.

| | Convex 배포 | 연결 방법 |
|---|---|---|
| 로컬 개발 | dev | `npx convex dev`가 `.env.local`에 자동 설정 |
| Vercel Production | prod | `CONVEX_DEPLOY_KEY` (Production 키) |
| Vercel Preview | 사용하지 않음 | |

빌드 설정은 `vercel.json`에 있다 (대시보드에서 따로 바꾸지 않는다).
빌드 명령 `npx convex deploy --cmd 'npm run build' ...`가 Convex 함수와 화면을 한 번에 배포하고, `VITE_CONVEX_URL`도 자동으로 넣어 준다.

1. Convex 대시보드 → 프로젝트 → 위쪽 배포 선택에서 **Production** → Settings → **Generate Production Deploy Key** → 복사
2. Vercel → Add New → Project → GitHub 저장소 Import
3. Environment Variables에 `CONVEX_DEPLOY_KEY` = 복사한 키 → Deploy
4. 배포 뒤 Vercel → Settings → Environment Variables에서 `CONVEX_DEPLOY_KEY`가 **Production에만** 체크되어 있는지 확인 (Preview, Development 해제)
5. 확인: 배포 주소에서 방을 만들 수 있는지. 운영 배포라 개발 중 만든 방은 보이지 않는다
