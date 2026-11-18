# Levanta backend (puerto 8000) y front (puerto 5173) en Windows.
# Uso:  powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
# Todas las rutas son absolutas y se calculan desde la carpeta de este script,
# así que el proyecto funciona en cualquier ubicación o equipo.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$venv = Join-Path $backend '.venv'
$py = Join-Path $venv 'Scripts\python.exe'
$reqs = Join-Path $backend 'requirements-dev.txt'

# Un .venv copiado de otro equipo o carpeta apunta a un Python que ya no existe: se recrea.
function Test-Venv {
  if (-not (Test-Path $py)) { return $false }
  try { & $py -c 'import fastapi, uvicorn' 2>$null; return ($LASTEXITCODE -eq 0) } catch { return $false }
}

if (-not (Test-Venv)) {
  if (Test-Path $venv) {
    Write-Host 'El entorno virtual no sirve en este equipo; se recrea...'
    Remove-Item -Recurse -Force $venv
  } else {
    Write-Host 'Creando entorno virtual de Python...'
  }
  python -m venv $venv
  & $py -m pip install --upgrade pip
  & $py -m pip install -r $reqs
}
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
  Write-Host 'Instalando dependencias del front...'
  npm ci --prefix $frontend
}

$api = Start-Process -FilePath $py -ArgumentList '-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000' -WorkingDirectory $backend -PassThru -NoNewWindow
try {
  Write-Host ''
  Write-Host 'Backend: http://127.0.0.1:8000/api/health'
  Write-Host 'Abre:    http://127.0.0.1:5173   (Ctrl+C para detener todo)'
  Push-Location $frontend
  npm run dev
} finally {
  Pop-Location
  if (-not $api.HasExited) { Stop-Process -Id $api.Id -Force }
}
