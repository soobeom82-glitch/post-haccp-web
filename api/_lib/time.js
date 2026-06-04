const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (value) => String(value).padStart(2, "0");

const toKstShifted = (date = new Date()) => new Date(date.getTime() + KST_OFFSET_MS);

const fromDateString = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatDate = (date) => {
  const shifted = toKstShifted(date);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
};

const formatShiftedDate = (date) => (
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
);

const startOfWeek = (date = new Date()) => {
  const shifted = toKstShifted(date);
  const day = shifted.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  return new Date(Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() - diffToMonday
  ));
};

const addDaysToShifted = (shiftedDate, days) => (
  new Date(shiftedDate.getTime() + (days * DAY_MS))
);

const getMonthKey = (date = new Date()) => {
  const shifted = toKstShifted(date);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}`;
};

const parseMonthKey = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  return { year, month };
};

const shiftMonthKey = (monthKey, diff) => {
  const { year, month } = parseMonthKey(monthKey);
  const shifted = new Date(Date.UTC(year, month - 1 + diff, 1));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}`;
};

const daysInMonthFromKey = (monthKey) => {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

const getDailyReportPeriod = (now = new Date()) => {
  const todayShifted = toKstShifted(now);
  const current = formatShiftedDate(addDaysToShifted(todayShifted, -1));
  const previous = formatShiftedDate(addDaysToShifted(todayShifted, -2));
  return { current, previous };
};

const getWeeklyReportPeriod = (now = new Date()) => {
  const thisWeekStart = startOfWeek(now);
  const currentStart = addDaysToShifted(thisWeekStart, -7);
  const previousStart = addDaysToShifted(thisWeekStart, -14);
  const currentEnd = addDaysToShifted(currentStart, 6);
  const previousEnd = addDaysToShifted(previousStart, 6);

  return {
    currentKey: formatShiftedDate(currentStart),
    previousKey: formatShiftedDate(previousStart),
    currentRange: `${formatShiftedDate(currentStart)} ~ ${formatShiftedDate(currentEnd)}`,
    previousRange: `${formatShiftedDate(previousStart)} ~ ${formatShiftedDate(previousEnd)}`
  };
};

const getMonthlyReportPeriod = (now = new Date()) => {
  const currentMonthKey = shiftMonthKey(getMonthKey(now), -1);
  const previousMonthKey = shiftMonthKey(currentMonthKey, -1);

  return {
    currentKey: currentMonthKey,
    previousKey: previousMonthKey
  };
};

module.exports = {
  DAY_MS,
  addDaysToShifted,
  daysInMonthFromKey,
  formatDate,
  formatShiftedDate,
  fromDateString,
  getDailyReportPeriod,
  getMonthlyReportPeriod,
  getMonthKey,
  getWeeklyReportPeriod,
  startOfWeek,
  toKstShifted
};
