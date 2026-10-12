import { pool } from '../../config/conexion.bd.js'

// Cada login crea una fila; el JWT lleva su id (`sid`)
// y en cada request se comprueba que la sesión siga ACTIVA y sin vencer.

// Crea una sesión que vence en `horas` horas (8 por defecto, igual que el JWT).
export const crearSesion = async (usuarioId, horas = 8, db = pool) => {
  const { rows } = await db.query(
    `insert into sesion (usuario_id, fecha_expiracion)
     values ($1, now() + make_interval(hours => $2))
     returning id, usuario_id, fecha_inicio, fecha_expiracion, estado`,
    [usuarioId, horas]
  )
  return rows[0]
}

// Devuelve la sesión solo si está ACTIVA y no venció; si no, null.
export const buscarSesionVigente = async (id, db = pool) => {
  const { rows } = await db.query(
    `select id, usuario_id, fecha_inicio, fecha_expiracion, estado
       from sesion
      where id = $1 and estado = 'ACTIVA' and fecha_expiracion > now()`,
    [id]
  )
  return rows[0] ?? null
}

// Cierra una sesión. Devuelve true si estaba activa y se cerró, false si no existía o ya estaba cerrada.
export const cerrarSesion = async (id, db = pool) => {
  const { rowCount } = await db.query(
    "update sesion set estado = 'CERRADA' where id = $1 and estado = 'ACTIVA'",
    [id]
  )
  return rowCount > 0
}

// Cierra todas las sesiones activas del usuario, salvo `exceptoId` si se indica (cerrar las otras).
export const cerrarSesionesDeUsuario = async (usuarioId, exceptoId = null, db = pool) => {
  const { rowCount } = await db.query(
    `update sesion set estado = 'CERRADA'
      where usuario_id = $1 and estado = 'ACTIVA' and ($2::uuid is null or id <> $2)`,
    [usuarioId, exceptoId]
  )
  return rowCount
}

export const listarSesionesActivas = async (usuarioId, db = pool) => {
  const { rows } = await db.query(
    `select id, fecha_inicio, fecha_expiracion
       from sesion
      where usuario_id = $1 and estado = 'ACTIVA' and fecha_expiracion > now()
      order by fecha_inicio desc`,
    [usuarioId]
  )
  return rows
}