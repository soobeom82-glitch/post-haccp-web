const ensureCronAuthorized = (req, res) => {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return true;
  }

  const authHeader = String(req.headers.authorization || "");

  if (authHeader === `Bearer ${secret}`) {
    return true;
  }

  res.statusCode = 401;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ message: "Unauthorized" }));
  return false;
};

module.exports = {
  ensureCronAuthorized
};
