module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end(JSON.stringify({ message: "Method not allowed" }));
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    res.statusCode = 500;
    res.end(JSON.stringify({ message: "텔레그램 연동 설정이 아직 완료되지 않았습니다." }));
    return;
  }

  let body = req.body;

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (error) {
      res.statusCode = 400;
      res.end(JSON.stringify({ message: "잘못된 요청 형식입니다." }));
      return;
    }
  }

  const payload = body && typeof body === "object" ? body : {};
  const path = String(payload.path || "/").trim() || "/";
  const title = String(payload.title || "").trim();
  const referrer = String(payload.referrer || "").trim();
  const refererHost = referrer ? (() => {
    try {
      return new URL(referrer).hostname;
    } catch (error) {
      return referrer;
    }
  })() : "-";

  const forwardedFor = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : String(forwardedFor || "").split(",")[0].trim();
  const userAgent = String(req.headers["user-agent"] || "").trim();
  const country = String(req.headers["x-vercel-ip-country"] || "").trim();
  const region = String(req.headers["x-vercel-ip-country-region"] || "").trim();
  const city = String(req.headers["x-vercel-ip-city"] || "").trim();

  const lines = [
    "새 방문 알림",
    "",
    `페이지: ${path}`,
    `제목: ${title || "-"}`,
    `유입 경로: ${refererHost || "-"}`,
    `위치: ${[country, region, city].filter(Boolean).join(" / ") || "-"}`,
    `IP: ${forwardedIp || "-"}`,
    `브라우저: ${userAgent || "-"}`
  ];

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n")
      })
    });

    const telegramResult = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramResult.ok) {
      throw new Error("telegram_send_failed");
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
  } catch (error) {
    res.statusCode = 502;
    res.end(JSON.stringify({ message: "방문 알림을 전송하지 못했습니다." }));
  }
};
