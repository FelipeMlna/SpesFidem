const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/**
 * POST /api/auth/login
 * Autentica usuario por email o número de documento en PostgreSQL
 */
const login = async (req, res) => {
  try {
    const { numero_documento, email, username, emailOrDoc, password } = req.body;
    const identifier = String(email || numero_documento || username || emailOrDoc || '').trim();
    const pass = String(password || '');

    if (!identifier || !pass) {
      return res.status(400).json({
        ok: false,
        success: false,
        mensaje: 'Debe proporcionar su correo electrónico o número de documento y contraseña.'
      });
    }

    // Consulta SQL con LEFT JOIN a la tabla roles
    const queryText = `
      SELECT 
        u.id_usuario,
        u.id_rol,
        COALESCE(r.nombre_rol, 'usuario') AS rol,
        u.nombre_completo,
        u.numero_documento,
        u.celular,
        u.email,
        u.ciudad_municipio,
        u.password_hash,
        u.fecha_registro
      FROM usuarios u
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      WHERE LOWER(u.email) = LOWER($1) OR u.numero_documento = $1
    `;

    const { rows } = await db.query(queryText, [identifier]);

    if (rows.length === 0) {
      return res.status(401).json({
        ok: false,
        success: false,
        mensaje: 'Credenciales inválidas. El usuario o la contraseña son incorrectos.'
      });
    }

    const usuario = rows[0];

    // Verificación dual de contraseña (bcrypt con fallback para texto plano si aplica)
    let esValida = await bcrypt.compare(pass, usuario.password_hash);
    if (!esValida && pass === usuario.password_hash) {
      esValida = true;
    }

    if (!esValida) {
      return res.status(401).json({
        ok: false,
        success: false,
        mensaje: 'Credenciales inválidas. El usuario o la contraseña son incorrectos.'
      });
    }

    // Firma de token JWT
    const payload = {
      id_usuario: usuario.id_usuario,
      nombre_completo: usuario.nombre_completo,
      rol: usuario.rol,
      id_rol: usuario.id_rol
    };

    const secretKey = process.env.JWT_SECRET || 'spesfidem_jwt_secret_key_default';
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
    const token = jwt.sign(payload, secretKey, { expiresIn });

    const { password_hash, ...usuarioSinPassword } = usuario;

    return res.status(200).json({
      ok: true,
      success: true,
      mensaje: 'Inicio de sesión exitoso',
      token,
      usuario: usuarioSinPassword
    });

  } catch (error) {
    console.error('❌ Error en authController.login:', error);
    return res.status(500).json({
      ok: false,
      success: false,
      mensaje: 'Error interno del servidor al autenticar el usuario en PostgreSQL.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/auth/users, GET /api/auth/usuarios, GET /api/admin/usuarios
 * Retorna todos los usuarios registrados en PostgreSQL
 */
const obtenerUsuarios = async (req, res) => {
  try {
    const queryText = `
      SELECT 
        u.id_usuario,
        u.id_usuario AS id,
        u.id_rol,
        COALESCE(r.nombre_rol, 'usuario') AS rol,
        COALESCE(r.nombre_rol, 'usuario') AS role,
        u.nombre_completo,
        u.nombre_completo AS "fullName",
        u.numero_documento,
        u.numero_documento AS "idCard",
        u.numero_documento AS doc,
        u.celular,
        u.celular AS cellphone,
        u.email,
        u.ciudad_municipio,
        u.ciudad_municipio AS city,
        u.fecha_registro,
        u.fecha_registro AS "registrationDate"
      FROM usuarios u
      LEFT JOIN roles r ON u.id_rol = r.id_rol
      ORDER BY u.fecha_registro DESC, u.id_usuario DESC
    `;
    const { rows } = await db.query(queryText);
    return res.status(200).json(rows);
  } catch (error) {
    console.error('❌ Error al obtener usuarios registrados desde PostgreSQL:', error);
    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al consultar la lista de usuarios en PostgreSQL.'
    });
  }
};

/**
 * POST /api/auth/register (o /api/register)
 * Registra un usuario en la tabla `usuarios` de PostgreSQL
 */
const registrarUsuario = async (req, res) => {
  try {
    const { 
      nombre_completo, fullName,
      numero_documento, idCard, doc,
      celular, cellphone, phone,
      email,
      ciudad_municipio, city, ciudad,
      password,
      id_rol
    } = req.body;

    const valNombre = String(nombre_completo || fullName || '').trim();
    const valDoc = String(numero_documento || idCard || doc || '').trim();
    const valCelular = String(celular || cellphone || phone || '').trim();
    const valEmail = String(email || '').trim().toLowerCase();
    const valCiudad = String(ciudad_municipio || city || ciudad || 'Ibagué').trim();
    const valPassword = String(password || '');
    const valRol = Number(id_rol || 2);

    if (!valNombre || !valDoc || !valEmail || !valPassword) {
      return res.status(400).json({
        success: false,
        ok: false,
        mensaje: 'Debe proporcionar nombre_completo, numero_documento, email y password.',
        message: 'Debe proporcionar nombre_completo, numero_documento, email y password.'
      });
    }

    // Validar duplicidad en PostgreSQL
    const checkQuery = `SELECT id_usuario FROM usuarios WHERE LOWER(email) = LOWER($1) OR numero_documento = $2`;
    const checkRes = await db.query(checkQuery, [valEmail, valDoc]);

    if (checkRes.rows.length > 0) {
      return res.status(400).json({
        success: false,
        ok: false,
        mensaje: 'El correo electrónico o número de documento ya se encuentra registrado.',
        message: 'El correo electrónico o número de documento ya se encuentra registrado.'
      });
    }

    // Hashear contraseña
    const passwordHash = await bcrypt.hash(valPassword, 10);

    // Insertar en PostgreSQL
    const insertQuery = `
      INSERT INTO usuarios (id_rol, nombre_completo, numero_documento, celular, email, ciudad_municipio, password_hash, fecha_registro)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id_usuario, id_rol, nombre_completo, numero_documento, celular, email, ciudad_municipio, fecha_registro
    `;

    const { rows } = await db.query(insertQuery, [
      valRol,
      valNombre,
      valDoc,
      valCelular,
      valEmail,
      valCiudad,
      passwordHash
    ]);

    const nuevoUsuario = rows[0];

    return res.status(201).json({
      success: true,
      ok: true,
      mensaje: 'Usuario registrado exitosamente en PostgreSQL',
      message: 'Usuario registrado exitosamente en PostgreSQL',
      usuario: {
        id_usuario: nuevoUsuario.id_usuario,
        id: nuevoUsuario.id_usuario,
        id_rol: nuevoUsuario.id_rol,
        nombre_completo: nuevoUsuario.nombre_completo,
        fullName: nuevoUsuario.nombre_completo,
        email: nuevoUsuario.email,
        numero_documento: nuevoUsuario.numero_documento,
        celular: nuevoUsuario.celular,
        ciudad_municipio: nuevoUsuario.ciudad_municipio,
        fecha_registro: nuevoUsuario.fecha_registro
      }
    });

  } catch (error) {
    console.error('❌ Error en authController.registrarUsuario:', error);
    return res.status(500).json({
      success: false,
      ok: false,
      mensaje: 'Error interno al registrar el usuario en PostgreSQL.',
      message: 'Error interno al registrar el usuario en PostgreSQL.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/registered-users/edit (o /api/auth/users/edit)
 */
const editarUsuario = async (req, res) => {
  try {
    const { id, id_usuario, fullName, nombre_completo, idCard, doc, numero_documento, cellphone, celular, email, city, ciudad, ciudad_municipio, password, role, id_rol } = req.body;

    const userId = id || id_usuario;
    if (!userId) {
      return res.status(400).json({ success: false, ok: false, message: 'ID de usuario requerido' });
    }

    const valNombre = String(nombre_completo || fullName || '').trim();
    const valDoc = String(numero_documento || idCard || doc || '').trim();
    const valCelular = String(celular || cellphone || '').trim();
    const valEmail = String(email || '').trim().toLowerCase();
    const valCiudad = String(ciudad_municipio || city || ciudad || '').trim();
    const valRol = (role === 'admin' || id_rol === 1 || role === 'administrador') ? 1 : 2;

    const params = [valNombre, valDoc, valCelular, valEmail, valCiudad, valRol];
    let updateQuery = `
      UPDATE usuarios
      SET nombre_completo = COALESCE(NULLIF($1, ''), nombre_completo),
          numero_documento = COALESCE(NULLIF($2, ''), numero_documento),
          celular = COALESCE(NULLIF($3, ''), celular),
          email = COALESCE(NULLIF($4, ''), email),
          ciudad_municipio = COALESCE(NULLIF($5, ''), ciudad_municipio),
          id_rol = $6
    `;

    if (password && password.trim() !== '') {
      const passwordHash = await bcrypt.hash(password.trim(), 10);
      params.push(passwordHash);
      updateQuery += `, password_hash = $${params.length}`;
    }

    params.push(userId);
    updateQuery += ` WHERE id_usuario = $${params.length} RETURNING id_usuario, nombre_completo, email`;

    const { rows } = await db.query(updateQuery, params);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, ok: false, message: 'Usuario no encontrado en PostgreSQL' });
    }

    return res.status(200).json({ success: true, ok: true, message: 'Usuario actualizado correctamente', usuario: rows[0] });
  } catch (error) {
    console.error('❌ Error al editar usuario en PostgreSQL:', error);
    return res.status(500).json({ success: false, ok: false, message: 'Error interno al actualizar usuario.' });
  }
};

module.exports = {
  login,
  obtenerUsuarios,
  registrarUsuario,
  editarUsuario
};
