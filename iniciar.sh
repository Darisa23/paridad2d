#!/usr/bin/env bash
# Levanta backend (puerto 8000) y front (puerto 5173) en macOS / Linux.
# Uso:  ./iniciar.sh
# Todas las rutas son absolutas y se calculan desde la carpeta de este script,
# así que el proyecto funciona en cualquier ubicación o equipo.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
VENV="$BACKEND/.venv"
PY="$VENV/bin/python"

# Un .venv copiado de otro equipo o carpeta apunta a un Python que ya no existe: se recrea.
if ! { [ -x "$PY" ] && "$PY" -c 'import fastapi, uvicorn' >/dev/null 2>&1; }; then
  if [ -d "$VENV" ]; then
    echo "El entorno virtual no sirve en este equipo; se recrea..."
    rm -rf "$VENV"
  else
    echo "Creando entorno virtual de Python..."
  fi
  python3 -m venv "$VENV"
  "$PY" -m pip install --upgrade pip
  "$PY" -m pip install -r "$BACKEND/requirements-dev.txt"
fi
if [ ! -d "$FRONTEND/node_modules" ]; then
  echo "Instalando dependencias del front..."
  npm ci --prefix "$FRONTEND"
fi

(cd "$BACKEND" && "$PY" -m uvicorn app.main:app --host 127.0.0.1 --port 8000) &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT INT TERM

echo
echo "Backend: http://127.0.0.1:8000/api/health"
echo "Abre:    http://127.0.0.1:5173   (Ctrl+C para detener todo)"
cd "$FRONTEND" && npm run dev
