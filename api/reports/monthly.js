const { buildMonthlyMessage, fetchPeriodStats, sendReportIfNeeded } = require("../_lib/report");
const { ensureTables } = require("../_lib/db");
const { getMonthlyReportPeriod } = require("../_lib/time");
const { ensureCronAuthorized } = require("../_lib/cron");

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (!ensureCronAuthorized(req, res)) {
    return;
  }

  try {
    await ensureTables();
    const period = getMonthlyReportPeriod();
    const currentStats = await fetchPeriodStats("month", period.currentKey);
    const previousStats = await fetchPeriodStats("month", period.previousKey);
    const sent = await sendReportIfNeeded({
      reportType: "monthly",
      reportKey: period.currentKey,
      message: buildMonthlyMessage({
        currentKey: period.currentKey,
        previousKey: period.previousKey,
        currentTotal: currentStats.total,
        previousTotal: previousStats.total
      })
    });

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, sent }));
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ message: "월간 리포트를 전송하지 못했습니다." }));
  }
};
