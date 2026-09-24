const { Pool } = require('pg');
require('dotenv').config();

/**
 * Configuración del pool de conexiones para PostgreSQL
 * Soporta URL completa (DATABASE_URL) o variables individuales (.env)
 */
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'))
        ? false
        : { rejectUnauthorized: false }
    }
  : {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || '127.0.0.1',
      database: process.env.DB_NAME || 'spesfidem',
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

const pool = new Pool(poolConfig);

// Evento: Conexión exitosa de un cliente del pool
pool.on('connect', () => {
  console.log('⚡ Pool de PostgreSQL: Conexión cliente establecida.');
});

// Evento: Manejo de errores inesperados en clientes inactivos
pool.on('error', (err) => {
  console.error('❌ Error no esperado en el cliente del Pool de PostgreSQL:', err);
  process.exit(-1);
});

// Prueba inmediata de conexión al importar este módulo
(async () => {
  try {
    const res = await pool.query('SELECT NOW() AS fecha_actual, current_database() AS bd');
    console.log(`✅ Conexión exitosa a la base de datos "${res.rows[0].bd}" en PostgreSQL.`);
    console.log(`🕒 Timestamp del servidor DB: ${res.rows[0].fecha_actual}`);
  } catch (error) {
    console.error(`❌ Error crítico al conectar a la base de datos "${process.env.DB_NAME || 'spesfidem'}":`, error.message);
  }
})();

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
