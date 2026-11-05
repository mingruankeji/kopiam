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

function snapshotTask(source, id = "new-task") {
  return {
    id,
    kind: "Snapshot",
    description: `${source.userName}@${source.host}:${source.path} at 2026-11-06T00:00:00Z`,
    status: "SUCCESS",
    counters: { Errors: { value: 0, level: "error" } },
  };
}

function setup(options = {}) {
  const handlers = new Map();
  const calls = [];
  const dialogs = [];
  const tasks = [];
  const sources = {
    localHost: "local",
    localUsername: "user",
    sources: [
      {
        source,
        status: "IDLE",
        schedule: { manual: true },
        lastSnapshot: manifest,
      },
      { source: { ...source, host: "remote" }, status: "REMOTE" },
      { source: { ...source, userName: "other" }, status: "REMOTE" },
    ],
  };
  registerUpdateAndShutdown({
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    getRepository: () => ({ id: "repository-2", window: {} }),
    getSources: async (id) => {
      assert.equal(id, "repository-2");
      return sources;
    },
    getTasks: async (id) => {
      assert.equal(id, "repository-2");
      return tasks;
    },
    startSnapshot: async (id, source) => {
      calls.push({ repository: id, source });
      tasks.push(snapshotTask(source, `task-${tasks.length}`));
    },
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
    },
    sleep: async () => {},
    ...options,
  });
  return {
    update: () => handlers.get("update-and-shutdown")({}),
    calls,
    dialogs,
    sources,
    tasks,
  };
}

test("uses the server update for local sources including manual sources, never a snapshot CLI", async () => {
  const { update, calls, dialogs } = setup();
  assert.equal(await update(), true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], { repository: "repository-2", source });
  assert.equal(calls[1].binary, "D:\\Windows\\System32\\shutdown.exe");
  assert.deepEqual(calls[1].args, ["/s", "/t", "60"]);
  assert.deepEqual(calls[1].opts, { windowsHide: true });
  assert.match(dialogs[0].detail, /即使有文件读取错误或快照不完整也会关机/);
  assert.match(dialogs[0].detail, /部分文件可能未备份/);
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

for (const status of [
  "PENDING",
  "UPLOADING",
  "INITIALIZING",
  "PAUSED",
  "FAILED",
]) {
  test(`a source in ${status} prevents the operation`, async () => {
    const { update, sources, calls } = setup();
    sources.sources[0].status = status;
    await assert.rejects(update(), /已有备份任务|尚未就绪或已暂停/);
    assert.deepEqual(calls, []);
  });
}

test("another owner's active backup prevents the operation", async () => {
  const { update, sources, calls } = setup();
  sources.sources[2].currentTask = "active";
  await assert.rejects(update(), /已有备份任务/);
  assert.deepEqual(calls, []);
});

test("API failure prevents shutdown and releases the operation lock", async () => {
  let attempts = 0;
  const { update, calls, dialogs } = setup({
    startSnapshot: async () => {
      attempts++;
      throw new Error("upload failed");
    },
  });
  await assert.rejects(update(), /upload failed/);
  await assert.rejects(update(), /upload failed/);
  assert.equal(attempts, 2);
  assert.deepEqual(calls, []);
  assert.equal(dialogs.at(-1).detail, "upload failed");
});

test("waits through queued and running states and ignores old and unrelated tasks", async () => {
  const old = snapshotTask(source, "old");
  const unrelated = snapshotTask({ ...source, path: "D:\\other" }, "other");
  const running = { ...snapshotTask(source), status: "RUNNING" };
  const responses = [
    [old],
    [old, unrelated],
    [old, unrelated, running],
    [old, snapshotTask(source)],
  ];
  let sleeps = 0;
  const { update, calls } = setup({
    getTasks: async () => responses.shift(),
    sleep: async () => {
      sleeps++;
    },
  });
  assert.equal(await update(), true);
  assert.equal(sleeps, 2);
  assert.equal(calls.length, 2);
});

test("a completed historical snapshot never counts as the requested update", async () => {
  const { update, calls } = setup({
    getTasks: async () => [snapshotTask(source, "old")],
  });
  await assert.rejects(update(), /更新任务未启动/);
  assert.equal(calls.length, 1);
});

for (const status of ["FAILED", "CANCELED", "CANCELING", "UNKNOWN"]) {
  test(`task ${status} prevents shutdown even with an old complete snapshot`, async () => {
    let started = false;
    const { update, calls, dialogs } = setup({
      startSnapshot: async () => {
        started = true;
      },
      getTasks: async () =>
        started
          ? [{ ...snapshotTask(source), status, errorMessage: "task failed" }]
          : [],
    });
    await assert.rejects(update(), /更新失败或已取消/);
    assert.deepEqual(calls, []);
    assert.match(dialogs.at(-1).detail, /task failed/);
  });
}

for (const counters of [
  undefined,
  {},
  { Errors: { value: 1 } },
  { Errors: { value: "0" } },
]) {
  test(`a successful task permits shutdown regardless of error counters: ${JSON.stringify(counters)}`, async () => {
    let started = false;
    const { update, calls } = setup({
      startSnapshot: async () => {
        started = true;
      },
      getTasks: async () =>
        started
          ? [
              {
                ...snapshotTask(source),
                counters,
                errorMessage: "file access denied",
              },
            ]
          : [],
    });
    assert.equal(await update(), true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].binary, "D:\\Windows\\System32\\shutdown.exe");
  });
}

test("ambiguous new snapshot tasks never permit shutdown", async () => {
  const responses = [
    [],
    [snapshotTask(source, "one"), snapshotTask(source, "two")],
  ];
  const { update, calls } = setup({ getTasks: async () => responses.shift() });
  await assert.rejects(update(), /多个更新任务/);
  assert.equal(calls.length, 1);
});

test("a task lost after starting never permits shutdown", async () => {
  const responses = [[], [{ ...snapshotTask(source), status: "RUNNING" }], []];
  const { update, calls } = setup({ getTasks: async () => responses.shift() });
  await assert.rejects(update(), /更新任务已丢失/);
  assert.equal(calls.length, 1);
});

for (const snapshot of [
  { ...manifest, incomplete: "canceled" },
  { ...manifest, rootEntry: { obj: "root", summ: { incomplete: "canceled" } } },
  { ...manifest, rootEntry: { obj: "root", summ: { numFailed: 1 } } },
  { ...manifest, stats: { errorCount: 1 } },
  undefined,
  null,
  {},
]) {
  test(`a successful task permits shutdown despite incomplete or missing snapshot metadata: ${JSON.stringify(snapshot)}`, async () => {
    const { update, sources, calls } = setup();
    sources.sources[0].lastSnapshot = snapshot;
    assert.equal(await update(), true);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].binary, "D:\\Windows\\System32\\shutdown.exe");
  });
}

test("source refresh failure still prevents shutdown after task success", async () => {
  const { update, sources, calls } = setup({
    getSources: async () => ({
      ...sources,
      sources: calls.length
        ? [{ ...sources.sources[0], status: "FAILED" }]
        : sources.sources,
    }),
  });
  await assert.rejects(update(), /未恢复空闲状态/);
  assert.equal(calls.length, 1);
});

test("policy-ignored errors and retention-skipped identical snapshots permit shutdown", async () => {
  const { update, sources } = setup();
  sources.sources[0].lastSnapshot = {
    ...manifest,
    stats: { errorCount: 0, ignoredErrorCount: 1 },
    rootEntry: { obj: "root", summ: { ignoredErrorCount: 1 } },
  };
  assert.equal(await update(), true);
});

test("waits for source refresh after the task finishes", async () => {
  let reads = 0;
  const { update, sources } = setup({
    getSources: async () => {
      reads++;
      return {
        ...sources,
        sources: [
          { ...sources.sources[0], status: reads === 2 ? "UPLOADING" : "IDLE" },
        ],
      };
    },
  });
  assert.equal(await update(), true);
  assert.equal(reads, 4);
});

test("a removed source prevents shutdown", async () => {
  const { update, sources, calls } = setup({
    getSources: async () =>
      calls.length ? { ...sources, sources: [] } : sources,
  });
  await assert.rejects(update(), /已移除/);
  assert.equal(calls.length, 1);
});

test("a newly started server backup prevents shutdown after updating", async () => {
  let reads = 0;
  const { update, sources, calls } = setup({
    getSources: async () => {
      if (++reads === 3) sources.sources[0].currentTask = "scheduled";
      return sources;
    },
  });
  await assert.rejects(update(), /仍有备份任务/);
  assert.equal(calls.length, 1);
});

test("multiple local sources update sequentially before shutdown", async () => {
  const { update, sources, calls } = setup();
  const second = { ...source, path: "E:\\other" };
  sources.sources.push({
    source: second,
    status: "IDLE",
    lastSnapshot: { ...manifest, source: second },
  });
  assert.equal(await update(), true);
  assert.deepEqual(
    calls.slice(0, 2).map((call) => call.source),
    [source, second],
  );
  assert.equal(calls.length, 3);
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
    run: async () => {
      throw new Error("shutdown permission denied");
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
