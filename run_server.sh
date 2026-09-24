#!/bin/bash
echo "------------------------------------------"
echo "  SISTEMA ADMINISTRATIVO SPESFIDEM (Node.js)"
echo "------------------------------------------"
echo "1. Limpiando procesos previos..."
fuser -k 3000/tcp 2>/dev/null

echo "2. Iniciando servidor Node.js + PostgreSQL..."
echo "------------------------------------------"
npm start
