const { ensureTables, incrementCityCount, incrementPeriodCount } = require("./_lib/db");
const { formatDate, getMonthKey, startOfWeek } = require("./_lib/time");

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
    res.end(JSON.stringify({ message: "방문 집계 데이터베이스 설정이 아직 완료되지 않았습니다." }));
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
    await ensureTables();
    await Promise.all([
      incrementPeriodCount("day", todayKey, 1),
      incrementCityCount(todayKey, city, 1),
      incrementPeriodCount("week", weekKey, 1),
      incrementPeriodCount("month", monthKey, 1)
    ]);
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
  } catch (error) {
    res.statusCode = 502;
    res.end(JSON.stringify({ message: "방문 집계를 데이터베이스에 저장하지 못했습니다." }));
  }
};
