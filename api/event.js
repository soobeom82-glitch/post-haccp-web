const { ensureTables, incrementInteractionCount } = require("./_lib/db");

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

  if (!eventName) {
    res.statusCode = 400;
    res.end(JSON.stringify({ message: "이벤트 이름이 필요합니다." }));
    return;
  }

  try {
    await ensureTables();
    await incrementInteractionCount(getKstDateKey(), eventName, eventLabel, pagePath, 1);
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ message: "이벤트를 저장하지 못했습니다." }));
  }
};
