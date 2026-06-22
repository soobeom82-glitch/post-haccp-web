const { buildClearSessionCookie, sendJson } = require("../_lib/reservation");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { message: "Method not allowed" });
    return;
  }

  res.setHeader("Set-Cookie", buildClearSessionCookie(req));
  sendJson(res, 200, { ok: true });
};
