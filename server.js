const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Módulo de conexión a la base de datos PostgreSQL spesfidem
const db = require('./config/db');

// Importación de Rutas y Controladores
const authRoutes = require('./routes/authRoutes');
const authController = require('./controllers/authController');

// Inicialización de Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de archivos estáticos del frontend
app.use(express.static(path.join(__dirname, './')));

// Ruta raíz GET '/' que sirve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Montaje de Enrutadores de la API REST
app.use('/api/auth', authRoutes);

// Alias directos para autenticación y usuarios en PostgreSQL
app.post('/api/register', authController.registrarUsuario);
app.get('/api/admin/usuarios', authController.obtenerUsuarios);
app.get('/api/auth/usuarios', authController.obtenerUsuarios);
app.post('/api/registered-users/edit', authController.editarUsuario);


// Endpoint de prueba de salud de la API (Healthcheck)
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = await db.query('SELECT current_database() AS bd, NOW() AS time');
    res.json({
      ok: true,
      mensaje: 'API SpesFidem lista y conectada a PostgreSQL',
      database: dbStatus.rows[0].bd,
      serverTime: dbStatus.rows[0].time
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      mensaje: 'Error de comunicación con la base de datos PostgreSQL',
      error: error.message
    });
  }
});

// Manejo de rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    mensaje: `Recurso no encontrado: ${req.method} ${req.originalUrl}`
  });
});

// Middleware centralizado de gestión de errores (500)
app.use((err, req, res, next) => {
  console.error('❌ Error no controlado en la aplicación:', err.stack);
  res.status(500).json({
    ok: false,
    mensaje: 'Error interno en el servidor Express'
  });
});

// Inicio del servidor HTTP
app.listen(PORT, () => {
  console.log('===========================================================');
  console.log(`🚀 Servidor SpesFidem iniciado correctamente en el puerto ${PORT}`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
  console.log(`🔐 Auth Register: POST http://localhost:${PORT}/api/auth/register`);
  console.log(`🔐 Auth Login:    POST http://localhost:${PORT}/api/auth/login`);
  console.log(`👥 Usuarios:      GET  http://localhost:${PORT}/api/auth/users`);
  console.log('===========================================================');
});

module.exports = app;
