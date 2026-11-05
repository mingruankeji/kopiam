import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { test } from "node:test";
import {
  fetchServerSources,
  fetchServerTasks,
  startServerSnapshot,
} from "../public/server-sources.js";

const connection = {
  address: "https://127.0.0.1:12345",
  certificate: "server certificate",
  password: "test password",
};
const token = "a".repeat(64);
const cookie = "Kopia-Session-Cookie=test-session";
const sources = { sources: [], localHost: "local", localUsername: "user" };
const sessionResponse = {
  body: `<head><meta name="kopia-csrf-token" content="${token}" /></head>`,
  headers: {
    "set-cookie": [
      "Other-Cookie=unrelated; Path=/",
      `${cookie}; Path=/; Secure; HttpOnly`,
    ],
  },
};

function setup(responses) {
  const calls = [];
  const request = (url, options, callback) => {
    calls.push({ url, options });
    const req = new EventEmitter();
    req.destroy = (error) => req.emit("error", error);
    req.end = () => {
      queueMicrotask(() => {
        const response = responses.shift();
        assert.ok(response, "unexpected request");
        if (response.error) {
          req.emit("error", response.error);
          return;
        }
        if (response.timeout) {
          req.emit("timeout");
          return;
        }
        const resp = new EventEmitter();
        resp.statusCode = response.statusCode ?? 200;
        resp.headers = response.headers ?? {};
        resp.setEncoding = (encoding) => assert.equal(encoding, "utf8");
        callback(resp);
        if (response.responseError) {
          resp.emit("error", response.responseError);
          return;
        }
        resp.emit("data", response.body);
        resp.emit("end");
      });
    };
    return req;
  };
  return {
    calls,
    request,
    fetch: () => fetchServerSources(connection, request),
  };
}

test("fetches a session before sources and sends the matching cookie and CSRF token", async () => {
  const { fetch, calls } = setup([
    sessionResponse,
    { body: JSON.stringify(sources) },
  ]);
  assert.deepEqual(await fetch(), sources);
  assert.deepEqual(
    calls.map(({ url }) => url.pathname),
    ["/", "/api/v1/sources"],
  );
  for (const { url, options } of calls) {
    assert.equal(url.origin, connection.address);
    assert.deepEqual(options.ca, [connection.certificate]);
    assert.equal(options.auth, `kopia:${connection.password}`);
    assert.equal(options.timeout, 30000);
    assert.notEqual(options.rejectUnauthorized, false);
  }
  assert.deepEqual(calls[0].options.headers, {});
  assert.deepEqual(calls[1].options.headers, {
    Cookie: cookie,
    "X-Kopia-Csrf-Token": token,
  });
});

test("gets a fresh session for each source read, including after a server restart", async () => {
  const nextToken = "b".repeat(64);
  const { fetch, calls } = setup([
    sessionResponse,
    { body: JSON.stringify(sources) },
    {
      body: `<meta name="kopia-csrf-token" content="${nextToken}" />`,
      headers: { "set-cookie": ["Kopia-Session-Cookie=next-session; Secure"] },
    },
    { body: JSON.stringify(sources) },
  ]);
  await fetch();
  await fetch();
  assert.deepEqual(calls[3].options.headers, {
    Cookie: "Kopia-Session-Cookie=next-session",
    "X-Kopia-Csrf-Token": nextToken,
  });
});

for (const response of [
  { ...sessionResponse, body: "<head></head>" },
  { ...sessionResponse, headers: {} },
  { ...sessionResponse, headers: { "set-cookie": ["Other-Cookie=value"] } },
]) {
  test(`missing session credentials stop before sources: ${JSON.stringify(response)}`, async () => {
    const { fetch, calls } = setup([response]);
    await assert.rejects(fetch(), /缺少 CSRF Token 或会话 Cookie/);
    assert.equal(calls.length, 1);
  });
}

for (const stage of ["session", "sources"]) {
  const description = stage === "session" ? "读取仓库会话" : "读取仓库备份源";
  for (const [response, expected] of [
    [{ statusCode: 401, body: "Unauthorized" }, `${description}失败 (401)`],
    [{ timeout: true }, `${description}超时`],
    [{ error: new Error("connection failed") }, "connection failed"],
    [{ responseError: new Error("response failed") }, "response failed"],
    [{ body: "x".repeat(16 * 1024 * 1024 + 1) }, `${description}响应过大`],
  ]) {
    test(`${stage} request errors propagate: ${expected}`, async () => {
      const { fetch } = setup(
        stage === "session" ? [response] : [sessionResponse, response],
      );
      await assert.rejects(fetch(), {
        message:
          expected.startsWith(description) && response.statusCode
            ? `${expected}: Unauthorized`
            : expected,
      });
    });
  }
}

for (const value of [
  null,
  {},
  { ...sources, sources: {} },
  { ...sources, localHost: null },
  { ...sources, localUsername: null },
]) {
  test(`invalid sources are rejected: ${JSON.stringify(value)}`, async () => {
    const { fetch } = setup([sessionResponse, { body: JSON.stringify(value) }]);
    await assert.rejects(fetch(), /仓库备份源响应无效/);
  });
}

test("malformed source JSON is rejected", async () => {
  const { fetch } = setup([sessionResponse, { body: "not json" }]);
  await assert.rejects(fetch(), SyntaxError);
});

test("snapshot updates use the same authenticated POST and exact source filters as the UI", async () => {
  const source = { host: "local", userName: "user", path: "D:\\备份 & files" };
  const { request, calls } = setup([
    sessionResponse,
    {
      body: JSON.stringify({
        sources: { "user@local:D:\\备份 & files": { success: true } },
      }),
    },
  ]);
  await startServerSnapshot(connection, source, request);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[1].url.pathname, "/api/v1/sources/upload");
  assert.deepEqual(Object.fromEntries(calls[1].url.searchParams), source);
  assert.deepEqual(calls[1].options.headers, {
    Cookie: cookie,
    "X-Kopia-Csrf-Token": token,
  });
});

for (const response of [
  {},
  { sources: {} },
  { sources: { "user@local:D:\\": { success: false } } },
  { sources: { "user@local:wrong": { success: true } } },
  {
    sources: { "user@local:D:\\": { success: true }, other: { success: true } },
  },
]) {
  test(`invalid snapshot acknowledgement is rejected: ${JSON.stringify(response)}`, async () => {
    const { request } = setup([
      sessionResponse,
      { body: JSON.stringify(response) },
    ]);
    await assert.rejects(
      startServerSnapshot(
        connection,
        { host: "local", userName: "user", path: "D:\\" },
        request,
      ),
      /未确认启动指定备份源/,
    );
  });
}

test("reads server tasks with CSRF authentication", async () => {
  const tasks = [
    { id: "task-1", kind: "Snapshot", description: "test", status: "RUNNING" },
  ];
  const { request, calls } = setup([
    sessionResponse,
    { body: JSON.stringify({ tasks }) },
  ]);
  assert.deepEqual(await fetchServerTasks(connection, request), tasks);
  assert.equal(calls[1].url.pathname, "/api/v1/tasks");
  assert.equal(calls[1].options.headers.Cookie, cookie);
  assert.equal(calls[1].options.headers["X-Kopia-Csrf-Token"], token);
});

for (const response of [
  null,
  {},
  { tasks: {} },
  { tasks: [null] },
  { tasks: [{}] },
]) {
  test(`invalid task response is rejected: ${JSON.stringify(response)}`, async () => {
    const { request } = setup([
      sessionResponse,
      { body: JSON.stringify(response) },
    ]);
    await assert.rejects(
      fetchServerTasks(connection, request),
      /仓库备份任务响应无效/,
    );
  });
}
