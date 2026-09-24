const jwt = require('jsonwebtoken');

/**
 * Middleware para la verificación de tokens JWT en rutas protegidas
 */
const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({
      ok: false,
      mensaje: 'Acceso no autorizado. Se requiere un token de autenticación en la cabecera Authorization.'
    });
  }

  // Soporta formatos "Bearer <token>" y el token directo
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7, authHeader.length) 
    : authHeader;

  try {
    const secretKey = process.env.JWT_SECRET || 'spesfidem_jwt_secret_key_default';
    const decoded = jwt.verify(token, secretKey);
    
    // Inyecta el usuario decodificado en req.usuario
    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      ok: false,
      mensaje: 'Token inválido o expirado.',
      error: error.message
    });
  }
};

/**
 * Middleware opcional para restricción por roles
 * Ej: verificarRol('administrador')
 */
const verificarRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        ok: false,
        mensaje: 'Acceso prohibido. No posee los permisos necesarios para realizar esta acción.'
      });
    }
    next();
  };
};

module.exports = {
  verificarToken,
  verificarRol
};
