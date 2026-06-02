const path = require("path");
const express = require("express");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || "0.0.0.0";

// JSON 요청 body를 읽기 위한 설정입니다.
app.use(express.json());

// public 폴더의 HTML/CSS/JS 파일을 브라우저에 제공합니다.
app.use(express.static(path.join(__dirname, "public")));

// 지금은 A상점 하나만 사용하지만, 나중에는 이 부분을 DB 조회로 바꾸면 됩니다.
function getStoreConfig() {
  return {
    storeName: "A상점",
    sellerChatId: process.env.TELEGRAM_SELLER_CHAT_ID,
  };
}

function buildTelegramMessage({ storeName, businessName, message }) {
  return `[${storeName} 새 문의]
업소명: ${businessName}
문의내용:
${message}`;
}

async function sendTelegramMessage({ chatId, text }) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN이 .env에 설정되어 있지 않습니다.");
  }

  if (!chatId) {
    throw new Error("TELEGRAM_SELLER_CHAT_ID가 .env에 설정되어 있지 않습니다.");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.description || "텔레그램 메시지 전송에 실패했습니다.");
  }

  return data;
}

app.post("/api/inquiry", async (req, res) => {
  const businessName = String(req.body.businessName || "").trim();
  const message = String(req.body.message || "").trim();

  // 빈 값은 텔레그램으로 보내지 않고 바로 안내합니다.
  if (!businessName || !message) {
    return res.status(400).json({
      ok: false,
      error: "업소명과 문의 내용을 모두 입력해 주세요.",
    });
  }

  try {
    const store = getStoreConfig();
    const telegramText = buildTelegramMessage({
      storeName: store.storeName,
      businessName,
      message,
    });

    await sendTelegramMessage({
      chatId: store.sellerChatId,
      text: telegramText,
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error("Inquiry failed:", error.message);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.listen(port, host, () => {
  console.log(`Inquiry test app is running at http://localhost:${port}`);
});
