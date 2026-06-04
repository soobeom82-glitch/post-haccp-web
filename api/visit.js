const { kvHashIncrement } = require("./_lib/kv");
const { formatDate, getMonthKey, startOfWeek } = require("./_lib/time");

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end(JSON.stringify({ message: "Method not allowed" }));
    return;
  }

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    res.statusCode = 500;
    res.end(JSON.stringify({ message: "방문 집계 저장소 설정이 아직 완료되지 않았습니다." }));
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
  const city = String(req.headers["x-vercel-ip-city"] || "").trim() || "Unknown";
  const todayKey = formatDate();
  const weekKey = formatDate(startOfWeek());
  const monthKey = getMonthKey();

  try {
    await Promise.all([
      kvHashIncrement(`stats:day:${todayKey}`, "total", 1),
      kvHashIncrement(`stats:day:${todayKey}`, `city:${city}`, 1),
      kvHashIncrement(`stats:week:${weekKey}`, "total", 1),
      kvHashIncrement(`stats:month:${monthKey}`, "total", 1)
    ]);
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
  } catch (error) {
    res.statusCode = 502;
    res.end(JSON.stringify({ message: "방문 집계를 저장하지 못했습니다." }));
  }
};
