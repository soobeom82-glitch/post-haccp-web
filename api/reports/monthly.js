const { buildMonthlyMessage, fetchPeriodHash, sendReportIfNeeded } = require("../_lib/report");
const { getMonthlyReportPeriod } = require("../_lib/time");
const { ensureCronAuthorized } = require("../_lib/cron");

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (!ensureCronAuthorized(req, res)) {
    return;
  }

  try {
    const period = getMonthlyReportPeriod();
    const currentHash = await fetchPeriodHash("stats:month", period.currentKey);
    const previousHash = await fetchPeriodHash("stats:month", period.previousKey);
    const sent = await sendReportIfNeeded({
      sentKey: `reports:monthly:${period.currentKey}`,
      message: buildMonthlyMessage({
        currentKey: period.currentKey,
        previousKey: period.previousKey,
        currentHash,
        previousHash
      })
    });

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, sent }));
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ message: "월간 리포트를 전송하지 못했습니다." }));
  }
};
