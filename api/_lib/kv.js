const getKvConfig = () => {
  const baseUrl = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!baseUrl || !token) {
    throw new Error("kv_not_configured");
  }

  return { baseUrl, token };
};

const buildKvUrl = (parts) => {
  const { baseUrl } = getKvConfig();
  return `${baseUrl}/${parts.map((part) => encodeURIComponent(String(part))).join("/")}`;
};

const parseHashResult = (result) => {
  if (!result) {
    return {};
  }

  if (Array.isArray(result)) {
    const parsed = {};

    for (let index = 0; index < result.length; index += 2) {
      parsed[String(result[index])] = String(
        result[index + 1] !== undefined ? result[index + 1] : ""
      );
    }

    return parsed;
  }

  if (typeof result === "object") {
    return Object.fromEntries(
      Object.entries(result).map(([key, value]) => [String(key), String(value)])
    );
  }

  return {};
};

const kvCommand = async (...parts) => {
  const { token } = getKvConfig();
  const response = await fetch(buildKvUrl(parts), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error("kv_command_failed");
  }

  return json.result;
};

const kvGet = async (key) => kvCommand("get", key);

const kvSet = async (key, value, ttlSeconds) => {
  if (ttlSeconds) {
    return kvCommand("set", key, value, "EX", ttlSeconds);
  }

  return kvCommand("set", key, value);
};

const kvHashIncrement = async (key, field, amount = 1) => kvCommand("hincrby", key, field, amount);

const kvHashGetAll = async (key) => {
  const result = await kvCommand("hgetall", key);
  return parseHashResult(result);
};

module.exports = {
  kvGet,
  kvSet,
  kvHashIncrement,
  kvHashGetAll
};
