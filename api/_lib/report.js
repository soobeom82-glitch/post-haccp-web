const {
  getDailyCityCounts,
  getPeriodTotal,
  hasSentReport,
  markReportSent
} = require("./db");
const { daysInMonthFromKey } = require("./time");
const { sendTelegramMessage } = require("./telegram");

const formatDelta = (current, previous) => {
  if (previous === 0) {
    if (current === 0) {
      return "0.0%";
    }

    return "+100.0% 이상";
  }

  const diff = ((current - previous) / previous) * 100;
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
};

const formatAverage = (value) => `${value.toFixed(1)}명`;

const formatAverageWithDelta = (currentTotal, previousTotal, days) => {
  const currentAverage = currentTotal / days;
  const previousAverage = previousTotal / days;
  return `${formatAverage(currentAverage)} (직전 평균 ${formatAverage(previousAverage)} / ${formatDelta(currentAverage, previousAverage)})`;
};

const formatMonthlyAverageWithDelta = (currentTotal, previousTotal, currentMonthKey, previousMonthKey) => {
  const currentDays = daysInMonthFromKey(currentMonthKey);
  const previousDays = daysInMonthFromKey(previousMonthKey);
  const currentAverage = currentTotal / currentDays;
  const previousAverage = previousTotal / previousDays;
  return `${formatAverage(currentAverage)} (직전 평균 ${formatAverage(previousAverage)} / ${formatDelta(currentAverage, previousAverage)})`;
};

const buildDailyMessage = ({ currentKey, previousKey, currentTotal, previousTotal, topCities }) => {

  const lines = [
    "일간 방문 리포트",
    "",
    `기간: ${currentKey}`,
    `방문자: ${currentTotal}명 (직전 일 ${previousKey} 대비 ${formatDelta(currentTotal, previousTotal)})`,
    "",
    "도시별 방문자"
  ];

  if (!topCities.length) {
    lines.push("- 집계된 도시 데이터 없음");
  } else {
    topCities.forEach((entry) => {
      lines.push(`- ${entry.city}: ${entry.count}명`);
    });
  }

  return lines.join("\n");
};

const buildWeeklyMessage = ({ currentRange, previousRange, currentTotal, previousTotal }) => {
  return [
    "주간 방문 리포트",
    "",
    `기간: ${currentRange}`,
    `방문자: ${currentTotal}명 (직전 주 ${previousRange} 대비 ${formatDelta(currentTotal, previousTotal)})`,
    `일 평균 방문자: ${formatAverageWithDelta(currentTotal, previousTotal, 7)}`
  ].join("\n");
};

const buildMonthlyMessage = ({ currentKey, previousKey, currentTotal, previousTotal }) => {
  return [
    "월간 방문 리포트",
    "",
    `기간: ${currentKey}`,
    `방문자: ${currentTotal}명 (직전 월 ${previousKey} 대비 ${formatDelta(currentTotal, previousTotal)})`,
    `일 평균 방문자: ${formatMonthlyAverageWithDelta(currentTotal, previousTotal, currentKey, previousKey)}`
  ].join("\n");
};

const fetchPeriodStats = async (periodType, periodKey) => ({
  total: await getPeriodTotal(periodType, periodKey)
});

const sendReportIfNeeded = async ({ reportType, reportKey, message }) => {
  if (await hasSentReport(reportType, reportKey)) {
    return false;
  }

  await sendTelegramMessage(message);
  await markReportSent(reportType, reportKey);
  return true;
};

module.exports = {
  buildDailyMessage,
  buildWeeklyMessage,
  buildMonthlyMessage,
  fetchPeriodStats,
  fetchDailyCityCounts: getDailyCityCounts,
  sendReportIfNeeded
};
