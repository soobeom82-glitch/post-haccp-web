const { sql } = require("@vercel/postgres");

const ensureTables = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS visit_period_stats (
      period_type TEXT NOT NULL,
      period_key TEXT NOT NULL,
      total_visits INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (period_type, period_key)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS visit_daily_city_stats (
      period_key TEXT NOT NULL,
      city TEXT NOT NULL,
      total_visits INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (period_key, city)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS visit_report_dispatches (
      report_type TEXT NOT NULL,
      report_key TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (report_type, report_key)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS interaction_daily_stats (
      period_key TEXT NOT NULL,
      event_name TEXT NOT NULL,
      event_label TEXT NOT NULL,
      page_path TEXT NOT NULL,
      total_events INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (period_key, event_name, event_label, page_path)
    )
  `;
};

const incrementPeriodCount = async (periodType, periodKey, amount) => {
  await sql`
    INSERT INTO visit_period_stats (period_type, period_key, total_visits)
    VALUES (${periodType}, ${periodKey}, ${amount})
    ON CONFLICT (period_type, period_key)
    DO UPDATE SET
      total_visits = visit_period_stats.total_visits + EXCLUDED.total_visits,
      updated_at = NOW()
  `;
};

const incrementCityCount = async (periodKey, city, amount) => {
  await sql`
    INSERT INTO visit_daily_city_stats (period_key, city, total_visits)
    VALUES (${periodKey}, ${city}, ${amount})
    ON CONFLICT (period_key, city)
    DO UPDATE SET
      total_visits = visit_daily_city_stats.total_visits + EXCLUDED.total_visits,
      updated_at = NOW()
  `;
};

const incrementInteractionCount = async (periodKey, eventName, eventLabel, pagePath, amount) => {
  await sql`
    INSERT INTO interaction_daily_stats (period_key, event_name, event_label, page_path, total_events)
    VALUES (${periodKey}, ${eventName}, ${eventLabel}, ${pagePath}, ${amount})
    ON CONFLICT (period_key, event_name, event_label, page_path)
    DO UPDATE SET
      total_events = interaction_daily_stats.total_events + EXCLUDED.total_events,
      updated_at = NOW()
  `;
};

const getPeriodTotal = async (periodType, periodKey) => {
  const { rows } = await sql`
    SELECT total_visits
    FROM visit_period_stats
    WHERE period_type = ${periodType}
      AND period_key = ${periodKey}
    LIMIT 1
  `;

  return rows[0] ? Number(rows[0].total_visits) : 0;
};

const getDailyCityCounts = async (periodKey) => {
  const { rows } = await sql`
    SELECT city, total_visits
    FROM visit_daily_city_stats
    WHERE period_key = ${periodKey}
    ORDER BY total_visits DESC, city ASC
  `;

  return rows.map((row) => ({
    city: String(row.city || "Unknown"),
    count: Number(row.total_visits || 0)
  }));
};

const hasSentReport = async (reportType, reportKey) => {
  const { rows } = await sql`
    SELECT 1
    FROM visit_report_dispatches
    WHERE report_type = ${reportType}
      AND report_key = ${reportKey}
    LIMIT 1
  `;

  return rows.length > 0;
};

const markReportSent = async (reportType, reportKey) => {
  await sql`
    INSERT INTO visit_report_dispatches (report_type, report_key)
    VALUES (${reportType}, ${reportKey})
    ON CONFLICT (report_type, report_key) DO NOTHING
  `;
};

module.exports = {
  ensureTables,
  incrementCityCount,
  incrementInteractionCount,
  incrementPeriodCount,
  getPeriodTotal,
  getDailyCityCounts,
  hasSentReport,
  markReportSent
};
