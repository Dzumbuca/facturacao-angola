param(
  [switch]$Confirm
)

$ErrorActionPreference = 'Stop'

function Get-EnvValue {
  param([string]$File, [string]$Key)
  $line = Select-String -Path $File -Pattern ("^" + [regex]::Escape($Key) + "=") | Select-Object -First 1
  if (-not $line) { return $null }
  return $line.Line.Split('=', 2)[1].Trim().Trim('"')
}

$stagingFile = ".env.staging"
if (-not (Test-Path $stagingFile)) { throw "Ficheiro .env.staging não encontrado." }

$dbUrl = Get-EnvValue -File $stagingFile -Key "DATABASE_URL"
$directUrl = Get-EnvValue -File $stagingFile -Key "DIRECT_URL"

if (-not $dbUrl -or -not $directUrl) { throw "DATABASE_URL ou DIRECT_URL em falta." }

# Validar Project Ref no user
if ($dbUrl -notmatch "postgres\.osyhgswlczgnugvsshca") { throw "DATABASE_URL não corresponde ao projecto de staging." }
if ($directUrl -notmatch "postgres\.osyhgswlczgnugvsshca") { throw "DIRECT_URL não corresponde ao projecto de staging." }

# Validar host e portas
if ($dbUrl -notmatch "aws-0-eu-west-1.pooler.supabase.com:6543") { throw "DATABASE_URL host/porta inválidos." }
if ($directUrl -notmatch "aws-0-eu-west-1.pooler.supabase.com:5432") { throw "DIRECT_URL host/porta inválidos." }

Write-Host "Project Ref validado: osyhgswlczgnugvsshca" -ForegroundColor Green
Write-Host "Portas validadas: 6543 (pooler) / 5432 (direct)" -ForegroundColor Green

# Guardar env original
$origDb = $env:DATABASE_URL
$origDirect = $env:DIRECT_URL

# Criar diretório temporário com cópia do prisma (sem .env)
$tempDir = Join-Path $env:TEMP "prisma-staging-$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir | Out-Null
Copy-Item -Path "prisma" -Destination (Join-Path $tempDir "prisma") -Recurse

$schemaPath = Join-Path $tempDir "prisma/schema.prisma"

# Definir env vars para o processo (prevalecem sobre .env? Prisma pode carregar .env do cwd; usamos cwd temp sem .env)
$env:DATABASE_URL = $dbUrl
$env:DIRECT_URL = $directUrl

Push-Location $tempDir
try {
  if (-not $Confirm) {
    Write-Host "Dry-run: validação de segurança concluída. Executando migrate status..." -ForegroundColor Yellow
    npx prisma migrate status --schema $schemaPath
  } else {
    npx prisma migrate deploy --schema $schemaPath
    npx prisma migrate status --schema $schemaPath
    npx prisma validate --schema $schemaPath
  }
} finally {
  Pop-Location
  $env:DATABASE_URL = $origDb
  $env:DIRECT_URL = $origDirect
  Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
  Write-Host "Ambiente original restaurado." -ForegroundColor Green
}

