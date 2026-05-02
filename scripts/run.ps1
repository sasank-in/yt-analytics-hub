#!/usr/bin/env pwsh
# Run the YouTube Analytics API server.
# Usage: ./scripts/run.ps1 [port]
param([int]$Port = 8000)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $env:YOUTUBE_API_KEY) {
    Write-Warning "YOUTUBE_API_KEY is not set. Channel/video lookups will fail until it is."
}

python main_api.py $Port
