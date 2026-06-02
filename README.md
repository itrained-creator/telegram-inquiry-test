# Telegram Inquiry Test App

구매자가 웹 채팅창에서 문의를 보내면 서버를 통해 상점주의 텔레그램으로 전달되고, 상점주가 텔레그램에서 답장하면 구매자 웹 채팅창에 다시 표시되는 테스트용 웹앱입니다.

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

- `public/index.html`: 구매자 채팅 화면
- `server.js`: 채팅 API, 텔레그램 전송, 텔레그램 답장 확인 처리
- `.env`: 봇 토큰과 상점주 chat_id 보관

현재는 A상점 하나만 사용하고, 채팅 세션과 메시지는 서버 메모리에 저장합니다. 실제 서비스로 확장할 때는 `server.js`의 `getStoreConfig()` 부분을 상점 ID 기준 데이터베이스 조회로 바꾸고, 채팅 세션과 메시지도 데이터베이스에 저장하면 됩니다.

테스트 안정성을 위해 현재 채팅 세션은 `chat-sessions.json`에도 보관합니다. Render 재배포처럼 파일 시스템이 초기화되는 상황에서는 기존 웹 채팅 연결이 사라질 수 있으므로 새 채팅을 시작해 주세요.

## 채팅 테스트 방법

1. 웹페이지에서 업소명과 첫 메시지를 입력하고 전송합니다.
2. 상점주 텔레그램으로 문의 메시지가 도착합니다.
3. 상점주는 텔레그램에서 해당 봇 메시지에 답장합니다.
4. 구매자 웹 채팅창에 상점주 답장이 표시됩니다.

상점주가 새 메시지로 그냥 보내면 어떤 웹 채팅방에 답장해야 하는지 알 수 없습니다. 반드시 텔레그램의 답장 기능으로 구매자 메시지에 답장해 주세요.

보조 방식으로 `/reply 대화ID 답장내용` 형식도 지원합니다.

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
