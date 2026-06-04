const { buildWeeklyMessage, fetchPeriodHash, sendReportIfNeeded } = require("../_lib/report");
const { getWeeklyReportPeriod } = require("../_lib/time");
const { ensureCronAuthorized } = require("../_lib/cron");

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (!ensureCronAuthorized(req, res)) {
    return;
  }

  try {
    const period = getWeeklyReportPeriod();
    const currentHash = await fetchPeriodHash("stats:week", period.currentKey);
    const previousHash = await fetchPeriodHash("stats:week", period.previousKey);
    const sent = await sendReportIfNeeded({
      sentKey: `reports:weekly:${period.currentKey}`,
      message: buildWeeklyMessage({
        currentRange: period.currentRange,
        previousRange: period.previousRange,
        currentHash,
        previousHash
      })
    });

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, sent }));
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ message: "주간 리포트를 전송하지 못했습니다." }));
  }
};
