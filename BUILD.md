# Kopia Build Architecture

![Kopia](icons/kopia.svg)

Kopia build pipeline is set up to generate the following artifacts:

* Standalone `kopia` executable for all supported platforms, optionally with embedded graphical UI
* KopiaUI - desktop app for all supported platforms: Windows, macOS, and Linux
* The static content of [kopia.io](https://kopia.io) website

Kopia build is based on `Makefile` and provides the following main targets:

* `$ make install` - builds full `kopia` command-line executable that also embeds graphical UI components that can be used in a browser. The output is stored in `$HOME/go/bin/kopia`

* `$ make install-noui` - builds simplified `kopia` executable without embedded graphical UI. The output is stored in `$HOME/go/bin/kopia`

* `$ make goreleaser && make kopia-ui` - builds desktop application based on [Electron](https://electronjs.org) using [Electron Builder](https://electron.build) The output is stored in the `dist/kopia-ui` subdirectory

* `$ make website` - builds [kopia.io](https://kopia.io) website using [Hugo](https://gohugo.io). The output is stored in `site/public` and published to [Github Pages](https://github.com/kopia/kopia.github.io) from [Travis CI](https://travis-ci.org/kopia/kopia) on each build.

The project structure is also compatible with `go get`, so getting the latest Kopia command line tool (albeit without any UI functionality) is as simple as:

```
$ go get github.com/kopia/kopia
```

## Build Pipeline Overview

The following picture provides high-level overview of the build pipeline.

![Build Architecture](build_architecture.svg)

## HTML UI

THe HTML UI builds HTML-based user interface that is embedded in Kopia binary by using [go:embed](https://pkg.go.dev/embed).

The UI is build using [React](https://reactjs.org) and more specifically [Create React App](https://reactjs.org/docs/create-a-new-react-app.html#create-react-app) toolchain.

The source code for HTML UI is in https://github.com/kopia/htmlui and pre-built UI HTML is
available as Golang module that can be imported from `github.com/kopia/htmluibuilds`

When developing the UI, the most convenient way is to use two terminals. The first terminal runs `kopia server` which exposes the API that the UI needs. The second one runs development server of React with hot-reload, so changes are immediately reflected in the browser. 

In the first terminal do:

```shell
$ go run . server start --insecure --without-password --disable-csrf-token-checks
```

In the second terminal, in the `htmlui` repository run:

```shell
$ npm run start
```

This will automatically open the browser with the UI page on http://localhost:3000. Changing any file under `htmlui` will cause the browser to hot-reload the change. In most cases, the changes to the kopia server don't even require reloading the browser.

Changes to `htmlui` need to be individually submitted to their own repository and after they get built and tagged, you need to update the go.mod dependency:

```shell
go get -u github.com/kopia/htmluibuild
```

It is also possible to test Kopia HTML UI with pre-built HTML. To do this:

1. In `htmlui` repository run:

```shell
$ npm run build
```

2. In the `kopia` repository run:

```shell
go run . server start --insecure --without-password --html=../htmlui/build
```

## KopiaUI App

### Bundled custom UI

The local `tools/localhtmlui.work` workspace replaces `github.com/kopia/htmluibuild`
with the React project in `htmlui/`. The root repository retains the upstream
Kopia Git history; the custom UI is maintained here without importing UI upstream
updates. No sibling checkout or Git submodule is required.

Install dependencies once after cloning:

```powershell
Push-Location htmlui
npm ci
Pop-Location
Push-Location app
npm ci
Pop-Location
```

Build the custom UI, embedded Go binary, and Electron package from the root:

```powershell
& .\tools\build-local-ui.ps1
# Build only the UI and Go binary:
& .\tools\build-local-ui.ps1 -SkipElectron
```

The resulting binary serves the alternate UI without `--html`, keeps CSRF checks
enabled, and is also used by the Electron packaging step. Assets in `htmlui/dist`
are generated and are not committed. The script stops on build failure and restores
the caller's directory and `GOWORK`. Existing upstream build targets remain available;
plain `go build` without this workspace still uses the upstream prebuilt UI.
With GNU Make, use `make install-with-local-htmlui-changes` or
`make kopia-ui-with-local-htmlui-changes` after installing Node dependencies.

For backend updates, commit local changes first, configure
`git remote add upstream https://github.com/kopia/kopia.git` once, then run
`git fetch upstream` and `git merge upstream/master`. Do not overwrite the custom
UI directory with upstream UI sources. Resolve backend and build-file conflicts
and rebuild the custom UI to verify API compatibility after updating.
The imported UI's Apache-2.0 license remains in `htmlui/LICENSE`.

Snapshot task logs retain the latest 100 non-error entries and all error entries
until the task is evicted from the in-memory task history. Rebuild both the alternate
UI and Kopia after changing log retention; rebuilding only the UI cannot recover
errors discarded by an older server.

Restore defaults are saved under **Preferences > Restore** in the server's UI
preferences file. The restore dialog only asks for the format and destination.
UI restores check the destination before creating a task or opening an output
file. Existing non-empty directories and existing files (including ZIP/TAR)
require **Replace all** or **Cancel**, regardless of the overwrite defaults.
Replace all merges directories, overwrites matching files and symlinks, and
disables incremental skipping for that restore; unrelated files are retained.
Cancel starts no task and writes nothing. Rebuild the UI and Kopia together.
KopiaUI opens repository windows on every launch, not only on its first run;
closing the windows still leaves the application running in the tray.

The desktop repository page provides **Update and shut down** before **Disconnect**.
After native confirmation it snapshots every source belonging to the connected
repository's local user and host, including manual sources, using that repository's
running server, through the same `/api/v1/sources/upload` endpoint as ordinary
snapshot updates. Updates run sequentially, with progress and logs available on
the snapshot and task pages. Each update waits for a new matching snapshot task
to succeed and for the source manager to refresh its snapshot status; an existing
snapshot or an accepted upload request alone is not proof of completion.
API requests first obtain the server's
UI session cookie and matching CSRF token over certificate-verified HTTPS; CSRF
checks remain enabled. A confirmed successful task permits shutdown even when
error counters are nonzero or unavailable, or the snapshot is incomplete.
Some files may therefore remain unbacked up; review errors on the task pages.
Failed or canceled tasks, unconfirmed completion, and active server backups
still prevent shutdown. No extra CLI `--fail-fast` flag is applied.
Paused or unready sources must be resumed
before starting. A request that produces no matching task within approximately
60 seconds fails without shutdown; running backups are allowed to finish without
a fixed duration limit. Identical snapshots
may be skipped according to retention policy. Windows, macOS, and Linux schedule
shutdown in 60 seconds without forcing applications closed; the OS must grant
shutdown permission. Browser-only and multi-server pages do not offer this action.
Rebuild the alternate UI, Kopia binary, and Electron package together.
For desktop-only fixes, reuse the existing UI and Go binary and run
`npm run build-electron-windows` from `app` on Windows. Run the source-request and
shutdown regression tests with
`node --test app/tests/server-sources.node.mjs app/tests/update-and-shutdown.node.mjs`
from the repository root; these tests do not shut down the machine.

KopiaUI is built using [Electron](https://electronjs.org) and packaged as native binary using [Electron Builder](https://electron.build). The app is just a shell that invokes `kopia server --ui` and connects the browser to it, plus it provides native system tray integration. Kopia executable is embedded as a resource inside KopiaUI app, to simplify usage.

To build the app:

```shell
$ make kopia-ui
```

The generated app will be in:

* `dist/kopia-ui/win-unpacked` on Windows
* `dist/kopia-ui/mac/KopiaUI.app` - on macOS
* `dist/kopia-ui/linux-unpacked` on Linux

When developing the app shell it is convenient to simply run Electron directly on the source code without building.

```shell
$ make -C app dev
```

>NOTE: this also opens the browser window due to CRA development server, but it can be safely disregarded. Because KopiaUI configuration pages are built using CRA, they also benefit from hot-reload while developing this way.

To build KopiaUI using the bundled custom UI, install dependencies in `htmlui`
and `app`, then run from this repository:

```
$ make kopia-ui-with-local-htmlui-changes
```

## Website

The [kopia.io](https://kopia.io) website is built using [Hugo](https://gohugo.io).

To build the website use:

```shell
$ make -C site build
```

This will auto-generate [Markdown](https://en.wikipedia.org/wiki/Markdown) files with documentation for currently supported Kopia CLI subcommands and store them under `site/content/docs/Reference/Command-Line` and then generate the website which is stored in `site/public`.

To see the  website in a browser it's more convenient to use:

```shell
$ make -C site server
```

This starts a server on http://localhost:1313 where the website can be browsed.
