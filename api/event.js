const { ensureTables, incrementInteractionEvent } = require("./_lib/db");
const { formatDate } = require("./_lib/time");

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end(JSON.stringify({ message: "Method not allowed" }));
    return;
  }

  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    res.statusCode = 500;
    res.end(JSON.stringify({ message: "이벤트 집계 데이터베이스 설정이 아직 완료되지 않았습니다." }));
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
  const eventName = String(payload.eventName || "").trim();

  if (!eventName) {
    res.statusCode = 400;
    res.end(JSON.stringify({ message: "이벤트 이름이 필요합니다." }));
    return;
  }

  try {
    await ensureTables();
    await incrementInteractionEvent(formatDate(), eventName, 1);
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
  } catch (error) {
    res.statusCode = 502;
    res.end(JSON.stringify({ message: "이벤트 집계를 저장하지 못했습니다." }));
  }
};
