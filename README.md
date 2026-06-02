# Telegram Inquiry Test App

구매자가 웹페이지에서 문의를 작성하면 서버를 통해 상점주의 텔레그램으로 문의를 보내는 테스트용 로컬 웹앱입니다.

## 실행 방법

1. 패키지를 설치합니다.

```bash
npm install
```

2. `.env.example`을 참고해서 `.env` 파일을 만듭니다.

```bash
TELEGRAM_BOT_TOKEN=발급받은_봇_토큰
TELEGRAM_SELLER_CHAT_ID=52669824
PORT=3000
```

3. 서버를 실행합니다.

```bash
npm start
```

4. 브라우저에서 접속합니다.

```text
http://localhost:3000
```

## 현재 구조

- `public/index.html`: 구매자 문의 입력 화면
- `server.js`: 문의 API와 텔레그램 전송 처리
- `.env`: 봇 토큰과 상점주 chat_id 보관

현재는 A상점 하나만 사용합니다. 실제 서비스로 확장할 때는 `server.js`의 `getStoreConfig()` 부분을 상점 ID 기준 데이터베이스 조회로 바꾸면 됩니다.

## 웹에 올려서 테스트하기

Render나 Railway 같은 Node.js 호스팅 서비스에 올리면 로컬 IP나 터널 비밀번호 없이 공개 URL로 테스트할 수 있습니다.

### Render 예시

1. 이 폴더를 GitHub 저장소에 올립니다.
2. Render에서 새 Web Service를 만들고 GitHub 저장소를 연결합니다.
3. Build Command는 아래처럼 둡니다.

```bash
npm install
```

4. Start Command는 아래처럼 둡니다.

```bash
npm start
```

5. Environment Variables에 아래 값을 추가합니다.

```text
TELEGRAM_BOT_TOKEN=발급받은_봇_토큰
TELEGRAM_SELLER_CHAT_ID=52669824
```

6. 배포가 끝나면 Render가 제공하는 공개 URL로 접속해 테스트합니다.
