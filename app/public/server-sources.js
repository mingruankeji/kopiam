import https from "node:https";

export async function requestServerAPI(
  { address, certificate, password },
  apiPath,
  description,
  { method = "GET", query = {} } = {},
  request = https.request,
) {
  function get(url, description, headers = {}, method = "GET") {
    return new Promise((resolve, reject) => {
      const req = request(
        url,
        {
          ca: [certificate],
          auth: `kopia:${password}`,
          timeout: 30000,
          headers,
          method,
        },
        (resp) => {
          let body = "";
          resp.setEncoding("utf8");
          resp.on("data", (data) => {
            body += data;
            if (body.length > 16 * 1024 * 1024) {
              req.destroy(new Error(`${description}响应过大`));
            }
          });
          resp.on("error", reject);
          resp.on("end", () => {
            if (resp.statusCode !== 200) {
              reject(
                new Error(`${description}失败 (${resp.statusCode}): ${body}`),
              );
              return;
            }
            resolve({ body, headers: resp.headers });
          });
        },
      );
      req.on("timeout", () => req.destroy(new Error(`${description}超时`)));
      req.on("error", reject);
      req.end();
    });
  }

  const session = await get(new URL("/", address), "读取仓库会话");
  const token = session.body.match(
    /<meta name="kopia-csrf-token" content="([a-f0-9]{64})" \/>/,
  )?.[1];
  const cookie = session.headers["set-cookie"]
    ?.find((value) => value.startsWith("Kopia-Session-Cookie="))
    ?.split(";")[0];
  if (!token || !cookie) {
    throw new Error("仓库会话响应缺少 CSRF Token 或会话 Cookie");
  }

  const url = new URL(apiPath, address);
  url.search = new URLSearchParams(query).toString();
  const response = await get(
    url,
    description,
    {
      Cookie: cookie,
      "X-Kopia-Csrf-Token": token,
    },
    method,
  );
  return JSON.parse(response.body);
}

export async function fetchServerSources(connection, request = https.request) {
  const sources = await requestServerAPI(
    connection,
    "/api/v1/sources",
    "读取仓库备份源",
    {},
    request,
  );
  if (
    !sources ||
    !Array.isArray(sources.sources) ||
    typeof sources.localHost !== "string" ||
    typeof sources.localUsername !== "string"
  ) {
    throw new Error("仓库备份源响应无效");
  }
  return sources;
}

export async function fetchServerTasks(connection, request = https.request) {
  const response = await requestServerAPI(
    connection,
    "/api/v1/tasks",
    "读取仓库备份任务",
    {},
    request,
  );
  if (
    !Array.isArray(response?.tasks) ||
    response.tasks.some(
      (task) =>
        !task ||
        typeof task.id !== "string" ||
        typeof task.kind !== "string" ||
        typeof task.description !== "string" ||
        typeof task.status !== "string",
    )
  ) {
    throw new Error("仓库备份任务响应无效");
  }
  return response.tasks;
}

export async function startServerSnapshot(
  connection,
  source,
  request = https.request,
) {
  const response = await requestServerAPI(
    connection,
    "/api/v1/sources/upload",
    "启动仓库快照更新",
    { method: "POST", query: source },
    request,
  );
  const key = `${source.userName}@${source.host}:${source.path}`;
  const results = Object.entries(response?.sources ?? {});
  if (
    results.length !== 1 ||
    results[0][0] !== key ||
    results[0][1]?.success !== true
  ) {
    throw new Error("仓库未确认启动指定备份源的快照更新");
  }
}
