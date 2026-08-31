#!/bin/sh
# ============================================================
#   SPESFIDEM - Script de Build Unificado para Vercel
#   Combina el sitio estático raíz + React SPA /consultoria
# ============================================================

set -e

echo "=== SPESFIDEM BUILD UNIFICADO ==="

# 1. Compilar la app React
echo "-> Compilando app React..."
cd consultoria-app/frontend
npm install --legacy-peer-deps
npm run build
cd ../..
echo "OK: React build completado."

# 2. Crear carpeta de salida limpia
echo "-> Creando carpeta vercel_dist..."
rm -rf vercel_dist
mkdir -p vercel_dist

# 3. Copiar archivos estáticos del sitio raíz
echo "-> Copiando archivos estaticos..."

# Archivos HTML principales
for file in *.html; do
  [ -f "$file" ] && cp "$file" vercel_dist/
done

# Archivos individuales importantes
cp manifest.json vercel_dist/ 2>/dev/null || true
cp sw.js vercel_dist/ 2>/dev/null || true

# Carpetas del sitio estático
for dir in css js images assets data; do
  if [ -d "$dir" ]; then
    cp -r "$dir" vercel_dist/
  fi
done

# 4. Copiar el build de React a /consultoria
echo "-> Copiando build React a vercel_dist/consultoria..."
mkdir -p vercel_dist/consultoria
cp -r consultoria-app/frontend/dist/. vercel_dist/consultoria/

echo "=== BUILD COMPLETADO ==="
echo "Estructura: / = Landing, /consultoria = React SPA"
