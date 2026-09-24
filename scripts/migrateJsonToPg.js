const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

/**
 * Script de Migración Única: JSON Backup -> PostgreSQL ("spesfidem")
 * Ejecución: node scripts/migrateJsonToPg.js
 */

async function migrarDatos() {
  const jsonPath = path.join(__dirname, '../database_backup.json');

  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Archivo de respaldo no encontrado en: ${jsonPath}`);
    process.exit(1);
  }

  console.log('🔄 Leyendo archivo JSON de respaldo...');
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const cotizacionesJson = JSON.parse(rawData);

  console.log(`📦 Se encontraron ${cotizacionesJson.length} registros para migrar.`);

  const client = await pool.connect();

  let usuariosCreados = 0;
  let usuariosExistentes = 0;
  let proyectosCreados = 0;
  let cotizacionesCreadas = 0;
  let errores = 0;

  try {
    for (const [index, item] of cotizacionesJson.entries()) {
      const docCliente = String(item.idCard || item.numero_documento || item.id || `DOC-${index + 1}`).trim();
      const nombreCliente = String(item.fullName || item.nombre_completo || 'Cliente Sin Nombre').trim();
      const emailCliente = String(item.email || '').trim();
      const celularCliente = String(item.cellphone || item.celular || '').trim();
      const ciudad = String(item.city || item.ciudad || 'Ibagué').trim();
      const direccion = String(item.address || item.direccion || 'Dirección de obra').trim();
      const subtotal = Number(item.subtotal || item.costo_materiales || 0);
      const total = Number(item.grandTotal || item.total || subtotal);
      const estado = String(item.status || item.estado || 'Pendiente').trim();

      // Iniciar transacción por cada cotización
      await client.query('BEGIN');

      try {
        // 1. Verificar o insertar usuario (Deduplicación por numero_documento)
        const selectUser = await client.query(`SELECT id_usuario FROM usuarios WHERE numero_documento = $1`, [docCliente]);
        let idUsuario;

        if (selectUser.rows.length > 0) {
          idUsuario = selectUser.rows[0].id_usuario;
          usuariosExistentes++;
        } else {
          const passDefault = await bcrypt.hash(docCliente, 10);
          const insertUser = await client.query(
            `INSERT INTO usuarios (id_rol, nombre_completo, numero_documento, celular, email, ciudad_municipio, password_hash, fecha_registro)
             VALUES (2, $1, $2, $3, $4, $5, $6, NOW())
             RETURNING id_usuario`,
            [nombreCliente, docCliente, celularCliente, emailCliente, ciudad, passDefault]
          );
          idUsuario = insertUser.rows[0].id_usuario;
          usuariosCreados++;
        }

        // 2. Insertar Proyecto
        const tituloProyecto = `Cotización #${item.serial || item.id || index + 1} - ${item.product || 'Obra Alum/Vidrio'}`;
        const insertProyecto = await client.query(
          `INSERT INTO proyectos (id_usuario, titulo, direccion_obra, ciudad_obra, fecha_inicio, estado)
           VALUES ($1, $2, $3, $4, CURRENT_DATE, $5)
           RETURNING id_proyecto`,
          [idUsuario, tituloProyecto, direccion, ciudad, estado]
        );
        const idProyecto = insertProyecto.rows[0].id_proyecto;
        proyectosCreados++;

        // 3. Insertar Cotización
        const fechaEmision = item.date ? new Date(item.date) : new Date();
        const fechaValida = isNaN(fechaEmision.getTime()) ? new Date() : fechaEmision;

        const insertCotizacion = await client.query(
          `INSERT INTO cotizaciones (id_proyecto, costo_materiales, costo_mano_obra, total, estado, fecha_emision)
           VALUES ($1, $2, 0, $3, $4, $5)
           RETURNING id_cotizacion`,
          [idProyecto, subtotal, total, estado, fechaValida]
        );
        const idCotizacion = insertCotizacion.rows[0].id_cotizacion;
        cotizacionesCreadas++;

        // 4. Insertar Ítems (Espacios de Medición / Productos)
        const itemsArray = Array.isArray(item.items) && item.items.length > 0
          ? item.items
          : [{ product: item.product || 'Ventana / Puerta Aluminio', quantity: item.quantity || 1, unitPrice: subtotal, total }];

        for (const it of itemsArray) {
          const nombreProd = it.product || 'Producto General';

          // Buscar o crear producto en catálogo
          let idProdCat = null;
          const searchProd = await client.query(`SELECT id_producto FROM productos_catalogo WHERE LOWER(nombre_producto) = LOWER($1) LIMIT 1`, [nombreProd]);
          if (searchProd.rows.length > 0) {
            idProdCat = searchProd.rows[0].id_producto;
          } else {
            const newProd = await client.query(
              `INSERT INTO productos_catalogo (nombre_producto, descripcion, fecha_creacion)
               VALUES ($1, 'Migrado automáticamente', NOW()) RETURNING id_producto`,
              [nombreProd]
            );
            idProdCat = newProd.rows[0].id_producto;
          }

          const obs = `Color: ${it.color || 'N/A'} | Vidrio: ${it.glass || 'N/A'} | Tamaño: ${it.size || 'N/A'}`;

          await client.query(
            `INSERT INTO espacios_medicion (id_proyecto, id_producto, nombre_espacio, observaciones)
             VALUES ($1, $2, $3, $4)`,
            [idProyecto, idProdCat, nombreProd, obs]
          );

          await client.query(
            `INSERT INTO detalle_cotizacion_materiales (id_cotizacion, cantidad_calculada, precio_unitario_aplicado, subtotal)
             VALUES ($1, $2, $3, $4)`,
            [idCotizacion, Number(it.quantity || 1), Number(it.unitPrice || subtotal), Number(it.total || total)]
          );
        }

        await client.query('COMMIT');
      } catch (errItem) {
        await client.query('ROLLBACK');
        errores++;
        console.error(`⚠️ Error al migrar ítem index ${index} (ID: ${item.id}):`, errItem.message);
      }
    }

    console.log('===========================================================');
    console.log('🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log(`👤 Usuarios creados:     ${usuariosCreados}`);
    console.log(`👥 Usuarios deduplicados: ${usuariosExistentes}`);
    console.log(`🏗️ Proyectos creados:    ${proyectosCreados}`);
    console.log(`📋 Cotizaciones creadas: ${cotizacionesCreadas}`);
    console.log(`❌ Registro de errores:  ${errores}`);
    console.log('===========================================================');

  } catch (error) {
    console.error('❌ Error fatal durante la migración:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrarDatos();
