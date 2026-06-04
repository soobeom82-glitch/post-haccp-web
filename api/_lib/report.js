const { kvGet, kvSet, kvHashGetAll } = require("./kv");
const { daysInMonthFromKey } = require("./time");
const { sendTelegramMessage } = require("./telegram");

const toNumber = (value) => {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const extractTotal = (hash) => toNumber(hash.total);

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

const getTopCities = (hash) => Object.entries(hash)
  .filter(([key]) => key.startsWith("city:"))
  .map(([key, value]) => ({
    city: key.slice(5) || "Unknown",
    count: toNumber(value)
  }))
  .filter((entry) => entry.count > 0)
  .sort((left, right) => right.count - left.count);

const buildDailyMessage = ({ currentKey, previousKey, currentHash, previousHash }) => {
  const currentTotal = extractTotal(currentHash);
  const previousTotal = extractTotal(previousHash);
  const topCities = getTopCities(currentHash);

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

const buildWeeklyMessage = ({ currentRange, previousRange, currentHash, previousHash }) => {
  const currentTotal = extractTotal(currentHash);
  const previousTotal = extractTotal(previousHash);

  return [
    "주간 방문 리포트",
    "",
    `기간: ${currentRange}`,
    `방문자: ${currentTotal}명 (직전 주 ${previousRange} 대비 ${formatDelta(currentTotal, previousTotal)})`,
    `일 평균 방문자: ${formatAverageWithDelta(currentTotal, previousTotal, 7)}`
  ].join("\n");
};

const buildMonthlyMessage = ({ currentKey, previousKey, currentHash, previousHash }) => {
  const currentTotal = extractTotal(currentHash);
  const previousTotal = extractTotal(previousHash);

  return [
    "월간 방문 리포트",
    "",
    `기간: ${currentKey}`,
    `방문자: ${currentTotal}명 (직전 월 ${previousKey} 대비 ${formatDelta(currentTotal, previousTotal)})`,
    `일 평균 방문자: ${formatMonthlyAverageWithDelta(currentTotal, previousTotal, currentKey, previousKey)}`
  ].join("\n");
};

const markReportSent = async (key) => kvSet(key, "1", 60 * 60 * 24 * 400);

const alreadySent = async (key) => {
  const existing = await kvGet(key);
  return Boolean(existing);
};

const fetchPeriodHash = async (prefix, key) => kvHashGetAll(`${prefix}:${key}`);

const sendReportIfNeeded = async ({ sentKey, message }) => {
  if (await alreadySent(sentKey)) {
    return false;
  }

  await sendTelegramMessage(message);
  await markReportSent(sentKey);
  return true;
};

module.exports = {
  buildDailyMessage,
  buildWeeklyMessage,
  buildMonthlyMessage,
  fetchPeriodHash,
  sendReportIfNeeded
};
