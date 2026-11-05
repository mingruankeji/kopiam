import assert from "node:assert/strict";
import { test } from "node:test";
import {
  registerUpdateAndShutdown,
  shutdownCommand,
} from "../public/update-and-shutdown.js";

const source = { host: "local", userName: "user", path: "D:\\备份" };
const manifest = {
  source,
  rootEntry: { obj: "root", summ: { numFailed: 0 } },
  stats: { errorCount: 0, ignoredErrorCount: 0 },
};

function setup(options = {}) {
  const handlers = new Map();
  const calls = [];
  const dialogs = [];
  const sources = {
    localHost: "local",
    localUsername: "user",
    sources: [
      { source, status: "PAUSED", schedule: { manual: true } },
      { source: { ...source, host: "remote" }, status: "REMOTE" },
      { source: { ...source, userName: "other" }, status: "REMOTE" },
    ],
  };
  registerUpdateAndShutdown({
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    getRepository: () => ({ id: "repository-2", window: {} }),
    getSources: async () => sources,
    getSnapshotCommand: (id) => [
      "kopia.exe",
      ["--config-file", `D:\\配置\\${id}.config`],
    ],
    dialog: {
      showMessageBox: async (_window, opts) => {
        dialogs.push(opts);
        return { response: 1 };
      },
    },
    log: { info() {}, error() {} },
    platform: "win32",
    windowsRoot: "D:\\Windows",
    run: async (binary, args, opts) => {
      calls.push({ binary, args, opts });
      return { stdout: JSON.stringify(manifest) + "\n" };
    },
    ...options,
  });
  return {
    update: () => handlers.get("update-and-shutdown")({}),
    calls,
    dialogs,
    sources,
  };
}

test("updates only the current repository's local sources including manual sources before shutdown", async () => {
  const { update, calls } = setup();
  assert.equal(await update(), true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].binary, "kopia.exe");
  assert.deepEqual(calls[0].args, [
    "--config-file",
    "D:\\配置\\repository-2.config",
    "snapshot",
    "create",
    "--json",
    "--no-json-indent",
    "--json-verbose",
    "--fail-fast",
    "--",
    source.path,
  ]);
  assert.deepEqual(calls[1].args, ["/s", "/t", "60"]);
  assert.equal(calls[1].binary, "D:\\Windows\\System32\\shutdown.exe");
  assert.ok(!calls[1].args.includes("/f"));
});

test("cancellation starts neither backup nor shutdown", async () => {
  const { update, calls } = setup({
    dialog: { showMessageBox: async () => ({ response: 0 }) },
  });
  assert.equal(await update(), false);
  assert.deepEqual(calls, []);
});

test("untrusted callers cannot open confirmation or run commands", async () => {
  const { update, calls, dialogs } = setup({ getRepository: () => null });
  await assert.rejects(update(), /不是来自仓库窗口/);
  assert.deepEqual(calls, []);
  assert.deepEqual(dialogs, []);
});

test("no local sources never schedules shutdown", async () => {
  const { update, sources, calls, dialogs } = setup();
  sources.sources = [];
  await assert.rejects(update(), /没有本机备份源/);
  assert.deepEqual(calls, []);
  assert.equal(dialogs.at(-1).type, "error");
});

test("active backups prevent the operation", async () => {
  const { update, sources, calls } = setup();
  sources.sources[0].currentTask = "active";
  await assert.rejects(update(), /已有备份任务/);
  assert.deepEqual(calls, []);
});

test("command failure prevents shutdown and releases the operation lock", async () => {
  let attempts = 0;
  const { update, dialogs } = setup({
    run: async () => {
      attempts++;
      throw new Error("upload failed");
    },
  });
  await assert.rejects(update(), /upload failed/);
  await assert.rejects(update(), /upload failed/);
  assert.equal(attempts, 2);
  assert.equal(dialogs.at(-1).detail, "upload failed");
});

for (const invalid of [
  { ...manifest, incomplete: "canceled" },
  { ...manifest, stats: { ignoredErrorCount: 1 } },
  { ...manifest, rootEntry: { obj: "root", summ: { numFailed: 1 } } },
  { ...manifest, rootEntry: { obj: "root", summ: { ignoredErrorCount: 1 } } },
  { ...manifest, source: { ...source, path: "wrong" } },
  {},
]) {
  test(`invalid or partial snapshot prevents shutdown: ${JSON.stringify(invalid)}`, async () => {
    let commands = 0;
    const { update } = setup({
      run: async () => {
        commands++;
        return { stdout: JSON.stringify(invalid) };
      },
    });
    await assert.rejects(update(), /快照不完整或包含错误/);
    assert.equal(commands, 1);
  });
}

test("malformed output does not permit shutdown", async () => {
  let commands = 0;
  const { update } = setup({
    run: async () => {
      commands++;
      return { stdout: "invalid json" };
    },
  });
  await assert.rejects(update(), SyntaxError);
  assert.equal(commands, 1);
});

test("an identical snapshot skipped by retention still permits shutdown", async () => {
  const commands = [];
  const { update } = setup({
    run: async (command) => {
      commands.push(command);
      return { stdout: "" };
    },
  });
  assert.equal(await update(), true);
  assert.equal(commands.length, 2);
});

test("a newly started server backup prevents shutdown after updating", async () => {
  const { update, sources, calls } = setup({
    getSources: async () => {
      if (calls.length) {
        sources.sources[0].currentTask = "scheduled";
      }
      return sources;
    },
  });
  await assert.rejects(update(), /仍有备份任务/);
  assert.equal(calls.length, 1);
});

test("concurrent requests are rejected while confirmation is pending", async () => {
  let confirm;
  const { update } = setup({
    dialog: {
      showMessageBox: () =>
        new Promise((resolve) => {
          confirm = resolve;
        }),
    },
  });
  const pending = update();
  await assert.rejects(update(), /已有更新并关机/);
  confirm({ response: 0 });
  assert.equal(await pending, false);
});

test("shutdown permission failure is reported rather than treated as success", async () => {
  const { update, dialogs } = setup({
    run: async (binary) => {
      if (binary !== "kopia.exe") {
        throw new Error("shutdown permission denied");
      }
      return { stdout: JSON.stringify(manifest) };
    },
  });
  await assert.rejects(update(), /shutdown permission denied/);
  assert.equal(dialogs.at(-1).type, "error");
});

for (const platform of ["linux", "darwin"]) {
  test(`${platform} schedules shutdown with no shell or forced close`, () => {
    assert.deepEqual(shutdownCommand(platform), [
      "/sbin/shutdown",
      ["-h", "+1"],
    ]);
  });
}

test("unsupported platforms reject shutdown", () => {
  assert.throws(() => shutdownCommand("unknown"), /不支持自动关机/);
});
