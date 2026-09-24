# Spesfidem Aluminio — Plataforma Web de Consultoría

## 🏗️ Arquitectura de Producción

| Componente | Plataforma | URL |
|---|---|---|
| **Frontend** (HTML estático + React SPA) | **Vercel** | `spesfidem-aluminio.vercel.app` |
| **Backend WebRTC** (Socket.io) | **Render** | `spesfidem-video-server.onrender.com` |
| **CRM Backend** (Python/Flask) | **Render** | (ver render.yaml) |
| **Notificaciones** | `wa.me` | Automático al iniciar consulta |

## 📂 Estructura Clave

```
spesfidem_aluminio/
├── index.html             → Página principal (Vercel)
├── videocall.html         → Entrada a la videollamada
├── admin.html             → Panel de control del asesor
├── vercel.json            → Configuración de enrutamiento para Vercel
├── render.yaml            → Configuración de servicios en Render
├── consultoria-app/
│   ├── frontend/          → React + Vite (desplegado en /consultoria/)
│   │   ├── .env.production → VITE_BACKEND_URL=https://spesfidem-video-server.onrender.com
│   │   └── vite.config.js  → base: '/consultoria/'
│   └── backend/           → Socket.io Server (Node.js en Render)
│       └── server.js
└── server.py              → CRM Backend (Python)
```

## 🚀 Despliegue

- **Frontend**: Push a `main` en GitHub → Vercel construye automáticamente
- **Backend**: Render detecta cambios en `consultoria-app/backend/` y redespliega

## 🔌 Variables de Entorno

### Frontend (`consultoria-app/frontend/.env.production`)
```
VITE_BACKEND_URL=https://spesfidem-video-server.onrender.com
```

### Backend (configurable en Render dashboard)
```
NODE_ENV=production
PORT=3001
```

## 🎥 Flujo de Videollamada

1. Cliente abre `videocall.html` → genera ID de sala → abre WhatsApp + redirige a `/consultoria/?room=ID&role=client`
2. `useWebRTC.js` registra listeners de Socket.io → solicita cámara → emite `join-room`
3. Backend (Render) retransmite `offer/answer/ice-candidate` entre peers
4. Asesor entra a `/consultoria/?room=ID&role=admin` → conexión P2P establecida

## ⚙️ Desarrollo Local

```bash
# Backend
cd consultoria-app/backend && npm install && node server.js

# Frontend
cd consultoria-app/frontend && npm install && npm run dev
```

---
*Spesfidem Aluminio — Sistemas de ventanería de alto desempeño*
