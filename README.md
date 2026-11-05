# Kopiam

![Kopia](icons/kopia.svg)

[简体中文](#简体中文) | [English](#english)

## 简体中文

Kopiam 是基于 Kopia 定制的开源备份与恢复工具，将 Go 服务、自定义 React
界面和 Electron 桌面外壳整合到同一个仓库。README 默认以中文展示，界面默认语言
为简体中文，也可在偏好设置中切换英文或挪威语。

### 项目来源

- **Go 服务与备份引擎**：来源于 [kopia/kopia](https://github.com/kopia/kopia)，
  保留原项目的 Git 历史，并在其基础上进行定制。
- **React UI**：在 [joachimdalen/kopia-alternate-ui](https://github.com/joachimdalen/kopia-alternate-ui)
  的基础上修改，加入中文支持、本地 Kopia 服务集成和桌面交互改进。
- **Electron 桌面外壳**：沿用 Kopia 项目的桌面应用结构，并适配自定义 UI。

感谢两个上游项目及其贡献者。本项目是独立的定制版本，并非 Kopia 或
Kopia Alternate UI 官方发布，也不代表上游项目的认可或支持。

### 主要功能

- 文件与目录快照备份、历史版本浏览和恢复。
- 沿用 Kopia 的加密、去重、压缩及多种存储后端，包括本地目录、NAS、
  S3 兼容存储、Azure Blob、Backblaze B2、Google Cloud Storage、SFTP、
  WebDAV 和 Rclone；Rclone 支持仍属实验性功能。
- 简体中文界面，支持直接嵌入 Go 二进制，由 Kopia 同源提供页面与 API。
- Electron 原生文件和目录选择、快照下载及挂载目录浏览。
- 恢复偏好设置、目标覆盖确认、快照警告、任务进度与日志展示。
- 已连接仓库页提供“更新并关机”：确认后更新当前仓库的所有本机备份源，
  全部成功后调用系统关机命令；此功能仅在桌面版提供。

“更新并关机”会实际关闭运行 KopiaUI 的电脑，请先保存其他程序中的工作。
任务失败、取消、无法确认完成或存在活动备份任务时不会自动关机。
更新使用与普通快照更新相同的服务端接口和策略；任务成功结束后，即使有错误或快照不完整也允许关机，
部分文件可能未备份，请查看任务日志。
系统需要授予关机权限，成功调用后预留约 60 秒。详细行为见 [构建与功能说明](BUILD.md)。

### 仓库结构

| 目录 | 内容 |
| --- | --- |
| [cli](cli/)、[repo](repo/)、[snapshot](snapshot/)、[internal](internal/) | Go 命令行、仓库、备份及内部服务 |
| [htmlui](htmlui/README.md) | 自定义 React UI、翻译和页面测试 |
| [app](app/) | Electron 桌面外壳和桌面测试 |
| [tools](tools/) | 构建工具和本地 Go 工作区 |

### 构建

准备 Git、[go.mod](go.mod) 指定的 Go 工具链，以及满足项目依赖要求的 Node.js
和 npm。以下 PowerShell 命令从仓库根目录执行。

首次克隆后安装前端与桌面依赖：

```powershell
Push-Location htmlui
npm ci
Pop-Location
Push-Location app
npm ci
Pop-Location
```

构建 React UI、嵌入页面的 Go 服务并打包 Electron：

```powershell
& .\tools\build-local-ui.ps1
```

仅构建 UI 和 Go 服务：

```powershell
& .\tools\build-local-ui.ps1 -SkipElectron
```

Windows 安装包和 ZIP 位于 [dist/kopia-ui](dist/kopia-ui/)，Go 可执行文件位于
`dist/kopia_windows_amd64/kopia.exe`。生成目录和依赖不提交到 Git。
无需额外克隆 UI 仓库。脚本通过 [本地工作区](tools/localhtmlui.work) 嵌入自定义 UI；
直接运行未使用该工作区的 `go build` 仍使用上游预构建 UI。
其他平台及 GNU Make 构建方式见 [BUILD.md](BUILD.md)。

### 更新 Go 上游

本项目只跟进 Go 服务上游，自定义 UI 在本仓库独立维护，不需要合并 UI 上游。
先提交本地改动，再执行：

```powershell
# 仅首次配置
git remote add upstream https://github.com/kopia/kopia.git

git fetch upstream
git merge upstream/master
```

合并可能需要处理自定义 Go 代码和构建文件的冲突。更新后请重新构建并测试，
确认自定义 UI 与服务 API 兼容；不要用上游 UI 覆盖 [htmlui](htmlui/)。

### 文档与许可

- [本项目构建说明](BUILD.md)与 [UI 功能说明](htmlui/README.md)。
- [Kopia 官方文档](https://kopia.io/docs/)可用于了解备份、存储、策略和恢复概念，
  但官方界面与本项目的定制界面有所不同。
- 本项目保留 Apache License 2.0 许可，见 [LICENSE](LICENSE) 和
  [UI LICENSE](htmlui/LICENSE)。分发时请保留许可文件及适用的上游版权声明。

## English

Kopiam is a customized, open-source backup and restore application based on Kopia.
This repository combines the Go backend, a custom React UI, and the Electron
desktop shell in one checkout. Chinese is presented first in this README.
The interface defaults to Simplified Chinese, with English and Norwegian available
in Preferences.

### Origins and attribution

- **Go backend and backup engine**: derived from
  [kopia/kopia](https://github.com/kopia/kopia), preserving its Git history
  alongside local customizations.
- **React UI**: modified from
  [joachimdalen/kopia-alternate-ui](https://github.com/joachimdalen/kopia-alternate-ui),
  adding Chinese localization, integration with the local Kopia service, and
  desktop interaction improvements.
- **Electron shell**: based on Kopia's desktop application and adapted to the
  custom UI.

Thanks to both upstream projects and their contributors. This is an independent
customized version, not an official release of Kopia or Kopia Alternate UI.
It is not endorsed or supported by those projects.

### Features

- Snapshot backups, history browsing, and restoration of files and directories.
- Kopia's encryption, deduplication, compression, and storage backends, including
  local directories, NAS, S3-compatible storage, Azure Blob, Backblaze B2,
  Google Cloud Storage, SFTP, WebDAV, and Rclone. Rclone support remains experimental.
- A localized React UI embedded in the Go binary and served alongside the Kopia API.
- Native Electron file and directory dialogs, snapshot downloads, and browsing
  of mounted snapshots.
- Restore preferences, overwrite confirmation, snapshot warnings, task progress,
  and logs.
- A desktop-only **Update and shut down** action that updates all local backup
  sources in the connected repository before requesting an OS shutdown.

The shutdown action powers off the computer running KopiaUI. Save other work
before confirming. Failed or canceled tasks, unconfirmed completion,
and active backup tasks prevent automatic shutdown.
Updates use the same server API and policy as ordinary snapshot updates;
successful tasks permit shutdown even with file errors or incomplete snapshots.
Some files may remain unbacked up; review task logs. OS shutdown permission is
required, and a successful request provides approximately 60 seconds before shutdown.
See [BUILD.md](BUILD.md) for details.

### Repository layout

| Directory | Contents |
| --- | --- |
| [cli](cli/), [repo](repo/), [snapshot](snapshot/), [internal](internal/) | Go CLI, repositories, backups, and internal services |
| [htmlui](htmlui/README.md) | Custom React UI, translations, and UI tests |
| [app](app/) | Electron desktop shell and desktop tests |
| [tools](tools/) | Build tools and the local Go workspace |

### Building

Install Git, the Go toolchain specified by [go.mod](go.mod), and Node.js/npm
compatible with the project dependencies. Run these PowerShell commands from
the repository root.

Install dependencies after cloning:

```powershell
Push-Location htmlui
npm ci
Pop-Location
Push-Location app
npm ci
Pop-Location
```

Build the React UI, Go backend with embedded assets, and Electron package:

```powershell
& .\tools\build-local-ui.ps1
```

To build only the UI and Go backend:

```powershell
& .\tools\build-local-ui.ps1 -SkipElectron
```

Windows installer and ZIP artifacts are written to [dist/kopia-ui](dist/kopia-ui/);
the Go executable is written to `dist/kopia_windows_amd64/kopia.exe`.
Generated assets and dependencies are not committed. No separate UI checkout is
required. The script selects [the local workspace](tools/localhtmlui.work) to embed
the custom UI; plain `go build` without that workspace still uses the upstream
prebuilt UI. See [BUILD.md](BUILD.md) for other platforms and GNU Make targets.

### Updating the backend

Only the Go backend tracks upstream updates. The custom UI is maintained in this
repository and does not require upstream UI merges. Commit local changes first:

```powershell
# Configure once
git remote add upstream https://github.com/kopia/kopia.git

git fetch upstream
git merge upstream/master
```

Resolve conflicts in customized Go code and build files, then rebuild and test
API compatibility with the custom UI. Do not overwrite [htmlui](htmlui/) with
upstream UI sources.

### Documentation and license

- [Build documentation](BUILD.md) and [custom UI documentation](htmlui/README.md).
- [Official Kopia documentation](https://kopia.io/docs/) explains backup, storage,
  policy, and restore concepts; the official UI differs from this custom interface.
- This project retains the Apache License 2.0. See [LICENSE](LICENSE) and
  [the UI license](htmlui/LICENSE). Preserve license files and applicable upstream
  copyright notices when distributing the project.
