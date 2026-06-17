const { ensureTables, incrementInteractionCount } = require("./_lib/db");
const {
  detectDeviceType,
  formatEventLabel,
  formatLocationFromHeaders,
  formatPageLabel,
  formatTimestampKst
} = require("./_lib/analytics");
const { sendTelegramMessage } = require("./_lib/telegram");

const getKstDateKey = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(date);
};

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end(JSON.stringify({ message: "Method not allowed" }));
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
  const eventName = String(payload.eventName || "").trim().slice(0, 80);
  const eventLabel = String(payload.eventLabel || "").trim().slice(0, 120) || "-";
  const pagePath = String(payload.path || "").trim().slice(0, 160) || "/";
  const pageTitle = String(payload.pageTitle || "").trim().slice(0, 160) || "-";
  const targetHref = String(payload.targetHref || "").trim().slice(0, 240) || "-";
  const location = formatLocationFromHeaders(req.headers);
  const deviceType = detectDeviceType(req.headers["user-agent"]);

  if (!eventName) {
    res.statusCode = 400;
    res.end(JSON.stringify({ message: "이벤트 이름이 필요합니다." }));
    return;
  }

  try {
    await ensureTables();
    await incrementInteractionCount(getKstDateKey(), eventName, eventLabel, pagePath, 1);

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      const realtimeMessage = [
        "실시간 클릭 로그",
        "",
        `페이지: ${formatPageLabel(pagePath)}`,
        `제목: ${pageTitle}`,
        `버튼: ${formatEventLabel(eventName, eventLabel)}`,
        `이벤트: ${eventName}`,
        `링크: ${targetHref}`,
        `디바이스: ${deviceType}`,
        `위치: ${location}`,
        `시간: ${formatTimestampKst()} KST`
      ].join("\n");

      await sendTelegramMessage(realtimeMessage).catch(() => null);
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
  } catch (error) {
    console.error("api/event failed", {
      message: error instanceof Error ? error.message : "unknown_error",
      eventName,
      eventLabel,
      pagePath,
      targetHref
    });
    res.statusCode = 500;
    res.end(JSON.stringify({ message: "이벤트를 저장하지 못했습니다." }));
  }
};
