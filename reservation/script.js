const DEFAULT_ROOM_OPTIONS = Array.from({ length: 8 }, (_, index) => `생산실${index + 1}`);
const DEFAULT_HOURS = Array.from({ length: 24 }, (_, index) => index);
const DEFAULT_ACCOUNT_SETTINGS = DEFAULT_ROOM_OPTIONS.map((roomId) => ({
  roomId,
  isActive: true,
  hasPassword: false,
  pinResetRequired: false
}));
const DEFAULT_LOGIN_ACCOUNTS = [
  ...DEFAULT_ACCOUNT_SETTINGS.map((account) => ({
    ...account,
    needsSetup: true,
    canLogin: false
  })),
  {
    roomId: "관리자",
    isActive: true,
    hasPassword: false,
    pinResetRequired: false,
    needsSetup: true,
    canLogin: false
  }
];

const ROOM_SLOT_COLORS = {
  생산실1: {
    bg: "#d8efff",
    accent: "#4d96d9",
    text: "#184867",
    note: "#3a6885"
  },
  생산실2: {
    bg: "#e3f6d6",
    accent: "#6cae42",
    text: "#29521a",
    note: "#507343"
  },
  생산실3: {
    bg: "#fff1c8",
    accent: "#c89a2e",
    text: "#63480d",
    note: "#876a2b"
  },
  생산실4: {
    bg: "#fde0df",
    accent: "#d57876",
    text: "#6d2e2d",
    note: "#8d5d5b"
  },
  생산실5: {
    bg: "#ece4ff",
    accent: "#8a6bd0",
    text: "#46306f",
    note: "#685589"
  },
  생산실6: {
    bg: "#def5f0",
    accent: "#4ba99a",
    text: "#1f5950",
    note: "#4a7a73"
  },
  생산실7: {
    bg: "#ffe1ed",
    accent: "#d36d97",
    text: "#6e2948",
    note: "#90566f"
  },
  생산실8: {
    bg: "#ebe9de",
    accent: "#8b8561",
    text: "#4f4a31",
    note: "#6d684e"
  },
  관리자: {
    bg: "#dceee5",
    accent: "#4b8b68",
    text: "#1f4c37",
    note: "#4a6f5d"
  }
};

const state = {
  roomOptions: [...DEFAULT_ROOM_OPTIONS, "관리자"],
  accountSettings: DEFAULT_ACCOUNT_SETTINGS.map((account) => ({ ...account })),
  loginAccounts: DEFAULT_LOGIN_ACCOUNTS.map((account) => ({ ...account })),
  hours: [...DEFAULT_HOURS],
  today: "",
  weekStart: "",
  weekDates: [],
  bookings: [],
  authenticated: false,
  isAdmin: false,
  roomId: "",
  expiresAt: null,
  sessionMaxAgeSeconds: 300,
  selectedKeys: [],
  pendingAction: "",
  setupRequired: false,
  adminMenuOpen: false,
  adminMenuBusyRoomId: "",
  refreshTimer: null,
  countdownTimer: null,
  timeLineTimer: null
};

const elements = {
  calendarStage: document.querySelector("#calendar-stage"),
  weekRangeLabel: document.querySelector("#week-range-label"),
  calendarGrid: document.querySelector("#calendar-grid"),
  prevWeekButton: document.querySelector("#prev-week-button"),
  nextWeekButton: document.querySelector("#next-week-button"),
  todayButton: document.querySelector("#today-button"),
  sessionChip: document.querySelector("#session-chip"),
  sessionChipMain: document.querySelector("#session-chip-main"),
  sessionChipDetail: document.querySelector("#session-chip-detail"),
  adminMenuButton: document.querySelector("#admin-menu-button"),
  adminMenu: document.querySelector("#admin-menu"),
  adminMenuList: document.querySelector("#admin-menu-list"),
  adminMenuStatus: document.querySelector("#admin-menu-status"),
  boardStatusChip: document.querySelector("#board-status-chip"),
  boardStatusMain: document.querySelector("#board-status-main"),
  boardStatusDetail: document.querySelector("#board-status-detail"),
  headerLoginButton: document.querySelector("#header-login-button"),
  headerLogoutButton: document.querySelector("#header-logout-button"),
  currentTimeLine: document.querySelector("#current-time-line"),
  currentTimeLabel: document.querySelector("#current-time-label"),
  actionBar: document.querySelector("#action-bar"),
  actionSummaryMain: document.querySelector("#action-summary-main"),
  actionSummaryDetail: document.querySelector("#action-summary-detail"),
  clearSelectionButton: document.querySelector("#clear-selection-button"),
  bulkCancelButton: document.querySelector("#bulk-cancel-button"),
  bulkModifyButton: document.querySelector("#bulk-modify-button"),
  bulkReserveButton: document.querySelector("#bulk-reserve-button"),
  modalBackdrop: document.querySelector("#slot-modal-backdrop"),
  slotModalTitle: document.querySelector("#slot-modal-title"),
  modalCloseButton: document.querySelector("#modal-close-button"),
  modalDismissButton: document.querySelector("#modal-dismiss-button"),
  slotSummaryCard: document.querySelector("#slot-summary-card"),
  slotSummaryLabel: document.querySelector("#slot-summary-label"),
  slotSummarySubtext: document.querySelector("#slot-summary-subtext"),
  modalInfoCard: document.querySelector("#modal-info-card"),
  modalInfoTitle: document.querySelector("#modal-info-title"),
  modalInfoText: document.querySelector("#modal-info-text"),
  slotLoginForm: document.querySelector("#slot-login-form"),
  loginAccountList: document.querySelector("#login-account-list"),
  loginRoomId: document.querySelector("#login-room-id"),
  loginPin: document.querySelector("#login-pin"),
  loginConfirmField: document.querySelector("#login-confirm-field"),
  loginConfirmPin: document.querySelector("#login-confirm-pin"),
  loginSubmitButton: document.querySelector("#login-submit-button"),
  slotReserveForm: document.querySelector("#slot-reserve-form"),
  reserveRoomField: document.querySelector("#reserve-room-field"),
  reserveRoomId: document.querySelector("#reserve-room-id"),
  reserveNote: document.querySelector("#reserve-note"),
  reserveSubmitButton: document.querySelector("#reserve-submit-button"),
  modalBookingActions: document.querySelector("#modal-booking-actions"),
  cancelBookingButton: document.querySelector("#cancel-booking-button"),
  modalStatus: document.querySelector("#modal-status")
};

const weekdayFormatter = new Intl.DateTimeFormat("ko-KR", { weekday: "short" });
const shortDateFormatter = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" });
const rangeDateFormatter = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

const normalizeAccountSettings = (accountSettings) => {
  const incomingMap = new Map(
    (Array.isArray(accountSettings) ? accountSettings : []).map((account) => [
      String(account.roomId),
      {
        roomId: String(account.roomId),
        isActive: Boolean(account.isActive),
        hasPassword: Boolean(account.hasPassword),
        pinResetRequired: Boolean(account.pinResetRequired)
      }
    ])
  );

  return DEFAULT_ACCOUNT_SETTINGS.map((account) => incomingMap.get(account.roomId) || { ...account });
};

const normalizeLoginAccounts = (loginAccounts) => {
  const incomingMap = new Map(
    (Array.isArray(loginAccounts) ? loginAccounts : []).map((account) => [
      String(account.roomId),
      {
        roomId: String(account.roomId),
        isActive: Boolean(account.isActive),
        hasPassword: Boolean(account.hasPassword),
        pinResetRequired: Boolean(account.pinResetRequired),
        needsSetup: Boolean(account.needsSetup),
        canLogin: Boolean(account.canLogin)
      }
    ])
  );

  return DEFAULT_LOGIN_ACCOUNTS.map((account) => incomingMap.get(account.roomId) || { ...account });
};

const getRoomOptionsFromAccountSettings = (accountSettings) => [
  ...accountSettings
    .filter((account) => account.isActive && account.hasPassword && !account.pinResetRequired)
    .map((account) => account.roomId),
  "관리자"
];

const getLoginAccountByRoomId = (roomId) =>
  state.loginAccounts.find((account) => account.roomId === roomId) || null;

const selectLoginAccount = (roomId) => {
  const selectedAccount = getLoginAccountByRoomId(roomId);

  if (!selectedAccount) {
    return;
  }

  const needsSetup = Boolean(selectedAccount.needsSetup);

  elements.loginRoomId.value = roomId;
  state.setupRequired = needsSetup;
  elements.loginConfirmField.classList.toggle("is-hidden", !needsSetup);
  elements.loginConfirmPin.required = needsSetup;
  elements.loginConfirmPin.value = "";
  elements.loginSubmitButton.textContent = needsSetup ? "활성화" : "로그인";
  elements.modalInfoText.textContent = needsSetup
    ? "선택한 계정을 활성화합니다."
    : selectedAccount.canLogin
      ? "선택한 계정으로 로그인합니다."
      : "비활성 계정입니다.";
  setModalStatus("");
  renderLoginAccountChips();
  elements.loginPin.focus();
};

const setModalStatus = (message, type = "") => {
  elements.modalStatus.textContent = message || "";
  elements.modalStatus.classList.remove("is-error", "is-success");

  if (type) {
    elements.modalStatus.classList.add(type === "error" ? "is-error" : "is-success");
  }
};

const setBoardStatus = (title = "", detail = "", isError = false) => {
  if (!title && !detail) {
    elements.boardStatusChip.classList.add("is-hidden");
    elements.boardStatusChip.classList.remove("is-error");
    return;
  }

  elements.boardStatusMain.textContent = title;
  elements.boardStatusDetail.textContent = detail;
  elements.boardStatusChip.classList.remove("is-hidden");
  elements.boardStatusChip.classList.toggle("is-error", isError);
};

const setAdminMenuStatus = (message, type = "") => {
  elements.adminMenuStatus.textContent = message || "";
  elements.adminMenuStatus.classList.remove("is-error", "is-success");

  if (type) {
    elements.adminMenuStatus.classList.add(type === "error" ? "is-error" : "is-success");
  }
};

const fetchJson = async (url, options = {}) => {
  let response;

  try {
    response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });
  } catch (error) {
    const requestError = new Error(
      window.location.protocol === "file:"
        ? "파일 주소로 열면 서버에 연결할 수 없습니다. 도메인 또는 로컬 서버 주소로 열어주세요."
        : "서버 연결에 실패했습니다."
    );
    requestError.cause = error;
    throw requestError;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "요청을 처리하지 못했습니다.");
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
};

const toDateKey = (date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");

const dateKeyToDate = (dateKey) => new Date(`${dateKey}T12:00:00+09:00`);

const addDays = (dateKey, offset) => {
  const date = dateKeyToDate(dateKey);
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
};

const getWeekStart = (dateKey) => {
  const date = dateKeyToDate(dateKey);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  return toDateKey(date);
};

const getWeekDates = (weekStart) => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

const formatHourRange = (hour) => `${String(hour).padStart(2, "0")}:00 - ${String((hour + 1) % 24).padStart(2, "0")}:00`;

const formatSlotLabel = (dateKey, hour) => {
  const date = dateKeyToDate(dateKey);
  return `${rangeDateFormatter.format(date)} (${weekdayFormatter.format(date)}) ${formatHourRange(hour)}`;
};

const formatSlotStart = (dateKey, hour) => {
  const date = dateKeyToDate(dateKey);
  return `${rangeDateFormatter.format(date)} (${weekdayFormatter.format(date)}) ${String(hour).padStart(2, "0")}:00`;
};

const formatSlotRange = (startDateKey, startHour, endDateKey, endHourExclusive) => {
  if (startDateKey === endDateKey) {
    return `${formatSlotStart(startDateKey, startHour)} ~ ${String(endHourExclusive % 24).padStart(2, "0")}:00`;
  }

  return `${formatSlotStart(startDateKey, startHour)} ~ ${formatSlotStart(endDateKey, endHourExclusive % 24)}`;
};

const getSlotRangeEnd = (dateKey, hour) => {
  const endDate = new Date(createSlotDate(dateKey, hour).getTime() + 60 * 60 * 1000);
  return {
    dateKey: toDateKey(endDate),
    slotHour: endDate.getHours()
  };
};

const formatRemainingTime = (expiresAt) => {
  const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  const minutesPart = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secondsPart = String(seconds % 60).padStart(2, "0");
  return `${minutesPart}:${secondsPart}`;
};

const createSlotDate = (dateKey, hour) =>
  new Date(`${dateKey}T${String(hour).padStart(2, "0")}:00:00+09:00`);

const isPastSlot = (dateKey, hour) => createSlotDate(dateKey, hour) <= new Date();

const slotKey = (dateKey, hour) => `${dateKey}|${hour}`;

const parseSlotKey = (key) => {
  const [dateKey, hour] = String(key).split("|");
  return {
    dateKey,
    slotHour: Number(hour)
  };
};

const getBookingMap = () =>
  new Map(state.bookings.map((booking) => [slotKey(booking.bookingDate, booking.slotHour), booking]));

const getRoomSlotColors = (roomId) =>
  ROOM_SLOT_COLORS[String(roomId)] || {
    bg: "#edf1ed",
    accent: "#7c8a7e",
    text: "#172119",
    note: "#5d675e"
  };

const getSlotStatus = (dateKey, hour, booking) => {
  if (!booking) {
    return isPastSlot(dateKey, hour) ? "past" : "available";
  }

  if (isPastSlot(dateKey, hour) && !state.isAdmin) {
    return booking.roomId === state.roomId ? "past-mine" : "past-booked";
  }

  return booking.isMine ? "mine" : "taken";
};

const getSelectionEntries = () => {
  const bookingMap = getBookingMap();

  return state.selectedKeys.map((key) => {
    const { dateKey, slotHour } = parseSlotKey(key);
    const booking = bookingMap.get(key) || null;
    const status = getSlotStatus(dateKey, slotHour, booking);

    return {
      key,
      dateKey,
      slotHour,
      booking,
      status
    };
  });
};

const getSelectionMode = () => {
  const entries = getSelectionEntries();

  if (!entries.length) {
    return "none";
  }

  const kinds = new Set(
    entries.map((entry) => (entry.status === "available" ? "available" : entry.status === "past" ? "past" : "booked"))
  );

  if (kinds.size > 1) {
    return "mixed";
  }

  return Array.from(kinds)[0];
};

const isSelected = (key) => state.selectedKeys.includes(key);

const canSelectSlot = (status, booking) => {
  if (status === "past") {
    return false;
  }

  if (status === "past-booked" || status === "past-mine") {
    return state.isAdmin && Boolean(booking);
  }

  if (status === "taken") {
    return !state.authenticated || state.isAdmin;
  }

  return true;
};

const clearSelection = () => {
  state.selectedKeys = [];
  state.pendingAction = "";
  renderActionBar();
  renderCalendar();
};

const openLoginPrompt = async () => {
  closeAdminMenu();
  elements.loginRoomId.value = "";
  elements.loginPin.value = "";
  elements.loginConfirmPin.value = "";
  elements.loginConfirmField.classList.add("is-hidden");
  elements.loginConfirmPin.required = false;
  elements.loginSubmitButton.textContent = "로그인";
  state.setupRequired = false;
  state.pendingAction = "login";
  renderActionModal();
  showModal();

  setModalStatus("계정 상태를 확인하는 중입니다.");

  try {
    const data = await fetchJson("/api/reservation/session");
    syncSessionFromPayload(data);
    renderActionModal();
    setModalStatus("");
  } catch (error) {
    renderActionModal();
    setModalStatus("계정 상태를 새로 불러오지 못했습니다.", "error");
  }
};

const toggleSelection = (dateKey, slotHour) => {
  const key = slotKey(dateKey, slotHour);
  const booking = getBookingMap().get(key) || null;
  const status = getSlotStatus(dateKey, slotHour, booking);

  if (!canSelectSlot(status, booking)) {
    return;
  }

  if (isSelected(key)) {
    state.selectedKeys = state.selectedKeys.filter((entry) => entry !== key);
  } else {
    state.selectedKeys = [...state.selectedKeys, key];
  }

  renderActionBar();
  renderCalendar();

  if (!state.authenticated && state.selectedKeys.length) {
    openLoginPrompt();
  }
};

const fillRoomOptions = () => {
  elements.reserveRoomId.innerHTML = "";

  state.roomOptions.forEach((roomId) => {
    if (roomId !== "관리자") {
      const reserveOption = document.createElement("option");
      reserveOption.value = roomId;
      reserveOption.textContent = roomId;
      elements.reserveRoomId.appendChild(reserveOption);
    }
  });

  renderLoginAccountChips();
};

const renderLoginAccountChips = () => {
  const currentValue = String(elements.loginRoomId.value || "").trim();
  elements.loginAccountList.innerHTML = "";

  const loginRoomOptions = state.loginAccounts.filter(Boolean);

  if (!loginRoomOptions.some((account) => account.roomId === currentValue)) {
    elements.loginRoomId.value = "";
  }

  loginRoomOptions.forEach((account) => {
    const roomId = account.roomId;
    const chip = document.createElement("button");
    const isSelected = elements.loginRoomId.value === roomId;
    const isDisabledByAdmin = roomId !== "관리자" && !account.isActive;
    const canLogin = account.canLogin;
    const needsSetup = account.needsSetup;

    chip.type = "button";
    chip.className = `account-chip-button${isSelected ? " is-selected" : ""}`;
    if (canLogin) {
      chip.classList.add("is-active");
    } else {
    chip.classList.add("is-disabled");
    }
    chip.innerHTML = `<strong>${roomId}</strong><small>${canLogin ? "활성" : "비활성"}</small>`;
    chip.dataset.roomId = roomId;
    chip.setAttribute("role", "option");
    chip.setAttribute("aria-selected", isSelected ? "true" : "false");
    elements.loginAccountList.appendChild(chip);
  });
};

const closeAdminMenu = () => {
  state.adminMenuOpen = false;
  elements.adminMenuButton.setAttribute("aria-expanded", "false");
  elements.adminMenu.classList.add("is-hidden");
  setAdminMenuStatus("");
};

const renderAdminMenu = () => {
  const canManageAccounts = state.authenticated && state.isAdmin;
  elements.adminMenuButton.classList.toggle("is-hidden", !canManageAccounts);

  if (!canManageAccounts) {
    state.adminMenuOpen = false;
    elements.adminMenuButton.setAttribute("aria-expanded", "false");
    elements.adminMenu.classList.add("is-hidden");
    setAdminMenuStatus("");
    return;
  }

  elements.adminMenuList.innerHTML = "";
  const visibleAccounts = state.accountSettings.filter(
    (account) => account.isActive && account.hasPassword && !account.pinResetRequired
  );

  if (!visibleAccounts.length) {
    setAdminMenuStatus("표시할 활성 계정이 없습니다.");
  }

  visibleAccounts.forEach((account) => {
    const row = document.createElement("div");
    const info = document.createElement("div");
    const meta = document.createElement("div");
    const actions = document.createElement("div");
    const title = document.createElement("strong");
    const activeBadge = document.createElement("span");
    const toggleButton = document.createElement("button");
    const isBusy = state.adminMenuBusyRoomId === account.roomId;

    row.className = "admin-account-row";
    info.className = "admin-account-info";
    meta.className = "admin-account-meta";
    actions.className = "admin-account-actions";
    title.textContent = account.roomId;

    activeBadge.className = `admin-account-badge${account.isActive ? "" : " is-inactive"}`;
    activeBadge.textContent = account.isActive ? "활성" : "비활성";
    meta.appendChild(activeBadge);

    toggleButton.type = "button";
    toggleButton.className = "admin-account-button";
    toggleButton.textContent = account.isActive ? "비활성화" : "활성화";
    toggleButton.disabled = isBusy;
    toggleButton.addEventListener("click", async () => {
      state.adminMenuBusyRoomId = account.roomId;
      renderAdminMenu();
      setAdminMenuStatus(`${account.roomId} 계정을 ${account.isActive ? "비활성화" : "활성화"}하는 중입니다.`);

      try {
        await fetchJson("/api/reservation/accounts", {
          method: "PATCH",
          body: JSON.stringify({
            roomId: account.roomId,
            isActive: !account.isActive
          })
        });
        await hydrateSession();
        renderActionBar();
        renderActionModal();
        setAdminMenuStatus(
          `${account.roomId} 계정을 ${account.isActive ? "비활성화" : "활성화"}했습니다.`,
          "success"
        );
      } catch (error) {
        setAdminMenuStatus(error.message, "error");
      } finally {
        state.adminMenuBusyRoomId = "";
        renderAdminMenu();
      }
    });

    info.appendChild(title);
    info.appendChild(meta);
    actions.appendChild(toggleButton);
    row.appendChild(info);
    row.appendChild(actions);
    elements.adminMenuList.appendChild(row);
  });

  elements.adminMenuButton.setAttribute("aria-expanded", state.adminMenuOpen ? "true" : "false");
  elements.adminMenu.classList.toggle("is-hidden", !state.adminMenuOpen);
};

const toggleAdminMenu = () => {
  if (!state.authenticated || !state.isAdmin) {
    return;
  }

  state.adminMenuOpen = !state.adminMenuOpen;

  if (!state.adminMenuOpen) {
    setAdminMenuStatus("");
  }

  renderAdminMenu();
};

const closeModal = () => {
  state.pendingAction = "";
  state.setupRequired = false;
  elements.slotLoginForm.reset();
  elements.loginConfirmField.classList.add("is-hidden");
  elements.loginConfirmPin.required = false;
  if (elements.reserveNote) {
    elements.reserveNote.value = "";
  }
  setModalStatus("");
  elements.modalBackdrop.classList.add("is-hidden");
  document.body.classList.remove("modal-open");
};

const showModal = () => {
  elements.modalBackdrop.classList.remove("is-hidden");
  document.body.classList.add("modal-open");
};

const renderSessionStrip = () => {
  if (state.authenticated && state.roomId && state.expiresAt) {
    elements.sessionChipMain.textContent = state.isAdmin ? `${state.roomId} 계정` : state.roomId;
    elements.sessionChipDetail.textContent = `세션 만료까지 ${formatRemainingTime(state.expiresAt)}`;
    elements.sessionChip.classList.remove("is-hidden");
    elements.headerLoginButton.classList.add("is-hidden");
    elements.headerLogoutButton.classList.remove("is-hidden");
  } else {
    elements.sessionChip.classList.add("is-hidden");
    elements.headerLoginButton.classList.remove("is-hidden");
    elements.headerLogoutButton.classList.add("is-hidden");
  }

  renderAdminMenu();
};

const updateSessionCountdown = () => {
  if (!state.authenticated || !state.expiresAt) {
    renderSessionStrip();
    return;
  }

  if (Date.now() >= state.expiresAt) {
    performLogout("자동 로그아웃", "5분이 지나 자동으로 로그아웃되었습니다.");
    return;
  }

  elements.sessionChipDetail.textContent = `세션 만료까지 ${formatRemainingTime(state.expiresAt)}`;
};

const startSessionCountdown = () => {
  if (state.countdownTimer) {
    clearInterval(state.countdownTimer);
  }

  if (!state.authenticated || !state.expiresAt) {
    return;
  }

  updateSessionCountdown();
  state.countdownTimer = window.setInterval(updateSessionCountdown, 1000);
};

const resetSessionState = () => {
  state.authenticated = false;
  state.isAdmin = false;
  state.roomId = "";
  state.expiresAt = null;
  state.setupRequired = false;
  state.adminMenuOpen = false;
  state.adminMenuBusyRoomId = "";
  elements.slotLoginForm.reset();
  elements.loginConfirmField.classList.add("is-hidden");
  elements.loginConfirmPin.required = false;

  if (state.countdownTimer) {
    clearInterval(state.countdownTimer);
    state.countdownTimer = null;
  }
};

const performLogout = async (title = "", detail = "") => {
  try {
    await fetchJson("/api/reservation/logout", {
      method: "POST",
      body: JSON.stringify({})
    });
  } catch (error) {
    // Ignore logout failure and clear client state anyway.
  }

  resetSessionState();
  renderSessionStrip();
  await refreshBookings(false);
  renderCalendar();
  renderActionBar();
  renderActionModal();
  setBoardStatus(title, detail, Boolean(title));
};

const refreshBookings = async (showErrorChip = true) => {
  if (!state.weekDates.length) {
    return;
  }

  const weekEnd = state.weekDates[state.weekDates.length - 1];

  try {
    const data = await fetchJson(
      `/api/reservation/bookings?from=${encodeURIComponent(state.weekStart)}&to=${encodeURIComponent(weekEnd)}`
    );
    state.bookings = Array.isArray(data.bookings) ? data.bookings : [];
    if (!state.authenticated) {
      setBoardStatus();
    }
  } catch (error) {
    state.bookings = [];
    if (showErrorChip) {
      setBoardStatus("연결 상태", "예약 현황을 불러오지 못했습니다.", true);
    }
  }
};

const buildDayHeader = (dateKey) => {
  const date = dateKeyToDate(dateKey);
  const header = document.createElement("div");
  header.className = "calendar-day-header";

  if (dateKey === state.today) {
    header.classList.add("is-today");
  }

  const title = document.createElement("strong");
  title.textContent = weekdayFormatter.format(date);

  const caption = document.createElement("span");
  caption.textContent = shortDateFormatter.format(date);

  header.appendChild(title);
  header.appendChild(caption);
  return header;
};

const renderCalendar = () => {
  const bookingMap = getBookingMap();
  elements.calendarGrid.innerHTML = "";

  const weekEnd = state.weekDates[state.weekDates.length - 1];
  if (state.weekStart && weekEnd) {
    elements.weekRangeLabel.textContent = `${rangeDateFormatter.format(dateKeyToDate(state.weekStart))} - ${rangeDateFormatter.format(dateKeyToDate(weekEnd))}`;
  }

  const corner = document.createElement("div");
  corner.className = "calendar-corner";
  elements.calendarGrid.appendChild(corner);

  state.weekDates.forEach((dateKey) => {
    elements.calendarGrid.appendChild(buildDayHeader(dateKey));
  });

  state.hours.forEach((hour) => {
    const timeCell = document.createElement("div");
    timeCell.className = "calendar-time";
    timeCell.innerHTML = `<strong>${String(hour).padStart(2, "0")}</strong><span>${String((hour + 1) % 24).padStart(2, "0")}</span>`;
    elements.calendarGrid.appendChild(timeCell);

    state.weekDates.forEach((dateKey) => {
      const key = slotKey(dateKey, hour);
      const booking = bookingMap.get(key) || null;
      const status = getSlotStatus(dateKey, hour, booking);
      const cell = document.createElement("div");
      const button = document.createElement("button");
      const isTodayColumn = dateKey === state.today;

      cell.className = "calendar-cell";
      button.type = "button";
      button.className = `slot-button is-${status}`;

      if (isTodayColumn) {
        cell.classList.add("is-today-col");
        button.classList.add("is-today-col");
      }

      if (isSelected(key)) {
        button.classList.add("is-selected");
        if (status === "mine") {
          button.classList.add("is-selected-mine");
        }
      }

      if (status === "available") {
        button.innerHTML = `<span class="available-text">예약 가능</span>`;
      } else if (status === "mine" || status === "taken" || status === "past-booked" || status === "past-mine") {
        const noteMarkup = booking && booking.note ? `<p>${booking.note}</p>` : "";
        const roomColors = getRoomSlotColors(booking ? booking.roomId : "");
        button.classList.add("is-room-booked");
        if (status === "mine" || status === "past-mine") {
          button.classList.add("is-room-mine");
        }
        button.style.setProperty("--slot-room-bg", roomColors.bg);
        button.style.setProperty("--slot-room-accent", roomColors.accent);
        button.style.setProperty("--slot-room-text", roomColors.text);
        button.style.setProperty("--slot-room-note", roomColors.note);
        button.innerHTML = `<strong>${booking.roomId}</strong>${noteMarkup}`;
      } else {
        button.innerHTML = `<span class="past-text">.</span>`;
      }

      if (!canSelectSlot(status, booking)) {
        button.disabled = true;
      } else {
        button.addEventListener("click", () => {
          toggleSelection(dateKey, hour);
        });
      }

      cell.appendChild(button);
      elements.calendarGrid.appendChild(cell);
    });
  });

  positionCurrentTimeLine();
};

const positionCurrentTimeLine = () => {
  const todayIndex = state.weekDates.indexOf(state.today);

  if (todayIndex === -1) {
    elements.currentTimeLine.classList.add("is-hidden");
    return;
  }

  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const stageHeight = elements.calendarStage.clientHeight;
  const styles = getComputedStyle(document.documentElement);
  const headerHeight = Number.parseFloat(styles.getPropertyValue("--calendar-header-height")) || 42;
  const timeColumnWidth = Number.parseFloat(styles.getPropertyValue("--time-column-width")) || 56;
  const bodyHeight = Math.max(stageHeight - headerHeight, 0);
  const top = headerHeight + ((hour + minute / 60) / 24) * bodyHeight;

  elements.currentTimeLine.style.top = `${top}px`;
  elements.currentTimeLine.style.left = `${timeColumnWidth}px`;
  elements.currentTimeLabel.textContent = timeFormatter.format(now);
  elements.currentTimeLine.classList.remove("is-hidden");
};

const startTimeLineTimer = () => {
  if (state.timeLineTimer) {
    clearInterval(state.timeLineTimer);
  }

  positionCurrentTimeLine();
  state.timeLineTimer = window.setInterval(positionCurrentTimeLine, 60000);
};

const renderActionBar = () => {
  const entries = getSelectionEntries();
  const mode = getSelectionMode();

  if (!entries.length) {
    elements.actionBar.classList.add("is-hidden");
    return;
  }

  elements.actionBar.classList.remove("is-hidden");
  elements.actionSummaryMain.textContent = `${entries.length}개 선택`;
  elements.bulkReserveButton.classList.add("is-hidden");
  elements.bulkCancelButton.classList.add("is-hidden");
  elements.bulkModifyButton.classList.add("is-hidden");

  if (mode === "available") {
    elements.actionSummaryDetail.textContent = "선택한 시간대를 예약합니다.";
    elements.bulkReserveButton.classList.remove("is-hidden");
    elements.bulkReserveButton.textContent = state.authenticated ? "예약" : "로그인 후 예약";
  } else if (mode === "booked") {
    elements.actionSummaryDetail.textContent = state.isAdmin
      ? "선택한 예약을 취소하거나 다른 계정으로 수정할 수 있습니다."
      : "선택한 예약을 취소합니다.";
    elements.bulkCancelButton.classList.remove("is-hidden");
    elements.bulkCancelButton.textContent = state.authenticated ? "취소" : "로그인 후 취소";
    if (state.isAdmin) {
      elements.bulkModifyButton.classList.remove("is-hidden");
      elements.bulkModifyButton.textContent = "수정";
    }
  } else {
    elements.actionSummaryDetail.textContent = "예약 가능 슬롯과 예약된 슬롯은 함께 선택할 수 없습니다.";
  }
};

const summarizeSelectedSlots = () => {
  const entries = getSelectionEntries();

  if (!entries.length) {
    return {
      title: "-",
      detail: ""
    };
  }

  const sorted = [...entries].sort((left, right) =>
    left.dateKey === right.dateKey ? left.slotHour - right.slotHour : left.dateKey.localeCompare(right.dateKey)
  );
  const ranges = [];
  let currentRangeStart = sorted[0];
  let previousEntry = sorted[0];

  for (let index = 1; index < sorted.length; index += 1) {
    const currentEntry = sorted[index];
    const previousSlotTime = createSlotDate(previousEntry.dateKey, previousEntry.slotHour).getTime();
    const currentSlotTime = createSlotDate(currentEntry.dateKey, currentEntry.slotHour).getTime();
    const isContinuous = currentSlotTime - previousSlotTime === 60 * 60 * 1000;

    if (!isContinuous) {
      const rangeEnd = getSlotRangeEnd(previousEntry.dateKey, previousEntry.slotHour);
      ranges.push(
        formatSlotRange(
          currentRangeStart.dateKey,
          currentRangeStart.slotHour,
          rangeEnd.dateKey,
          rangeEnd.slotHour
        )
      );
      currentRangeStart = currentEntry;
    }

    previousEntry = currentEntry;
  }

  const finalRangeEnd = getSlotRangeEnd(previousEntry.dateKey, previousEntry.slotHour);
  ranges.push(
    formatSlotRange(
      currentRangeStart.dateKey,
      currentRangeStart.slotHour,
      finalRangeEnd.dateKey,
      finalRangeEnd.slotHour
    )
  );

  return {
    title: ranges.join("\n"),
    detail: ""
  };
};

const getCancellableEntries = () =>
  getSelectionEntries().filter((entry) => entry.booking && (state.isAdmin || entry.booking.roomId === state.roomId));

const renderActionModal = () => {
  const summary = summarizeSelectedSlots();
  const mode = getSelectionMode();

  elements.slotModalTitle.textContent = "외포장실 예약";
  elements.slotSummaryLabel.textContent = summary.title;
  elements.slotSummarySubtext.textContent = summary.detail;
  elements.slotSummarySubtext.classList.toggle("is-hidden", !summary.detail);
  elements.slotSummaryCard.classList.remove("is-hidden");
  elements.modalInfoCard.classList.remove("is-hidden");
  elements.slotLoginForm.classList.add("is-hidden");
  elements.slotReserveForm.classList.add("is-hidden");
  elements.reserveRoomField.classList.add("is-hidden");
  elements.modalBookingActions.classList.add("is-hidden");
  setModalStatus("");

  if (!state.pendingAction) {
    return;
  }

  if (state.pendingAction === "login") {
    const selectedAccount = getLoginAccountByRoomId(String(elements.loginRoomId.value || "").trim());
    const needsSetup = Boolean(selectedAccount && selectedAccount.needsSetup);
    const selectedAccountIsDisabled = Boolean(selectedAccount && !selectedAccount.canLogin);

    state.setupRequired = needsSetup;
    elements.slotModalTitle.textContent = "로그인";
    elements.slotSummaryCard.classList.add("is-hidden");
    elements.modalInfoTitle.textContent = "로그인";
    elements.modalInfoText.textContent = !selectedAccount
      ? "로그인할 계정을 선택해주세요."
      : needsSetup
        ? "선택한 계정을 활성화합니다."
        : selectedAccountIsDisabled
          ? "비활성 계정입니다."
          : "선택한 계정으로 로그인합니다.";
    elements.slotLoginForm.classList.remove("is-hidden");
    elements.loginConfirmField.classList.toggle("is-hidden", !needsSetup);
    elements.loginConfirmPin.required = needsSetup;
    elements.loginSubmitButton.textContent = needsSetup ? "활성화" : "로그인";
    renderLoginAccountChips();
    return;
  }

  if (state.pendingAction === "reserve") {
    const selectedCount = getSelectionEntries().length;
    elements.modalInfoCard.classList.add("is-hidden");

    if (mode !== "available") {
      elements.modalInfoCard.classList.remove("is-hidden");
      elements.modalInfoTitle.textContent = "예약";
      elements.modalInfoText.textContent = "예약 가능한 슬롯만 선택해주세요.";
      return;
    }

    if (state.isAdmin) {
      elements.reserveRoomField.classList.remove("is-hidden");
      elements.reserveRoomId.value = elements.reserveRoomId.value || state.roomId;
    }
    elements.reserveSubmitButton.textContent = `${selectedCount}시간 예약하기`;
    elements.slotReserveForm.classList.remove("is-hidden");
    return;
  }

  if (state.pendingAction === "modify") {
    const selectedCount = getSelectionEntries().length;

    if (!state.isAdmin) {
      elements.modalInfoTitle.textContent = "수정";
      elements.modalInfoText.textContent = "관리자만 예약을 수정할 수 있습니다.";
      return;
    }

    elements.modalInfoTitle.textContent = "수정";
    elements.modalInfoText.textContent = `${selectedCount}개 예약을 다른 계정으로 수정합니다.`;
    elements.reserveRoomField.classList.remove("is-hidden");
    elements.reserveRoomId.value = elements.reserveRoomId.value || state.roomId;
    elements.reserveSubmitButton.textContent = `${selectedCount}개 수정 확정`;
    elements.slotReserveForm.classList.remove("is-hidden");
    return;
  }

  if (state.pendingAction === "cancel") {
    const selectedCount = getSelectionEntries().length;
    elements.modalInfoTitle.textContent = "취소";

    if (mode !== "booked") {
      elements.modalInfoText.textContent = "예약된 슬롯만 선택해주세요.";
      return;
    }

    const cancellableEntries = getCancellableEntries();

    if (!cancellableEntries.length) {
      elements.modalInfoText.textContent = "선택한 슬롯 중 현재 계정으로 취소할 수 있는 예약이 없습니다.";
      return;
    }

    if (cancellableEntries.length !== selectedCount) {
      elements.modalInfoText.textContent = `${selectedCount}개 중 ${cancellableEntries.length}개만 ${state.roomId} 예약이라 취소됩니다.`;
    } else {
      elements.modalInfoText.textContent = `${cancellableEntries.length}개 슬롯을 취소합니다.`;
    }

    elements.cancelBookingButton.textContent = `${cancellableEntries.length}개 취소 확정`;
    elements.modalBookingActions.classList.remove("is-hidden");
  }
};

const openActionModal = (action) => {
  closeAdminMenu();
  state.pendingAction = action;
  renderActionModal();
  showModal();
};

const syncSessionFromPayload = (payload) => {
  state.accountSettings = normalizeAccountSettings(payload.accountSettings || state.accountSettings);
  state.loginAccounts = normalizeLoginAccounts(payload.loginAccounts || state.loginAccounts);
  state.roomOptions = Array.isArray(payload.roomOptions) && payload.roomOptions.length
    ? payload.roomOptions
    : getRoomOptionsFromAccountSettings(state.accountSettings);
  state.hours = Array.isArray(payload.hours) && payload.hours.length
    ? payload.hours
    : [...DEFAULT_HOURS];
  state.today = payload.today || state.today || toDateKey(new Date());
  state.authenticated = Boolean(payload.authenticated || payload.roomId);
  state.isAdmin = Boolean(payload.isAdmin);
  state.roomId = payload.roomId || "";
  state.expiresAt = payload.expiresAt || null;
  state.sessionMaxAgeSeconds = Number(payload.sessionMaxAgeSeconds || state.sessionMaxAgeSeconds);
  fillRoomOptions();
  if (state.roomId && state.roomId !== "관리자") {
    elements.reserveRoomId.value = state.roomId;
  } else if (elements.reserveRoomId.options.length) {
    elements.reserveRoomId.value = elements.reserveRoomId.options[0].value;
  }
  renderSessionStrip();
  startSessionCountdown();
};

const hydrateSession = async () => {
  try {
    const data = await fetchJson("/api/reservation/session");
    syncSessionFromPayload(data);
  } catch (error) {
    state.today = state.today || toDateKey(new Date());
    state.accountSettings = normalizeAccountSettings(state.accountSettings);
    state.loginAccounts = normalizeLoginAccounts(state.loginAccounts);
    state.roomOptions = getRoomOptionsFromAccountSettings(state.accountSettings);
    fillRoomOptions();
    renderSessionStrip();
    setBoardStatus("연결 상태", "세션 정보를 확인하지 못했습니다.", true);
  }
};

const submitLogin = async () => {
  const roomId = String(elements.loginRoomId.value || "").trim();
  const pin = elements.loginPin.value.trim();
  const confirmPin = elements.loginConfirmPin.value.trim();

  if (!roomId) {
    setModalStatus("로그인할 계정을 선택해주세요.", "error");
    return;
  }

  const selectedAccount = getLoginAccountByRoomId(roomId);

  if (selectedAccount && !selectedAccount.canLogin && !selectedAccount.needsSetup) {
    setModalStatus("비활성화된 계정입니다. 관리자에게 문의해주세요.", "error");
    return;
  }

  setModalStatus("로그인 중입니다.");

  try {
    const data = await fetchJson("/api/reservation/login", {
      method: "POST",
      body: JSON.stringify({
        roomId,
        pin,
        confirmPin: state.setupRequired ? confirmPin : undefined
      })
    });

    state.setupRequired = false;
    elements.loginConfirmField.classList.add("is-hidden");
    elements.loginConfirmPin.required = false;
    syncSessionFromPayload({
      authenticated: true,
      isAdmin: Boolean(data.isAdmin),
      roomId: data.roomId,
      expiresAt: data.expiresAt,
      sessionMaxAgeSeconds: data.sessionMaxAgeSeconds,
      roomOptions: state.roomOptions,
      hours: state.hours,
      today: state.today
    });
    await refreshBookings(false);
    if (!state.isAdmin) {
      const bookingMap = getBookingMap();
      state.selectedKeys = state.selectedKeys.filter((key) => {
        const { dateKey, slotHour } = parseSlotKey(key);
        const booking = bookingMap.get(key) || null;
        const status = getSlotStatus(dateKey, slotHour, booking);
        return status === "available" || status === "mine";
      });
    }
    renderCalendar();
    renderActionBar();
    setBoardStatus();
    closeModal();
  } catch (error) {
    if (error.payload && error.payload.setupRequired) {
      state.setupRequired = true;
      elements.loginConfirmField.classList.remove("is-hidden");
      elements.loginConfirmPin.required = true;
      elements.loginConfirmPin.focus();
      setModalStatus(error.message, "success");
      return;
    }

    setModalStatus(error.message, "error");
  }
};

const submitBulkReserve = async () => {
  const entries = getSelectionEntries().filter((entry) => entry.status === "available");
  const targetRoomId = state.isAdmin ? String(elements.reserveRoomId.value || "").trim() : state.roomId;

  if (!entries.length) {
    setModalStatus("예약 가능한 슬롯을 선택해주세요.", "error");
    return;
  }

  if (!targetRoomId) {
    setModalStatus("예약할 계정을 선택해주세요.", "error");
    return;
  }

  setModalStatus("예약 중입니다.");

  let successCount = 0;
  let failureCount = 0;
  let lastErrorMessage = "";

  for (const entry of entries) {
    try {
      await fetchJson("/api/reservation/bookings", {
        method: "POST",
        body: JSON.stringify({
          date: entry.dateKey,
          slotHour: entry.slotHour,
          roomId: targetRoomId,
          note: ""
        })
      });
      successCount += 1;
    } catch (error) {
      failureCount += 1;
      lastErrorMessage = error instanceof Error ? error.message : "예약에 실패했습니다.";
    }
  }

  if (elements.reserveNote) {
    elements.reserveNote.value = "";
  }
  await refreshBookings(false);
  clearSelection();
  renderActionModal();

  if (successCount && !failureCount) {
    setModalStatus(`${successCount}개 슬롯을 예약했습니다.`, "success");
    window.setTimeout(closeModal, 700);
    return;
  }

  if (successCount) {
    setModalStatus(`${successCount}개 예약, ${failureCount}개 실패${lastErrorMessage ? ` · ${lastErrorMessage}` : ""}`, "error");
    return;
  }

  setModalStatus(lastErrorMessage || "예약에 실패했습니다.", "error");
};

const submitBulkModify = async () => {
  const entries = getSelectionEntries().filter((entry) => entry.booking);
  const targetRoomId = String(elements.reserveRoomId.value || "").trim();

  if (!entries.length) {
    setModalStatus("수정할 예약을 선택해주세요.", "error");
    return;
  }

  if (!targetRoomId) {
    setModalStatus("변경할 계정을 선택해주세요.", "error");
    return;
  }

  setModalStatus("수정 중입니다.");

  let successCount = 0;
  let failureCount = 0;
  let lastErrorMessage = "";

  for (const entry of entries) {
    try {
      await fetchJson("/api/reservation/bookings", {
        method: "PATCH",
        body: JSON.stringify({
          id: entry.booking.id,
          date: entry.dateKey,
          slotHour: entry.slotHour,
          roomId: targetRoomId,
          note: ""
        })
      });
      successCount += 1;
    } catch (error) {
      failureCount += 1;
      lastErrorMessage = error instanceof Error ? error.message : "수정에 실패했습니다.";
    }
  }

  if (elements.reserveNote) {
    elements.reserveNote.value = "";
  }
  await refreshBookings(false);
  clearSelection();
  renderActionModal();

  if (successCount && !failureCount) {
    setModalStatus(`${successCount}개 슬롯을 수정했습니다.`, "success");
    window.setTimeout(closeModal, 700);
    return;
  }

  if (successCount) {
    setModalStatus(`${successCount}개 수정, ${failureCount}개 실패${lastErrorMessage ? ` · ${lastErrorMessage}` : ""}`, "error");
    return;
  }

  setModalStatus(lastErrorMessage || "수정에 실패했습니다.", "error");
};

const submitBulkCancel = async () => {
  const cancellableEntries = getCancellableEntries();

  if (!cancellableEntries.length) {
    setModalStatus("취소할 수 있는 예약이 없습니다.", "error");
    return;
  }

  setModalStatus("취소 중입니다.");

  let successCount = 0;
  let failureCount = 0;
  let lastErrorMessage = "";

  for (const entry of cancellableEntries) {
    try {
      await fetchJson("/api/reservation/bookings", {
        method: "DELETE",
        body: JSON.stringify({ id: entry.booking.id })
      });
      successCount += 1;
    } catch (error) {
      failureCount += 1;
      lastErrorMessage = error instanceof Error ? error.message : "취소에 실패했습니다.";
    }
  }

  await refreshBookings(false);
  clearSelection();
  renderActionModal();

  if (successCount && !failureCount) {
    setModalStatus(`${successCount}개 슬롯을 취소했습니다.`, "success");
    window.setTimeout(closeModal, 700);
    return;
  }

  if (successCount) {
    setModalStatus(`${successCount}개 취소, ${failureCount}개 실패${lastErrorMessage ? ` · ${lastErrorMessage}` : ""}`, "error");
    return;
  }

  setModalStatus(lastErrorMessage || "취소에 실패했습니다.", "error");
};

const setWeekFromDate = (dateKey) => {
  state.weekStart = getWeekStart(dateKey);
  state.weekDates = getWeekDates(state.weekStart);
};

const startAutoRefresh = () => {
  if (state.refreshTimer) {
    clearInterval(state.refreshTimer);
  }

  state.refreshTimer = window.setInterval(async () => {
    await refreshBookings(false);
    renderCalendar();
    renderActionBar();
    renderActionModal();
  }, 30000);
};

elements.prevWeekButton.addEventListener("click", async () => {
  closeModal();
  clearSelection();
  state.weekStart = addDays(state.weekStart, -7);
  state.weekDates = getWeekDates(state.weekStart);
  renderCalendar();
  await refreshBookings();
  renderCalendar();
});

elements.nextWeekButton.addEventListener("click", async () => {
  closeModal();
  clearSelection();
  state.weekStart = addDays(state.weekStart, 7);
  state.weekDates = getWeekDates(state.weekStart);
  renderCalendar();
  await refreshBookings();
  renderCalendar();
});

elements.todayButton.addEventListener("click", async () => {
  closeModal();
  clearSelection();
  setWeekFromDate(state.today);
  renderCalendar();
  await refreshBookings();
  renderCalendar();
});

elements.clearSelectionButton.addEventListener("click", () => {
  clearSelection();
});

elements.bulkReserveButton.addEventListener("click", () => {
  if (!state.authenticated) {
    openLoginPrompt();
    return;
  }
  openActionModal("reserve");
});

elements.bulkCancelButton.addEventListener("click", () => {
  if (!state.authenticated) {
    openLoginPrompt();
    return;
  }
  openActionModal("cancel");
});

elements.bulkModifyButton.addEventListener("click", () => {
  if (!state.authenticated) {
    openLoginPrompt();
    return;
  }
  openActionModal("modify");
});

elements.loginAccountList.addEventListener("pointerup", (event) => {
  const chip = event.target.closest(".account-chip-button");

  if (!chip) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  selectLoginAccount(String(chip.dataset.roomId || ""));
});

const handleAdminMenuButtonPress = (event) => {
  event.preventDefault();
  event.stopPropagation();
  toggleAdminMenu();
};

elements.adminMenuButton.addEventListener("pointerup", handleAdminMenuButtonPress);

elements.slotLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitLogin();
});

elements.slotReserveForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.pendingAction === "modify") {
    await submitBulkModify();
    return;
  }

  await submitBulkReserve();
});

elements.cancelBookingButton.addEventListener("click", submitBulkCancel);
elements.headerLoginButton.addEventListener("click", openLoginPrompt);
elements.headerLogoutButton.addEventListener("click", () => performLogout());
elements.modalCloseButton.addEventListener("click", closeModal);
if (elements.modalDismissButton) {
  elements.modalDismissButton.addEventListener("click", closeModal);
}

elements.modalBackdrop.addEventListener("click", (event) => {
  if (event.target === elements.modalBackdrop) {
    closeModal();
  }
});

document.addEventListener("click", (event) => {
  if (!state.adminMenuOpen) {
    return;
  }

  if (elements.adminMenu.contains(event.target) || elements.adminMenuButton.contains(event.target)) {
    return;
  }

  closeAdminMenu();
});

window.addEventListener("resize", positionCurrentTimeLine);

const init = async () => {
  state.today = toDateKey(new Date());
  setWeekFromDate(state.today);
  fillRoomOptions();
  renderCalendar();
  renderActionBar();
  await hydrateSession();
  setWeekFromDate(state.today);
  renderCalendar();
  await refreshBookings();
  renderCalendar();
  renderActionBar();
  startAutoRefresh();
  startTimeLineTimer();
};

init();
