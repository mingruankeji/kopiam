import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

function preload(invoke) {
  let bridge;
  runInNewContext(
    readFileSync(new URL("../public/preload.js", import.meta.url), "utf8"),
    {
      require: () => ({
        contextBridge: {
          exposeInMainWorld: (_name, exposed) => {
            bridge = exposed;
          },
        },
        ipcRenderer: { invoke },
      }),
    },
  );
  return bridge;
}

test("browse preload returns the IPC promise and exact mounted path", async () => {
  let args;
  const bridge = preload(async (...values) => {
    args = values;
    return "Path not found";
  });
  assert.equal(
    await bridge.browseDirectory("D:\\挂载 & files"),
    "Path not found",
  );
  assert.deepEqual(args, ["browse-dir", "D:\\挂载 & files"]);
});

test("browse preload preserves rejected native promises", async () => {
  const bridge = preload(async () => {
    throw new Error("IPC failed");
  });
  await assert.rejects(bridge.browseDirectory("/mounted"), /IPC failed/);
});

test("browse main-process handler returns shell.openPath failures", async () => {
  const source = readFileSync(
    new URL("../public/electron.js", import.meta.url),
    "utf8",
  );
  const registration = source.match(
    /ipcMain\.handle\("browse-dir",[\s\S]*?\n\}\);/,
  );
  assert.ok(registration);
  let handler;
  runInNewContext(registration[0], {
    ipcMain: {
      handle: (_channel, callback) => {
        handler = callback;
      },
    },
    shell: {
      openPath: async (path) => {
        assert.equal(path, "D:\\挂载");
        return "Unable to open path";
      },
    },
  });
  assert.equal(await handler({}, "D:\\挂载"), "Unable to open path");
});
