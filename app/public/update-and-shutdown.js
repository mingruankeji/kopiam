import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);

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
  getSnapshotCommand,
  log,
  platform = process.platform,
  windowsRoot = process.env.SystemRoot,
  run = execute,
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
          "包括手动备份源。请先保存其他程序中的工作。更新失败、有忽略的错误或快照不完整时不会关机。关机命令将在更新完成后执行，预留 60 秒。",
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
      if (
        local.some(
          (source) =>
            source.currentTask ||
            ["PENDING", "UPLOADING", "INITIALIZING"].includes(source.status),
        )
      ) {
        throw new Error("仓库已有备份任务正在进行，请等待完成后重试");
      }

      const [binary, args] = getSnapshotCommand(repository.id);
      for (const { source } of local) {
        log.info("updating repository source", repository.id, source.path);
        const { stdout } = await run(
          binary,
          [
            ...args,
            "snapshot",
            "create",
            "--json",
            "--no-json-indent",
            "--json-verbose",
            "--fail-fast",
            "--",
            source.path,
          ],
          { windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
        );
        // Identical snapshots may be omitted by the source's retention policy.
        for (const line of stdout.split(/\r?\n/).filter((v) => v.trim())) {
          const snapshot = JSON.parse(line);
          if (
            !snapshot.rootEntry?.obj ||
            snapshot.source?.path !== source.path ||
            snapshot.incomplete ||
            snapshot.rootEntry.summ?.incomplete ||
            snapshot.rootEntry.summ?.numFailed > 0 ||
            snapshot.rootEntry.summ?.ignoredErrorCount > 0 ||
            snapshot.stats?.errorCount > 0 ||
            snapshot.stats?.ignoredErrorCount > 0
          ) {
            throw new Error(
              `备份源 ${source.path} 的快照不完整或包含错误，不会关机`,
            );
          }
        }
      }

      const latest = await getSources(repository.id);
      if (
        latest.sources.some(
          (source) =>
            source.currentTask ||
            ["PENDING", "UPLOADING", "INITIALIZING"].includes(source.status),
        )
      ) {
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
