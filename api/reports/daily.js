const {
  buildDailyMessage,
  fetchPeriodStats,
  fetchDailyCityCounts,
  sendReportIfNeeded
} = require("../_lib/report");
const { ensureTables } = require("../_lib/db");
const { getDailyReportPeriod } = require("../_lib/time");
const { ensureCronAuthorized } = require("../_lib/cron");

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (!ensureCronAuthorized(req, res)) {
    return;
  }

  try {
    await ensureTables();
    const { current, previous } = getDailyReportPeriod();
    const currentStats = await fetchPeriodStats("day", current);
    const previousStats = await fetchPeriodStats("day", previous);
    const topCities = await fetchDailyCityCounts(current);
    const sent = await sendReportIfNeeded({
      reportType: "daily",
      reportKey: current,
      message: buildDailyMessage({
        currentKey: current,
        previousKey: previous,
        currentTotal: currentStats.total,
        previousTotal: previousStats.total,
        topCities
      })
    });

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, sent }));
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ message: "일간 리포트를 전송하지 못했습니다." }));
  }
};
