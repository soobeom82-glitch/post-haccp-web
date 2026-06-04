const sendTelegramMessage = async (text) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error("telegram_not_configured");
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error("telegram_send_failed");
  }

  return result;
};

module.exports = {
  sendTelegramMessage
};
