param(
    [switch]$SkipElectron
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$previousGoWork = $env:GOWORK

Push-Location $root
try {
    Push-Location (Join-Path $root "htmlui")
    try {
        npm run build:kopia
        if ($LASTEXITCODE -ne 0) { throw "HTML UI build failed" }
    } finally {
        Pop-Location
    }

    $env:GOWORK = Join-Path $PSScriptRoot "localhtmlui.work"
    $goOS = go env GOOS
    if ($LASTEXITCODE -ne 0) { throw "Cannot determine Go target OS" }
    $goArch = go env GOARCH
    if ($LASTEXITCODE -ne 0) { throw "Cannot determine Go target architecture" }
    $binary = if ($goOS -eq "windows") { "kopia.exe" } else { "kopia" }
    $output = Join-Path $root "dist\kopia_${goOS}_${goArch}\$binary"
    New-Item -ItemType Directory -Force -Path (Split-Path $output) | Out-Null
    go build -trimpath -ldflags "-s -w" -o $output .
    if ($LASTEXITCODE -ne 0) { throw "Kopia build failed" }

    if (!$SkipElectron) {
        Push-Location (Join-Path $root "app")
        try {
            if ($goOS -eq "windows") {
                npm run build-electron-windows
            } else {
                npm run build-electron
            }
            if ($LASTEXITCODE -ne 0) { throw "Electron packaging failed" }
        } finally {
            Pop-Location
        }
    }
} finally {
    $env:GOWORK = $previousGoWork
    Pop-Location
}
