#!/bin/bash

# --- COLORES ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}   SPESFIDEM - LANZADOR DE CONSULTORÍA VISUAL   ${NC}"
echo -e "${BLUE}==================================================${NC}"

# 1. Limpieza de puertos
echo -e "\n${YELLOW}1. Liberando puertos bloqueados...${NC}"
fuser -k 3001/tcp 2>/dev/null
fuser -k 5173/tcp 2>/dev/null
echo -e "${GREEN}✓ Puertos 3001 (Backend) y 5173 (Frontend) listos.${NC}"

# 2. Iniciar Backend
echo -e "\n${YELLOW}2. Iniciando Backend (Node.js)...${NC}"
cd consultoria-app/backend
if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias del backend..."
    npm install
fi
npm start > backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend lanzado en segundo plano (PID: $BACKEND_PID) en el puerto 3001.${NC}"

# 3. Iniciar Frontend
echo -e "\n${YELLOW}3. Iniciando Frontend (Vite/React)...${NC}"
cd ../frontend
if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias del frontend..."
    npm install
fi

echo -e "${GREEN}✓ El sistema está cargando... Abriendo navegador en breve.${NC}"
echo -e "${BLUE}--------------------------------------------------${NC}"
echo -e "Accede manualmente a: ${GREEN}http://localhost:5173${NC}"
echo -e "${BLUE}--------------------------------------------------${NC}"

# Ejecutar frontend (esto bloqueará la terminal y mostrará los logs de Vite)
npm run dev -- --host
