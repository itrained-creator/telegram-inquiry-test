const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const express = require("express");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || "0.0.0.0";

// JSON 요청 body를 읽기 위한 설정입니다.
app.use(express.json());

// public 폴더의 HTML/CSS/JS 파일을 브라우저에 제공합니다.
app.use(express.static(path.join(__dirname, "public")));

const chatSessions = new Map();
const telegramMessageToSession = new Map();
const chatStoreFile = process.env.CHAT_STORE_FILE || path.join(__dirname, "chat-sessions.json");
let telegramUpdateOffset = 0;
let isPollingTelegram = false;

// 지금은 A상점 하나만 사용하지만, 나중에는 이 부분을 DB 조회로 바꾸면 됩니다.
function getStoreConfig() {
  return {
    storeName: "A상점",
    sellerChatId: process.env.TELEGRAM_SELLER_CHAT_ID,
  };
}

function createChatMessage({ sender, text }) {
  return {
    id: crypto.randomUUID(),
    sender,
    text,
    createdAt: new Date().toISOString(),
  };
}

function loadChatSessions() {
  if (!fs.existsSync(chatStoreFile)) {
    return;
  }

  try {
    const savedSessions = JSON.parse(fs.readFileSync(chatStoreFile, "utf8"));

    for (const session of savedSessions) {
      chatSessions.set(session.id, session);

      for (const message of session.messages || []) {
        if (message.telegramMessageId) {
          telegramMessageToSession.set(message.telegramMessageId, session.id);
        }
      }
    }
  } catch (error) {
    console.error("Chat session load failed:", error.message);
  }
}

function saveChatSessions() {
  try {
    fs.writeFileSync(
      chatStoreFile,
      JSON.stringify(Array.from(chatSessions.values()), null, 2)
    );
  } catch (error) {
    console.error("Chat session save failed:", error.message);
  }
}

function buildTelegramMessage({ storeName, sessionId, businessName, message, isNewChat }) {
  const title = isNewChat ? "새 채팅 문의" : "새 웹 채팅 메시지";

  return `[${storeName} ${title}]
대화ID: ${sessionId}
업소명: ${businessName}
문의내용:
${message}

상점주 답장은 이 텔레그램 메시지에 답장으로 남겨주세요.`;
}

async function callTelegramApi(method, body) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN이 .env에 설정되어 있지 않습니다.");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.description || "텔레그램 메시지 전송에 실패했습니다.");
  }

  return data;
}

async function sendTelegramMessage({ chatId, text }) {
  if (!chatId) {
    throw new Error("TELEGRAM_SELLER_CHAT_ID가 .env에 설정되어 있지 않습니다.");
  }

  return callTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
  });
}

function getPublicMessages(session) {
  return session.messages.map(({ id, sender, text, createdAt }) => ({
    id,
    sender,
    text,
    createdAt,
  }));
}

async function forwardBuyerMessageToTelegram({ session, message, isNewChat }) {
  const store = getStoreConfig();
  const telegramText = buildTelegramMessage({
    storeName: store.storeName,
    sessionId: session.id,
    businessName: session.businessName,
    message: message.text,
    isNewChat,
  });

  const telegramResult = await sendTelegramMessage({
    chatId: store.sellerChatId,
    text: telegramText,
  });

  const telegramMessageId = telegramResult.result && telegramResult.result.message_id;

  if (telegramMessageId) {
    telegramMessageToSession.set(telegramMessageId, session.id);
    message.telegramMessageId = telegramMessageId;
  }
}

function findSessionIdFromTelegramReply(telegramMessage) {
  const replyToMessageId =
    telegramMessage.reply_to_message && telegramMessage.reply_to_message.message_id;
  const mappedSessionId = telegramMessageToSession.get(replyToMessageId);

  if (mappedSessionId) {
    return mappedSessionId;
  }

  const repliedText = String(
    telegramMessage.reply_to_message && telegramMessage.reply_to_message.text
  );
  const sessionMatch = repliedText.match(/대화ID:\s*([0-9a-f-]+)/i);

  return sessionMatch && sessionMatch[1];
}

async function handleSellerTelegramMessage(telegramMessage) {
  const store = getStoreConfig();
  const sellerChatId = String(store.sellerChatId || "");
  const incomingChatId = String(telegramMessage.chat && telegramMessage.chat.id);

  if (!sellerChatId || incomingChatId !== sellerChatId) {
    return;
  }

  const text = String(telegramMessage.text || "").trim();

  if (!text) {
    return;
  }

  let sessionId = findSessionIdFromTelegramReply(telegramMessage);
  let replyText = text;

  // 보조 수단: /reply 대화ID 답장내용 형식도 지원합니다.
  const commandMatch = text.match(/^\/reply\s+([0-9a-f-]+)\s+([\s\S]+)/i);
  if (!sessionId && commandMatch) {
    sessionId = commandMatch[1];
    replyText = commandMatch[2].trim();
  }

  const session = chatSessions.get(sessionId);

  if (!session || !replyText) {
    await sendTelegramMessage({
      chatId: sellerChatId,
      text:
        "답장할 웹 채팅을 찾을 수 없습니다. 구매자 메시지에 텔레그램 답장 기능으로 답하거나 /reply 대화ID 답장내용 형식을 사용해 주세요.",
    });
    return;
  }

  session.messages.push(
    createChatMessage({
      sender: "seller",
      text: replyText,
    })
  );
  saveChatSessions();
}

async function pollTelegramReplies() {
  if (isPollingTelegram || !process.env.TELEGRAM_BOT_TOKEN) {
    return;
  }

  isPollingTelegram = true;

  try {
    const data = await callTelegramApi("getUpdates", {
      offset: telegramUpdateOffset || undefined,
      timeout: 0,
      allowed_updates: ["message"],
    });

    for (const update of data.result || []) {
      telegramUpdateOffset = update.update_id + 1;

      if (update.message) {
        await handleSellerTelegramMessage(update.message);
      }
    }
  } catch (error) {
    console.error("Telegram polling failed:", error.message);
  } finally {
    isPollingTelegram = false;
  }
}

async function initializeTelegramOffset() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return;
  }

  try {
    const data = await callTelegramApi("getUpdates", {
      timeout: 0,
      allowed_updates: ["message"],
    });
    const updates = data.result || [];
    const lastUpdate = updates[updates.length - 1];

    if (lastUpdate) {
      telegramUpdateOffset = lastUpdate.update_id + 1;
    }
  } catch (error) {
    console.error("Telegram offset initialization failed:", error.message);
  }
}

async function handleStartChat(req, res) {
  const businessName = String(req.body.businessName || "").trim();
  const text = String(req.body.message || "").trim();

  if (!businessName || !text) {
    return res.status(400).json({
      ok: false,
      error: "업소명과 메시지를 모두 입력해 주세요.",
    });
  }

  const session = {
    id: crypto.randomUUID(),
    businessName,
    messages: [],
    createdAt: new Date().toISOString(),
  };
  const buyerMessage = createChatMessage({ sender: "buyer", text });

  session.messages.push(buyerMessage);
  chatSessions.set(session.id, session);

  try {
    await forwardBuyerMessageToTelegram({
      session,
      message: buyerMessage,
      isNewChat: true,
    });
    saveChatSessions();

    return res.json({
      ok: true,
      sessionId: session.id,
      messages: getPublicMessages(session),
    });
  } catch (error) {
    chatSessions.delete(session.id);
    console.error("Chat start failed:", error.message);

    return res.status(500).json({ ok: false, error: error.message });
  }
}

app.post("/api/chat/start", handleStartChat);

app.post("/api/chat/:sessionId/messages", async (req, res) => {
  const session = chatSessions.get(req.params.sessionId);
  const text = String(req.body.message || "").trim();

  if (!session) {
    return res.status(404).json({ ok: false, error: "채팅방을 찾을 수 없습니다." });
  }

  if (!text) {
    return res.status(400).json({ ok: false, error: "메시지를 입력해 주세요." });
  }

  const buyerMessage = createChatMessage({ sender: "buyer", text });
  session.messages.push(buyerMessage);

  try {
    await forwardBuyerMessageToTelegram({
      session,
      message: buyerMessage,
      isNewChat: false,
    });
    saveChatSessions();

    return res.json({ ok: true, messages: getPublicMessages(session) });
  } catch (error) {
    console.error("Chat message failed:", error.message);

    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/chat/:sessionId/messages", (req, res) => {
  const session = chatSessions.get(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ ok: false, error: "채팅방을 찾을 수 없습니다." });
  }

  return res.json({
    ok: true,
    sessionId: session.id,
    businessName: session.businessName,
    messages: getPublicMessages(session),
  });
});

app.post("/api/inquiry", async (req, res) => {
  return handleStartChat(req, res);
});

app.listen(port, host, () => {
  console.log(`Inquiry test app is running at http://localhost:${port}`);
  loadChatSessions();
  initializeTelegramOffset().then(() => {
    pollTelegramReplies();
    setInterval(pollTelegramReplies, 3000);
  });
});
