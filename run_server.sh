#!/bin/bash
echo "------------------------------------------"
echo "  SISTEMA ADMINISTRATIVO SPESFIDEM"
echo "------------------------------------------"
echo "1. Limpiando procesos previos..."
fuser -k 3000/tcp 2>/dev/null
fuser -k 8080/tcp 2>/dev/null

echo "2. Iniciando servidor..."
echo "------------------------------------------"
python3 server.py
