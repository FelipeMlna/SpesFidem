#!/bin/bash
# ============================================================
#   SPESFIDEM - Script de Build Unificado para Vercel
#   Combina el sitio estático raíz + React SPA /consultoria
# ============================================================

set -e  # Detener si cualquier comando falla

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║    SPESFIDEM - BUILD UNIFICADO PARA VERCEL    ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# 1. Compilar la app React
echo "→ [1/3] Compilando app React (consultoria-app/frontend)..."
cd consultoria-app/frontend
npm install --legacy-peer-deps
npm run build
cd ../..
echo "✓ React build completado."

# 2. Crear carpeta de salida limpia
echo ""
echo "→ [2/3] Creando carpeta vercel_dist..."
rm -rf vercel_dist
mkdir -p vercel_dist

# 3. Copiar todos los archivos estáticos del sitio raíz
echo ""
echo "→ [3/3] Copiando archivos estáticos del sitio raíz..."

# Archivos HTML principales
for file in *.html; do
  [ -f "$file" ] && cp "$file" vercel_dist/ && echo "  ✓ Copiado: $file"
done

# Archivos individuales importantes
cp manifest.json vercel_dist/ 2>/dev/null && echo "  ✓ Copiado: manifest.json"
cp sw.js vercel_dist/ 2>/dev/null && echo "  ✓ Copiado: sw.js"

# Carpetas del sitio estático
for dir in css js images assets data; do
  if [ -d "$dir" ]; then
    cp -r "$dir" vercel_dist/
    echo "  ✓ Copiada carpeta: $dir"
  fi
done

# 4. Copiar el build de React a /consultoria dentro del dist
echo ""
echo "→ [4/4] Copiando build React a vercel_dist/consultoria..."
mkdir -p vercel_dist/consultoria
cp -r consultoria-app/frontend/dist/. vercel_dist/consultoria/
echo "  ✓ App React copiada en vercel_dist/consultoria/"

# Resumen final
echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║         ✅ BUILD COMPLETADO CON ÉXITO         ║"
echo "╠═══════════════════════════════════════════════╣"
echo "║  Estructura en vercel_dist/:                  ║"
echo "║    /          → Landing page (index.html)     ║"
echo "║    /consultoria → React SPA (Vite build)      ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
