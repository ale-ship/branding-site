# setup-dev-db.ps1  -  the local Postgres for the backend on a Windows development machine
# (docs/BACKEND_RUNBOOK.md, "Setting up Postgres and Redis on a development machine").
#
#   powershell -ExecutionPolicy Bypass -File scripts\setup-dev-db.ps1
#
# Asks for the postgres superuser's password (never shown or stored), makes a random password for
# the role noorcom_branding, creates or updates the role and the databases noorcom_branding and
# noorcom_branding_test with the same settings as the VPS, and writes DATABASE_URL and
# TEST_DATABASE_URL into backend\.env (never committed). Safe to run again: it only resets the
# role's password and rewrites those two lines.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root 'backend\.env'
$example = Join-Path $root 'backend\.env.example'

$psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
if (-not $psql) {
  $psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $psql) { throw 'psql not found: install PostgreSQL or put its bin folder on the PATH.' }

$secure = Read-Host -AsSecureString 'Password for the postgres superuser'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

function Invoke-Psql([string]$sql, [string]$db = 'postgres') {
  $out = & $psql -U postgres -h 127.0.0.1 -d $db -v ON_ERROR_STOP=1 -tAc $sql 2>&1
  if ($LASTEXITCODE -ne 0) { throw "psql failed: $out" }
  return "$out".Trim()
}

try {
  [void](Invoke-Psql 'SELECT 1')

  # Hex only: safe inside a URL and inside SQL quotes.
  $bytes = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $rolePassword = -join ($bytes | ForEach-Object { $_.ToString('x2') })

  if ((Invoke-Psql "SELECT 1 FROM pg_roles WHERE rolname = 'noorcom_branding'") -eq '1') {
    [void](Invoke-Psql "ALTER ROLE noorcom_branding LOGIN PASSWORD '$rolePassword'")
    Write-Host 'Role noorcom_branding: password reset.'
  } else {
    [void](Invoke-Psql "CREATE ROLE noorcom_branding LOGIN PASSWORD '$rolePassword'")
    Write-Host 'Role noorcom_branding: created.'
  }
  # The same limits as the VPS (docs/VPS_BRANDING.md section 8).
  [void](Invoke-Psql "ALTER ROLE noorcom_branding SET statement_timeout = '15s'")
  [void](Invoke-Psql "ALTER ROLE noorcom_branding SET idle_in_transaction_session_timeout = '30s'")

  foreach ($db in 'noorcom_branding', 'noorcom_branding_test') {
    if ((Invoke-Psql "SELECT 1 FROM pg_database WHERE datname = '$db'") -ne '1') {
      [void](Invoke-Psql "CREATE DATABASE $db OWNER noorcom_branding")
      Write-Host "Database ${db}: created."
    } else {
      Write-Host "Database ${db}: already there."
    }
    [void](Invoke-Psql "REVOKE CONNECT ON DATABASE $db FROM PUBLIC")
  }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

# backend\.env: from the example the first time, then only the two database lines change.
if (-not (Test-Path $envFile)) { Copy-Item $example $envFile }
$url = "postgres://noorcom_branding:$rolePassword@127.0.0.1:5432"
$lines = Get-Content $envFile | ForEach-Object {
  if ($_ -match '^DATABASE_URL=') { "DATABASE_URL=$url/noorcom_branding" }
  elseif ($_ -match '^TEST_DATABASE_URL=') { "TEST_DATABASE_URL=$url/noorcom_branding_test" }
  else { $_ }
}
[IO.File]::WriteAllLines($envFile, [string[]]$lines, (New-Object Text.UTF8Encoding($false)))

# Check: the role reaches its own database.
$env:PGPASSWORD = $rolePassword
try {
  $who = & $psql -U noorcom_branding -h 127.0.0.1 -d noorcom_branding -tAc 'SELECT current_user' 2>&1
  if ($LASTEXITCODE -ne 0) { throw "noorcom_branding cannot connect: $who" }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
Write-Host "Done: backend\.env has DATABASE_URL and TEST_DATABASE_URL (connected as $("$who".Trim()))."
