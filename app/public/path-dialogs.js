export function registerPathDialogs({ ipcMain, dialog, getWindow }) {
  async function selectPath(event, options) {
    const window = getWindow(event);
    if (!window) {
      throw new Error("文件选择请求不是来自仓库窗口");
    }
    if (
      !options ||
      !["directory", "file", "save-file"].includes(options.kind) ||
      (options.defaultPath !== undefined &&
        typeof options.defaultPath !== "string") ||
      (options.extension !== undefined &&
        !["zip", "tar"].includes(options.extension))
    ) {
      throw new Error("文件选择参数无效");
    }

    const common = { defaultPath: options.defaultPath || undefined };
    if (options.kind === "save-file") {
      const result = await dialog.showSaveDialog(window, {
        ...common,
        title: "保存恢复文件",
        buttonLabel: "保存",
        filters: options.extension
          ? [
              {
                name: options.extension.toUpperCase(),
                extensions: [options.extension],
              },
            ]
          : undefined,
      });
      if (result.canceled) {
        return null;
      }
      if (typeof result.filePath !== "string" || !result.filePath) {
        throw new Error("文件选择未返回有效路径");
      }
      return result.filePath;
    }

    const directory = options.kind === "directory";
    const result = await dialog.showOpenDialog(window, {
      ...common,
      title: directory ? "选择目录" : "选择文件",
      buttonLabel: "选择",
      properties: directory
        ? ["openDirectory", "createDirectory"]
        : ["openFile"],
    });
    if (result.canceled) {
      return null;
    }
    const selectedPath = result.filePaths[0];
    if (typeof selectedPath !== "string" || !selectedPath) {
      throw new Error("文件选择未返回有效路径");
    }
    return selectedPath;
  }

  ipcMain.handle("select-path", selectPath);
  ipcMain.handle("select-dir", (event) =>
    selectPath(event, { kind: "directory" }),
  );
}
