import { test, expect } from "@playwright/test";
import { _electron as electron } from "playwright";

import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";

const DEFAULT_REPO_ID = "repository";

let electronApp;
let mainPath;
let executablePath;
let tmpAppDataDir;

function getKopiaUIDir() {
  switch (process.platform + "/" + process.arch) {
    case "darwin/x64":
      return path.resolve("../dist/kopia-ui/mac");
    case "darwin/arm64":
      return path.resolve("../dist/kopia-ui/mac-arm64");
    case "linux/x64":
      // on Linux we must run from installed location due to AppArmor profile
      return path.resolve("/opt/KopiaUI");
    case "linux/arm64":
      // on Linux we must run from installed location due to AppArmor profile
      return path.resolve("/opt/KopiaUI");
    case "win32/x64":
      return path.resolve("../dist/kopia-ui/win-unpacked");
    default:
      return null;
  }
}

function getMainPath(kopiauiDir) {
  switch (process.platform) {
    case "darwin":
      return path.join(
        kopiauiDir,
        "KopiaUI.app",
        "Contents",
        "Resources",
        "app.asar",
        "public",
        "electron.js",
      );
    default:
      return path.join(
        kopiauiDir,
        "resources",
        "app.asar",
        "public",
        "electron.js",
      );
  }
}

function getExecutablePath(kopiauiDir) {
  switch (process.platform) {
    case "win32":
      return path.join(kopiauiDir, "KopiaUI.exe");
    case "darwin":
      return path.join(
        kopiauiDir,
        "KopiaUI.app",
        "Contents",
        "MacOS",
        "KopiaUI",
      );
    default:
      return path.join(kopiauiDir, "kopia-ui");
  }
}

/**
 * Creates a temporary application data directory along with the kopia
 * directory for testing purposes.
 *
 * @returns {string} The path to the created temporary directory.
 */
function createTemporaryAppDataDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kopia-test-"));
  fs.mkdirSync(path.join(tmpDir, "kopia"));
  return tmpDir;
}

/**
 * Launches a new instance of the Electron app with the given app data directory.
 *
 * Also captures page errors and console messages and logs them to the console.
 *
 * @param {string} appDataDir - the path to the app data directory
 * @returns {Promise<Electron.App>} - a promise that resolves to the launched app
 */
async function launchApp(appDataDir) {
  const electronApp = await electron.launch({
    args: [mainPath],
    executablePath: executablePath,
    env: {
      ...process.env,
      KOPIA_CUSTOM_APPDATA: appDataDir,
      KOPIA_UI_PORTABLE_CONFIG_DIR: path.join(appDataDir, "kopia"),
    },
  });

  electronApp.on("window", async (page) => {
    const filename = page.url()?.split("/").pop();
    console.log(`Window opened: ${filename}`);

    // capture errors
    page.on("pageerror", (error) => {
      console.error(error);
    });
    // capture console messages
    page.on("console", (msg) => {
      console.log(msg.text());
    });
  });

  return electronApp;
}

/**
 * Waits for Kopia to start up by delaying for a specified duration.
 *
 * @returns {Promise<void>} A promise that resolves after the delay.
 */
function waitForKopiaToStartup() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, 2500);
  });
}

test.beforeAll(() => {
  const kopiauiDir = getKopiaUIDir();
  expect(kopiauiDir).not.toBeNull();

  mainPath = getMainPath(kopiauiDir);
  executablePath = getExecutablePath(kopiauiDir);

  console.log("main path", mainPath);
  console.log("executable path", executablePath);

  process.env.CI = "e2e";
  process.env.KOPIA_UI_TESTING = "1";
});

test.beforeEach(async () => {
  tmpAppDataDir = createTemporaryAppDataDir();
});

test.afterEach(async () => {
  await electronApp.close();
  fs.rmSync(tmpAppDataDir, { recursive: true, force: true });
});

test("opens repository window on first start", async () => {
  electronApp = await launchApp(tmpAppDataDir);

  await electronApp.evaluate(async ({ app }) => {
    app.testHooks.showRepoWindow("repository");
  });

  const page = await electronApp.firstWindow();

  expect(page).toBeTruthy();
  await page.waitForNavigation({
    waitUntil: "networkidle",
    networkIdleTimeout: 1000,
  });
  expect(await page.title()).toMatch(/KopiaUI v\d+/);

  // TODO - we can exercise some UI scenario using 'page'

  await electronApp.evaluate(async ({ app }) => {
    return app.testHooks.tray.popUpContextMenu();
  });

  await electronApp.evaluate(async ({ app }) => {
    return app.testHooks.tray.closeContextMenu();
  });
});

test("adds default repository if no repository is configured", async () => {
  electronApp = await launchApp(tmpAppDataDir);

  await waitForKopiaToStartup();

  const configs = await electronApp.evaluate(async ({ app }) => {
    return app.testHooks.allConfigs();
  });
  expect(configs).toStrictEqual([DEFAULT_REPO_ID]);
});

test("opens a visible repository window when the default repository config exists", async () => {
  fs.writeFileSync(
    path.join(tmpAppDataDir, "kopia", `${DEFAULT_REPO_ID}.config`),
    "",
  );

  electronApp = await launchApp(tmpAppDataDir);

  await waitForKopiaToStartup();
  const windows = electronApp.windows();
  expect(windows).toHaveLength(1);
  await expect
    .poll(() =>
      electronApp.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]?.isVisible(),
      ),
    )
    .toBe(true);
});

test("native file pickers configure local paths without uploading browser Files", async () => {
  electronApp = await launchApp(tmpAppDataDir);
  const page = await electronApp.firstWindow();
  const selectedPath = path.join(tmpAppDataDir, "中文路径");

  await electronApp.evaluate(({ dialog }, selectedPath) => {
    dialog.showOpenDialog = async (parent, options) => {
      globalThis.nativeDialogCall = { parent: parent.id, options };
      return { canceled: false, filePaths: [selectedPath] };
    };
  }, selectedPath);

  await page.getByText("本地目录或 NAS", { exact: true }).click();
  await page.getByRole("textbox", { name: "目录路径", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "目录路径", exact: true }),
  ).toHaveValue(selectedPath);
  const directoryCall = await electronApp.evaluate(
    () => globalThis.nativeDialogCall,
  );
  expect(directoryCall.options.properties).toEqual([
    "openDirectory",
    "createDirectory",
  ]);
  expect(directoryCall.parent).toBeGreaterThan(0);

  await page.getByRole("button", { name: "返回", exact: true }).click();
  await page.getByText("Google Cloud 存储", { exact: true }).click();
  await page.getByRole("button", { name: "选择文件", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "凭据文件", exact: true }),
  ).toHaveValue(selectedPath);
  const fileCall = await electronApp.evaluate(
    () => globalThis.nativeDialogCall,
  );
  expect(fileCall.options.properties).toEqual(["openFile"]);

  await electronApp.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
  });
  await page.getByRole("button", { name: "选择文件", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "凭据文件", exact: true }),
  ).toHaveValue(selectedPath);
});

test("native file pickers resolve snapshot sources and choose restore destinations", async () => {
  test.setTimeout(180000);
  const source = path.join(tmpAppDataDir, "备份源");
  const repository = path.join(tmpAppDataDir, "storage");
  const restored = path.join(tmpAppDataDir, "恢复目录");
  fs.mkdirSync(source);
  fs.mkdirSync(repository);
  fs.mkdirSync(restored);
  fs.writeFileSync(path.join(source, "sample.txt"), "native dialog round trip");
  const resources =
    process.platform === "darwin"
      ? path.join(path.dirname(executablePath), "..", "Resources")
      : path.join(path.dirname(executablePath), "resources");
  const binary = path.join(
    resources,
    "server",
    process.platform === "win32" ? "kopia.exe" : "kopia",
  );
  const args = [
    `--config-file=${path.join(tmpAppDataDir, "kopia", "repository.config")}`,
    "--disable-file-logging",
  ];
  const cliOptions = {
    env: { ...process.env, KOPIA_PASSWORD: "native-dialog-test-password" },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  };
  execFileSync(
    binary,
    [
      ...args,
      "repository",
      "create",
      "filesystem",
      `--path=${repository}`,
      `--cache-directory=${path.join(tmpAppDataDir, "cache")}`,
    ],
    cliOptions,
  );
  execFileSync(binary, [...args, "snapshot", "create", source], cliOptions);
  const snapshots = JSON.parse(
    execFileSync(binary, [...args, "snapshot", "list", "--json"], cliOptions),
  );
  const root = snapshots[0].rootEntry.obj;

  electronApp = await launchApp(tmpAppDataDir);
  await electronApp.evaluate(({ app }) =>
    app.testHooks.showRepoWindow("repository"),
  );
  const page = await electronApp.firstWindow();
  await page.waitForURL(/\/(snapshots|repo)$/);
  await page.goto(new URL("/snapshots", page.url()).href);

  await electronApp.evaluate(({ dialog }, source) => {
    dialog.showOpenDialog = async (parent, options) => {
      globalThis.nativeDialogCall = { parent: parent.id, options };
      return { canceled: false, filePaths: [source] };
    };
  }, source);
  await page.getByRole("button", { name: "新建快照", exact: true }).click();
  const snapshotDialog = page.getByRole("dialog");
  await snapshotDialog
    .getByRole("button", { name: "选择目录", exact: true })
    .click();
  await expect(
    snapshotDialog.getByRole("textbox", { name: "快照源路径", exact: true }),
  ).toHaveValue(source);
  await expect(
    snapshotDialog.getByRole("button", { name: "立即创建快照", exact: true }),
  ).toBeEnabled();
  await snapshotDialog
    .getByRole("button", { name: "取消", exact: true })
    .click();

  await page.goto(new URL(`/snapshots/dir/${root}`, page.url()).href);
  const downloaded = path.join(tmpAppDataDir, "下载文件.txt");
  await electronApp.evaluate(({ BrowserWindow }, downloaded) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.webContents.session.once("will-download", (_event, item) => {
      globalThis.downloadDialogOptions = item.getSaveDialogOptions();
      item.setSavePath(downloaded);
    });
  }, downloaded);
  await page.locator('a[href*="/api/v1/objects/"]').click();
  await expect.poll(() => fs.existsSync(downloaded)).toBe(true);
  await expect
    .poll(() => fs.readFileSync(downloaded, "utf8"))
    .toBe("native dialog round trip");
  expect(
    await electronApp.evaluate(() => globalThis.downloadDialogOptions),
  ).toMatchObject({
    title: "保存下载文件",
    buttonLabel: "保存",
  });
  await page.getByRole("button", { name: "恢复", exact: true }).click();
  await electronApp.evaluate(({ dialog }, restored) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [restored],
    });
    dialog.showSaveDialog = async (parent, options) => {
      globalThis.nativeDialogCall = { parent: parent.id, options };
      return {
        canceled: false,
        filePath: `${restored}.${options.filters[0].extensions[0]}`,
      };
    };
  }, restored);
  const restoreDialog = page.getByRole("dialog");
  await restoreDialog
    .getByRole("button", { name: "选择目录", exact: true })
    .click();
  await expect(
    restoreDialog.getByRole("textbox", { name: "目标位置", exact: true }),
  ).toHaveValue(restored);
  for (const [label, extension] of [
    ["ZIP 文件", "zip"],
    ["Tar 文件", "tar"],
  ]) {
    await restoreDialog.getByText(label, { exact: true }).click();
    await restoreDialog
      .getByRole("button", { name: "保存文件", exact: true })
      .click();
    await expect(
      restoreDialog.getByRole("textbox", { name: "目标位置", exact: true }),
    ).toHaveValue(`${restored}.${extension}`);
    const call = await electronApp.evaluate(() => globalThis.nativeDialogCall);
    expect(call.options.filters[0].extensions).toEqual([extension]);
    expect(call.parent).toBeGreaterThan(0);
    await restoreDialog
      .getByRole("button", { name: "开始恢复", exact: true })
      .click();
    await expect
      .poll(() => fs.existsSync(`${restored}.${extension}`))
      .toBe(true);
    await expect
      .poll(() =>
        fs
          .readFileSync(`${restored}.${extension}`)
          .includes(Buffer.from("native dialog round trip")),
      )
      .toBe(true);
    if (extension === "zip") {
      expect(
        fs.readFileSync(`${restored}.${extension}`).subarray(0, 4),
      ).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    }
    await page.goto(new URL(`/snapshots/dir/${root}`, page.url()).href);
    await page.getByRole("button", { name: "恢复", exact: true }).click();
  }
  await restoreDialog.getByText("目录", { exact: true }).click();
  await restoreDialog
    .getByRole("button", { name: "选择目录", exact: true })
    .click();
  await restoreDialog
    .getByRole("button", { name: "开始恢复", exact: true })
    .click();
  await expect
    .poll(() => fs.existsSync(path.join(restored, "sample.txt")))
    .toBe(true);
  expect(fs.readFileSync(path.join(restored, "sample.txt"), "utf8")).toBe(
    "native dialog round trip",
  );

  const restoredFile = path.join(restored, "sample.txt");
  const preservedFile = path.join(restored, "keep.txt");
  fs.writeFileSync(restoredFile, "original target data");
  fs.writeFileSync(preservedFile, "preserve this file");
  await page.goto(new URL(`/snapshots/dir/${root}`, page.url()).href);
  await page.getByRole("button", { name: "恢复", exact: true }).click();
  await restoreDialog
    .getByRole("button", { name: "选择目录", exact: true })
    .click();
  await restoreDialog
    .getByRole("button", { name: "开始恢复", exact: true })
    .click();
  await expect(
    restoreDialog.getByRole("button", { name: "全部替换", exact: true }),
  ).toBeVisible();
  expect(fs.readFileSync(restoredFile, "utf8")).toBe("original target data");
  await restoreDialog
    .getByRole("button", { name: "取消", exact: true })
    .click();
  await expect(restoreDialog).not.toBeVisible();
  expect(fs.readFileSync(restoredFile, "utf8")).toBe("original target data");

  await page.getByRole("button", { name: "恢复", exact: true }).click();
  await restoreDialog
    .getByRole("button", { name: "选择目录", exact: true })
    .click();
  await restoreDialog
    .getByRole("button", { name: "开始恢复", exact: true })
    .click();
  await restoreDialog
    .getByRole("button", { name: "全部替换", exact: true })
    .click();
  await expect
    .poll(() => fs.readFileSync(restoredFile, "utf8"))
    .toBe("native dialog round trip");
  expect(fs.readFileSync(preservedFile, "utf8")).toBe("preserve this file");

  await page.goto(new URL("/preferences", page.url()).href);
  await page.getByRole("tab", { name: "恢复", exact: true }).click();
  const restorePermissions = page.getByRole("switch", {
    name: "恢复文件权限",
    exact: true,
  });
  await expect(restorePermissions).toBeChecked();
  await restorePermissions.uncheck();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("偏好设置已更新", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "恢复", exact: true }).click();
  await expect(restorePermissions).not.toBeChecked();
});

test.describe("when non-default repository config exists", () => {
  const NON_DEFAULT_REPO_ID = "repository-42";

  test.beforeEach(async () => {
    fs.writeFileSync(
      path.join(tmpAppDataDir, "kopia", `${NON_DEFAULT_REPO_ID}.config`),
      "",
    );
  });

  test("opens a visible repository window when non-default repository config exists", async () => {
    electronApp = await launchApp(tmpAppDataDir);

    await waitForKopiaToStartup();
    const windows = electronApp.windows();
    expect(windows).toHaveLength(1);
    await expect
      .poll(() =>
        electronApp.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0]?.isVisible(),
        ),
      )
      .toBe(true);
  });

  test("doesn't add default repository", async () => {
    electronApp = await launchApp(tmpAppDataDir);

    await waitForKopiaToStartup();

    const configs = await electronApp.evaluate(async ({ app }) => {
      return app.testHooks.allConfigs();
    });
    expect(configs).toStrictEqual([NON_DEFAULT_REPO_ID]);
  });
});
