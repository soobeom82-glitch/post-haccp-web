const formatTimestampKst = (date = new Date()) => {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
};

const pageNameMap = {
  "/": "메인 랜딩",
  "/index.html": "메인 랜딩",
  "/gwanggyo-haccp-facility.html": "광교점 상세",
  "/guri-branch.html": "구리점 상세",
  "/dongtan-branch.html": "동탄점 상세",
  "/haccp-preparation-support.html": "HACCP 준비 지원",
  "/food-manufacturing-consulting.html": "식품 제조 상담"
};

const eventNameMap = {
  nav_contact_click: "상단 메뉴 CTA 클릭",
  header_kakao_click: "상단 카카오톡 문의 클릭",
  header_phone_click: "상단 대표 상담 전화 클릭",
  hero_primary_click: "히어로 주요 CTA 클릭",
  hero_secondary_click: "히어로 보조 CTA 클릭",
  hero_phone_click: "히어로 전화 CTA 클릭",
  promo_primary_click: "중단 프로모션 주요 CTA 클릭",
  promo_secondary_click: "중단 프로모션 보조 CTA 클릭",
  promo_image_click: "중단 프로모션 이미지 클릭",
  branch_detail_click: "지점 상세 보기 클릭",
  facility_tab_click: "시설 탭 클릭",
  search_entry_click: "안내 카드 CTA 클릭",
  contact_submit_click: "문의 폼 제출 버튼 클릭",
  contact_phone_click: "문의 섹션 전화 클릭",
  contact_kakao_click: "문의 섹션 카카오톡 클릭",
  floating_call_click: "플로팅 전화 클릭",
  floating_kakao_click: "플로팅 카카오톡 클릭",
  floating_contact_click: "플로팅 문의 클릭",
  contact_form_start: "문의 폼 입력 시작",
  contact_form_submit_success: "문의 폼 제출 완료",
  generic_button_click: "일반 버튼 클릭",
  generic_link_click: "일반 링크 클릭"
};

const formatPageLabel = (path = "/") => {
  const safePath = String(path || "/").trim() || "/";
  const pageName = pageNameMap[safePath] || safePath;

  return `${pageName} (${safePath})`;
};

const formatEventLabel = (eventName, fallbackLabel = "-") => {
  const safeEventName = String(eventName || "").trim();
  const mapped = eventNameMap[safeEventName];
  const safeFallback = String(fallbackLabel || "-").trim() || "-";

  return mapped ? `${mapped} / ${safeFallback}` : safeFallback;
};

const formatLocationFromHeaders = (headers = {}) => {
  const country = String(headers["x-vercel-ip-country"] || "").trim() || "Unknown";
  const region = String(headers["x-vercel-ip-country-region"] || "").trim() || "-";
  const city = String(headers["x-vercel-ip-city"] || "").trim() || "Unknown";

  return `${country} / ${region} / ${city}`;
};

const formatReferrer = (referrer = "") => {
  const safeReferrer = String(referrer || "").trim();

  if (!safeReferrer) {
    return "직접 유입";
  }

  try {
    const url = new URL(safeReferrer);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch (error) {
    return safeReferrer;
  }
};

const detectDeviceType = (userAgent = "") => {
  const safeUa = String(userAgent || "");

  if (!safeUa) {
    return "Unknown";
  }

  if (/Mobi|Android|iPhone|iPad|iPod/i.test(safeUa)) {
    return "모바일";
  }

  return "데스크톱";
};

module.exports = {
  detectDeviceType,
  formatEventLabel,
  formatLocationFromHeaders,
  formatPageLabel,
  formatReferrer,
  formatTimestampKst
};
