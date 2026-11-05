import assert from "node:assert/strict";
import { test } from "node:test";
import { registerPathDialogs } from "../public/path-dialogs.js";

function setup({ canceled = false, allowed = true } = {}) {
  const handlers = new Map();
  const calls = [];
  const window = {};
  registerPathDialogs({
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    getWindow: () => (allowed ? window : null),
    dialog: {
      async showOpenDialog(parent, options) {
        calls.push({ parent, options });
        return {
          canceled,
          filePaths: canceled ? [] : ["D:\\测试目录\\文件.txt"],
        };
      },
      async showSaveDialog(parent, options) {
        calls.push({ parent, options });
        return {
          canceled,
          filePath: canceled ? undefined : "D:\\恢复\\备份.zip",
        };
      },
    },
  });
  return { handlers, calls, window };
}

test("directory picker is parented and preserves the initial path", async () => {
  const { handlers, calls, window } = setup();
  assert.equal(
    await handlers.get("select-path")(
      {},
      {
        kind: "directory",
        defaultPath: "D:\\测试目录",
      },
    ),
    "D:\\测试目录\\文件.txt",
  );
  assert.equal(calls[0].parent, window);
  assert.equal(calls[0].options.defaultPath, "D:\\测试目录");
  assert.deepEqual(calls[0].options.properties, [
    "openDirectory",
    "createDirectory",
  ]);
});

test("file picker selects files, not directories", async () => {
  const { handlers, calls } = setup();
  await handlers.get("select-path")({}, { kind: "file" });
  assert.deepEqual(calls[0].options.properties, ["openFile"]);
});

for (const extension of ["zip", "tar"]) {
  test(`${extension} restore uses a native save dialog`, async () => {
    const { handlers, calls, window } = setup();
    await handlers.get("select-path")({}, { kind: "save-file", extension });
    assert.equal(calls[0].parent, window);
    assert.deepEqual(calls[0].options.filters, [
      { name: extension.toUpperCase(), extensions: [extension] },
    ]);
  });
}

test("canceling either dialog returns null", async () => {
  const { handlers } = setup({ canceled: true });
  for (const kind of ["directory", "file", "save-file"]) {
    assert.equal(await handlers.get("select-path")({}, { kind }), null);
  }
});

test("legacy directory bridge remains compatible", async () => {
  const { handlers, calls } = setup();
  await handlers.get("select-dir")({});
  assert.deepEqual(calls[0].options.properties, [
    "openDirectory",
    "createDirectory",
  ]);
});

test("invalid options and callers are rejected before opening dialogs", async () => {
  const { handlers, calls } = setup();
  for (const options of [
    undefined,
    { kind: "unknown" },
    { kind: "file", defaultPath: 42 },
    { kind: "save-file", extension: "exe" },
  ]) {
    await assert.rejects(handlers.get("select-path")({}, options), /参数无效/);
  }
  assert.equal(calls.length, 0);
  const denied = setup({ allowed: false });
  await assert.rejects(
    denied.handlers.get("select-path")({}, { kind: "file" }),
    /不是来自仓库窗口/,
  );
  assert.equal(denied.calls.length, 0);
});

test("native errors propagate to the renderer", async () => {
  const handlers = new Map();
  registerPathDialogs({
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    getWindow: () => ({}),
    dialog: {
      showOpenDialog: async () => {
        throw new Error("dialog failed");
      },
    },
  });

  await assert.rejects(
    handlers.get("select-path")({}, { kind: "file" }),
    /dialog failed/,
  );
});

test("non-canceled dialogs must return a valid path", async () => {
  const handlers = new Map();
  registerPathDialogs({
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    getWindow: () => ({}),
    dialog: {
      showOpenDialog: async () => ({ canceled: false, filePaths: [] }),
      showSaveDialog: async () => ({ canceled: false }),
    },
  });
  for (const kind of ["directory", "file", "save-file"]) {
    await assert.rejects(
      handlers.get("select-path")({}, { kind }),
      /未返回有效路径/,
    );
  }
});
