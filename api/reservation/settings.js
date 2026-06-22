const {
  ensureTables,
  getReservationUiSettings,
  setReservationUiScrollEnabled
} = require("../_lib/db");
const {
  getAuthenticatedSession,
  parseJsonBody,
  sendJson
} = require("../_lib/reservation");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  try {
    await ensureTables();

    if (req.method === "GET") {
      const settings = await getReservationUiSettings();
      sendJson(res, 200, { settings });
      return;
    }

    const session = getAuthenticatedSession(req);

    if (!session || !session.isAdmin) {
      sendJson(res, 403, { message: "관리자만 설정을 변경할 수 있습니다." });
      return;
    }

    if (req.method !== "PATCH") {
      res.setHeader("Allow", "GET, PATCH");
      sendJson(res, 405, { message: "Method not allowed" });
      return;
    }

    let payload;

    try {
      payload = parseJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { message: "잘못된 요청 형식입니다." });
      return;
    }

    if (typeof payload.scrollEnabled !== "boolean") {
      sendJson(res, 400, { message: "스크롤 설정을 다시 확인해주세요." });
      return;
    }

    const settings = await setReservationUiScrollEnabled(payload.scrollEnabled);
    sendJson(res, 200, { ok: true, settings });
  } catch (error) {
    console.error("api/reservation/settings failed", {
      message: error instanceof Error ? error.message : "unknown_error",
      method: req.method
    });
    sendJson(res, 500, { message: "설정을 처리하지 못했습니다." });
  }
};
