const {
  getDailyCityCounts,
  getInteractionCountsForDateRange,
  getInteractionCountsForMonth,
  getInteractionCountsForPeriodKey,
  getPeriodTotal,
  hasSentReport,
  markReportSent
} = require("./db");
const { daysInMonthFromKey, fromDateString, formatShiftedDate, addDaysToShifted } = require("./time");
const { sendTelegramMessage } = require("./telegram");

const INTERACTION_GROUPS = [
  {
    key: "ctaClicks",
    label: "상담 CTA 클릭",
    events: [
      "nav_contact_click",
      "hero_primary_click",
      "hero_secondary_click",
      "promo_primary_click",
      "promo_visual_click",
      "floating_contact_click",
      "subpage_gwanggyo_cta_click",
      "subpage_guri_cta_click",
      "subpage_dongtan_cta_click",
      "subpage_haccp_support_cta_click",
      "subpage_food_consulting_cta_click"
    ]
  },
  {
    key: "phoneClicks",
    label: "전화 클릭",
    events: [
      "header_phone_click",
      "hero_phone_click",
      "contact_phone_click",
      "floating_call_click"
    ]
  },
  {
    key: "formStarts",
    label: "폼 입력 시작",
    events: [
      "contact_form_start"
    ]
  },
  {
    key: "formSubmits",
    label: "상담 접수 완료",
    events: [
      "contact_form_submit_success"
    ]
  },
  {
    key: "branchDetailClicks",
    label: "지점 상세 보기",
    events: [
      "branch_gwanggyo_detail_click",
      "branch_guri_detail_click",
      "branch_dongtan_detail_click",
      "search_gwanggyo_detail_click",
      "search_guri_detail_click",
      "search_dongtan_detail_click"
    ]
  }
];

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

const toEventMap = (rows) => (
  rows.reduce((accumulator, row) => {
    accumulator[row.eventName] = row.count;
    return accumulator;
  }, {})
);

const summarizeInteractions = (rows) => {
  const eventMap = toEventMap(rows);

  return INTERACTION_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    count: group.events.reduce((total, eventName) => total + (eventMap[eventName] || 0), 0)
  }));
};

const buildInteractionLines = (currentRows, previousRows) => {
  const currentSummary = summarizeInteractions(currentRows);
  const previousSummary = summarizeInteractions(previousRows);
  const previousMap = previousSummary.reduce((accumulator, entry) => {
    accumulator[entry.key] = entry.count;
    return accumulator;
  }, {});

  return currentSummary.map((entry) => (
    `- ${entry.label}: ${entry.count}회 (직전 대비 ${formatDelta(entry.count, previousMap[entry.key] || 0)})`
  ));
};

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

const buildDailyMessage = ({
  currentKey,
  previousKey,
  currentTotal,
  previousTotal,
  topCities,
  currentInteractions,
  previousInteractions
}) => {
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

  const interactionLines = buildInteractionLines(currentInteractions || [], previousInteractions || []);

  lines.push("", "문의 행동");
  lines.push(...interactionLines);

  return lines.join("\n");
};

const buildWeeklyMessage = ({ currentRange, previousRange, currentTotal, previousTotal, currentInteractions, previousInteractions }) => {
  const lines = [
    "주간 방문 리포트",
    "",
    `기간: ${currentRange}`,
    `방문자: ${currentTotal}명 (직전 주 ${previousRange} 대비 ${formatDelta(currentTotal, previousTotal)})`,
    `일 평균 방문자: ${formatAverageWithDelta(currentTotal, previousTotal, 7)}`
  ];

  lines.push("", "문의 행동");
  lines.push(...buildInteractionLines(currentInteractions, previousInteractions));

  return lines.join("\n");
};

const buildMonthlyMessage = ({ currentKey, previousKey, currentTotal, previousTotal, currentInteractions, previousInteractions }) => {
  const lines = [
    "월간 방문 리포트",
    "",
    `기간: ${currentKey}`,
    `방문자: ${currentTotal}명 (직전 월 ${previousKey} 대비 ${formatDelta(currentTotal, previousTotal)})`,
    `일 평균 방문자: ${formatMonthlyAverageWithDelta(currentTotal, previousTotal, currentKey, previousKey)}`
  ];

  lines.push("", "문의 행동");
  lines.push(...buildInteractionLines(currentInteractions, previousInteractions));

  return lines.join("\n");
};

const fetchPeriodStats = async (periodType, periodKey) => ({
  total: await getPeriodTotal(periodType, periodKey)
});

const getWeekEndKey = (startKey) => {
  const startDate = fromDateString(startKey);
  return formatShiftedDate(addDaysToShifted(startDate, 6));
};

const fetchDailyInteractionStats = async (periodKey) => getInteractionCountsForPeriodKey(periodKey);

const fetchWeeklyInteractionStats = async (startKey) => (
  getInteractionCountsForDateRange(startKey, getWeekEndKey(startKey))
);

const fetchMonthlyInteractionStats = async (monthKey) => getInteractionCountsForMonth(monthKey);

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
  fetchDailyInteractionStats,
  fetchWeeklyInteractionStats,
  fetchMonthlyInteractionStats,
  sendReportIfNeeded
};
