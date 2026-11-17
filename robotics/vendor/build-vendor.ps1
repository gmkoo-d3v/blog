$ErrorActionPreference = 'Stop'
$studyRoot = Split-Path -Parent $PSScriptRoot
$bundlerPath = Join-Path $studyRoot '.build/esbuild.exe'
if (-not (Test-Path -LiteralPath $bundlerPath)) {
    throw 'Run python vendor/fetch-three.py once to acquire the pinned build tool and official sources.'
}
$entryPath = Join-Path $PSScriptRoot 'three-entry.js'
$threePath = Join-Path $PSScriptRoot 'three-r187/three.module.js'
$outputPath = Join-Path $PSScriptRoot 'three-offline.js'
& $bundlerPath $entryPath --bundle --format=iife --global-name=RobotThree --minify "--alias:three=$threePath" "--outfile=$outputPath"
if ($LASTEXITCODE -ne 0) { throw 'Vendor build failed.' }
