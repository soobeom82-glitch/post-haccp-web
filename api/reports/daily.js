const { buildDailyMessage, fetchPeriodHash, sendReportIfNeeded } = require("../_lib/report");
const { getDailyReportPeriod } = require("../_lib/time");
const { ensureCronAuthorized } = require("../_lib/cron");

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (!ensureCronAuthorized(req, res)) {
    return;
  }

  try {
    const { current, previous } = getDailyReportPeriod();
    const currentHash = await fetchPeriodHash("stats:day", current);
    const previousHash = await fetchPeriodHash("stats:day", previous);
    const sent = await sendReportIfNeeded({
      sentKey: `reports:daily:${current}`,
      message: buildDailyMessage({
        currentKey: current,
        previousKey: previous,
        currentHash,
        previousHash
      })
    });

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, sent }));
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ message: "일간 리포트를 전송하지 못했습니다." }));
  }
};
