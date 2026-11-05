import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isActive(source) {
  return (
    source.currentTask ||
    ["PENDING", "UPLOADING", "INITIALIZING"].includes(source.status)
  );
}

function sameSource(left, right) {
  return (
    left?.host === right.host &&
    left?.userName === right.userName &&
    left?.path === right.path
  );
}

async function updateSource(
  repositoryID,
  source,
  { getSources, getTasks, startSnapshot, sleep },
) {
  const previous = new Set(
    (await getTasks(repositoryID)).map((task) => task.id),
  );
  await startSnapshot(repositoryID, source);
  const prefix = `${source.userName}@${source.host}:${source.path} at `;
  let taskID;
  let startupPolls = 0;
  for (;;) {
    const tasks = await getTasks(repositoryID);
    const matching = tasks.filter(
      (task) =>
        !previous.has(task.id) &&
        task.kind === "Snapshot" &&
        task.description.startsWith(prefix),
    );
    if (!taskID) {
      if (matching.length > 1) {
        throw new Error(
          `备份源 ${source.path} 出现多个更新任务，无法确认结果，不会关机`,
        );
      }
      taskID = matching[0]?.id;
    }
    if (taskID) {
      const task = tasks.find((task) => task.id === taskID);
      if (!task) {
        throw new Error(`备份源 ${source.path} 的更新任务已丢失，不会关机`);
      }
      if (task.status === "SUCCESS") {
        break;
      }
      if (task.status !== "RUNNING") {
        throw new Error(
          `备份源 ${source.path} 更新失败或已取消，不会关机：${task.errorMessage || task.status}`,
        );
      }
    } else if (++startupPolls >= 60) {
      throw new Error(`备份源 ${source.path} 的更新任务未启动，不会关机`);
    }
    await sleep(1000);
  }

  // The task finishes before the source manager refreshes its snapshot status.
  for (;;) {
    const latest = await getSources(repositoryID);
    const current = latest.sources.find((item) =>
      sameSource(item.source, source),
    );
    if (!current) {
      throw new Error(`备份源 ${source.path} 已移除，不会关机`);
    }
    if (!isActive(current)) {
      if (current.status !== "IDLE") {
        throw new Error(`备份源 ${source.path} 未恢复空闲状态，不会关机`);
      }
      return;
    }
    await sleep(1000);
  }
}

export function shutdownCommand(platform, windowsRoot = "C:\\Windows") {
  switch (platform) {
    case "win32":
      return [`${windowsRoot}\\System32\\shutdown.exe`, ["/s", "/t", "60"]];
    case "darwin":
    case "linux":
      return ["/sbin/shutdown", ["-h", "+1"]];
    default:
      throw new Error("当前操作系统不支持自动关机");
  }
}

export function registerUpdateAndShutdown({
  ipcMain,
  dialog,
  getRepository,
  getSources,
  getTasks,
  startSnapshot,
  log,
  platform = process.platform,
  windowsRoot = process.env.SystemRoot,
  run = execute,
  sleep = wait,
}) {
  let updating = false;

  ipcMain.handle("update-and-shutdown", async (event) => {
    const repository = getRepository(event);
    if (!repository) {
      throw new Error("更新并关机请求不是来自仓库窗口");
    }
    if (updating) {
      throw new Error("已有更新并关机操作正在进行");
    }
    updating = true;
    try {
      const [shutdown, shutdownArgs] = shutdownCommand(platform, windowsRoot);
      const confirmation = await dialog.showMessageBox(repository.window, {
        type: "warning",
        title: "更新并关机",
        message: "更新当前仓库的所有本机备份源，全部成功后关闭这台电脑？",
        detail:
          "包括手动备份源，使用与普通更新相同的备份策略。请先保存其他程序中的工作。只要所有更新任务成功结束，即使有文件读取错误或快照不完整也会关机，部分文件可能未备份。任务失败、取消、无法确认完成或仍有备份运行时不会关机。可在快照和任务页面查看进度及错误日志。关机命令将在更新完成后执行，预留 60 秒。",
        buttons: ["取消", "更新并关机"],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (confirmation.response !== 1) {
        return false;
      }

      const sources = await getSources(repository.id);
      const local = sources.sources.filter(
        ({ source }) =>
          source.host === sources.localHost &&
          source.userName === sources.localUsername,
      );
      if (local.length === 0) {
        throw new Error("当前仓库没有本机备份源，不会关机");
      }
      if (sources.sources.some(isActive)) {
        throw new Error("仓库已有备份任务正在进行，请等待完成后重试");
      }

      if (local.some((item) => item.status !== "IDLE")) {
        throw new Error("本机备份源尚未就绪或已暂停，请恢复后重试，不会关机");
      }
      for (const { source } of local) {
        log.info("updating repository source", repository.id, source.path);
        await updateSource(repository.id, source, {
          getSources,
          getTasks,
          startSnapshot,
          sleep,
        });
      }

      const latest = await getSources(repository.id);
      if (latest.sources.some(isActive)) {
        throw new Error("仓库仍有备份任务正在进行，不会关机，请稍后重试");
      }
      await run(shutdown, shutdownArgs, { windowsHide: true });
      log.info("repository updated, system shutdown scheduled", repository.id);
      return true;
    } catch (error) {
      log.error("update and shutdown failed", error);
      await dialog.showMessageBox(repository.window, {
        type: "error",
        title: "更新并关机失败",
        message: "未执行自动关机。",
        detail: error instanceof Error ? error.message : String(error),
        buttons: ["确定"],
      });
      throw error;
    } finally {
      updating = false;
    }
  });
}
