#!/bin/bash
# ============================================
#   SISTEMA SPESFIDEM - INICIO AUTOMÁTICO
# ============================================

echo ""
echo "╔══════════════════════════════════════╗"
echo "║    SISTEMA ADMINISTRATIVO SPESFIDEM  ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Detener cualquier servidor anterior
pkill -f server.py 2>/dev/null
sleep 1

# Iniciar el servidor
cd "$(dirname "$0")"
echo "  Iniciando servidor en puerto 3000..."
python3 server.py > /tmp/spesfidem_server.log 2>&1 &
SERVER_PID=$!

# Esperar a que esté listo
sleep 2

# Verificar que esté corriendo
if kill -0 $SERVER_PID 2>/dev/null; then
    echo "  ✓ Servidor activo (PID: $SERVER_PID)"
    echo ""
    echo "  Abriendo panel administrativo..."
    echo ""
    echo "  ┌──────────────────────────────────────────────────┐"
    echo "  │   ENLACE: http://localhost:3000/admin.html       │"
    echo "  └──────────────────────────────────────────────────┘"
    echo ""
    echo "  CREDENCIALES VÁLIDAS:"
    echo "  ─────────────────────────────────────────"
    echo "  Doc: 14298116      Clave: 14298116Je*"
    echo "  Doc: 1106227253    Clave: 7253pipe"
    echo "  Doc: 1005703432    Clave: 3432sergio"
    echo "  Doc: 1104942399    Clave: 2399caleb"
    echo "  ─────────────────────────────────────────"
    echo ""
    
    # Abrir el navegador automáticamente
    if command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:3000/admin.html" 2>/dev/null &
    elif command -v firefox &> /dev/null; then
        firefox "http://localhost:3000/admin.html" 2>/dev/null &
    elif command -v google-chrome &> /dev/null; then
        google-chrome "http://localhost:3000/admin.html" 2>/dev/null &
    else
        echo "  Abra manualmente: http://localhost:3000/admin.html"   
    fi
    
    echo "  Presione Ctrl+C para detener el servidor."
    echo ""
    wait $SERVER_PID
else
    echo "  ERROR: No se pudo iniciar el servidor."
    echo "  Ver log: cat /tmp/spesfidem_server.log"
    exit 1
fi
