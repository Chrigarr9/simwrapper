param(
  [string]$DashboardDir
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path "$PSScriptRoot\..\.."
$simwrapper = Resolve-Path "$PSScriptRoot\.."

if (-not $DashboardDir) {
  $DashboardDir = Join-Path $root "outputs\lyon-bounds-b3c8df2c\simwrapper"
}

$dashboardDir = Resolve-Path -LiteralPath $DashboardDir
$exportDir = Join-Path $dashboardDir "export"

if (Test-Path $exportDir) {
  Remove-Item -LiteralPath $exportDir -Recurse -Force
}

$dashboards = Get-ChildItem -LiteralPath $dashboardDir -Filter "dashboard-paper-cs*.yaml" |
  Sort-Object Name

if (-not $dashboards) {
  Write-Warning "No dashboard-paper-cs*.yaml files found in $dashboardDir"
  return
}

foreach ($dashboard in $dashboards) {
  Push-Location $simwrapper
  try {
    npm run export -- $dashboard.FullName
  } finally {
    Pop-Location
  }
}

if (Test-Path $exportDir) {
  Get-ChildItem -LiteralPath $exportDir -Filter "*.png" |
    Select-Object Name, Length |
    Format-Table -AutoSize
}
