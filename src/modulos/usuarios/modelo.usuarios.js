import { pool } from '../../config/conexion.bd.js'
import { cerrarSesionesDeUsuario } from '../autenticacion/modelo.autenticacion.js'

// Modelo de usuarios y jugadores.

// Columnas que se pueden devolver al frontend: nunca incluyen password_hash.
const COLUMNAS_PUBLICAS = `id, email, nombre, apellido, telefono, rol, estado,
  fecha_registro, ultimo_acceso`

// El correo siempre se guarda y se busca en minúsculas.
export const normalizarEmail = (email) => String(email).trim().toLowerCase()

// Para el login: devuelve TODAS las columnas, incluido password_hash, intentos_fallidos y bloqueo_hasta.
// El controlador debe quitar password_hash antes de responder.
export const buscarPorEmail = async (email, db = pool) => {
  const { rows } = await db.query('select * from usuario where email = $1', [normalizarEmail(email)])
  return rows[0] ?? null
}

export const buscarPorId = async (id, db = pool) => {
  const { rows } = await db.query(`select ${COLUMNAS_PUBLICAS} from usuario where id = $1`, [id])
  return rows[0] ?? null
}

// Usuario + su DNI (solo los usuarios con rol JUGADOR tienen fila en `jugador`).
export const buscarPerfil = async (id, db = pool) => {
  const { rows } = await db.query(
    `select u.id, u.email, u.nombre, u.apellido, u.telefono, u.rol, u.estado,
            u.fecha_registro, u.ultimo_acceso, j.id as jugador_id, j.dni
       from usuario u
       left join jugador j on j.usuario_id = u.id
      where u.id = $1`,
    [id]
  )
  return rows[0] ?? null
}

export const existeEmail = async (email, db = pool) => {
  const { rowCount } = await db.query('select 1 from usuario where email = $1', [normalizarEmail(email)])
  return rowCount > 0
}

export const existeDni = async (dni, db = pool) => {
  const { rowCount } = await db.query('select 1 from jugador where dni = $1', [dni])
  return rowCount > 0
}

// `passwordHash` ya viene encriptado con bcrypt.
export const crearUsuario = async (
  { email, passwordHash, nombre, apellido, telefono = null, rol = 'JUGADOR' },
  db = pool
) => {
  const { rows } = await db.query(
    `insert into usuario (email, password_hash, nombre, apellido, telefono, rol)
     values ($1, $2, $3, $4, $5, $6)
     returning ${COLUMNAS_PUBLICAS}`,
    [normalizarEmail(email), passwordHash, nombre, apellido, telefono, rol]
  )
  return rows[0]
}

export const crearJugador = async (usuarioId, dni, db = pool) => {
  const { rows } = await db.query(
    'insert into jugador (usuario_id, dni) values ($1, $2) returning id, usuario_id, dni',
    [usuarioId, dni]
  )
  return rows[0]
}

// Crea el usuario (rol JUGADOR) y su jugador en una transacción: o se crean los dos o ninguno.
// Si el correo o el DNI ya existen, Postgres lanza el error 23505 (UNIQUE) y se hace ROLLBACK.
// (usuario_email_key o jugador_dni_key).
export const crearJugadorCompleto = async ({ dni, ...datosUsuario }) => {
  const cliente = await pool.connect()
  try {
    await cliente.query('begin')
    const usuario = await crearUsuario({ ...datosUsuario, rol: 'JUGADOR' }, cliente)
    const jugador = await crearJugador(usuario.id, dni, cliente)
    await cliente.query('commit')
    return { ...usuario, jugador_id: jugador.id, dni: jugador.dni }
  } catch (error) {
    await cliente.query('rollback')
    throw error
  } finally {
    cliente.release()
  }
}

// Suma un intento fallido y, si llega al máximo, deja la cuenta en espera `minutos` minutos.
// Es un solo UPDATE, así que dos logins fallidos simultáneos no pisan el contador.
export const registrarIntentoFallido = async (id, maxIntentos = 5, minutos = 15, db = pool) => {
  const { rows } = await db.query(
    `update usuario
        set intentos_fallidos = intentos_fallidos + 1,
            bloqueo_hasta = case when intentos_fallidos + 1 >= $2
                                 then now() + make_interval(mins => $3)
                                 else bloqueo_hasta end
      where id = $1
      returning intentos_fallidos, bloqueo_hasta`,
    [id, maxIntentos, minutos]
  )
  return rows[0] ?? null
}

// Login correcto: borra los intentos fallidos y el bloqueo, y anota el último acceso.
export const registrarAccesoExitoso = async (id, db = pool) => {
  await db.query(
    `update usuario
        set intentos_fallidos = 0, bloqueo_hasta = null, ultimo_acceso = now()
      where id = $1`,
    [id]
  )
}

// Borra los intentos fallidos y el bloqueo.
export const reiniciarIntentos = async (id, db = pool) => {
  await db.query('update usuario set intentos_fallidos = 0, bloqueo_hasta = null where id = $1', [id])
}

// Hash de la contraseña actual (para comprobar la "contraseña actual" al cambiarla).
export const buscarHashPorId = async (id, db = pool) => {
  const { rows } = await db.query('select password_hash from usuario where id = $1', [id])
  return rows[0]?.password_hash ?? null
}

// Guarda el nuevo hash y cierra todas las demás sesiones del usuario, dejando abierta la actual.
// Las dos cosas van en una transacción: o se hacen las dos o ninguna. Devuelve cuántas sesiones se cerraron.
export const cambiarPassword = async (id, nuevoHash, sesionActualId) => {
  const cliente = await pool.connect()
  try {
    await cliente.query('begin')
    await cliente.query('update usuario set password_hash = $2 where id = $1', [id, nuevoHash])
    const cerradas = await cerrarSesionesDeUsuario(id, sesionActualId, cliente)
    await cliente.query('commit')
    return cerradas
  } catch (error) {
    await cliente.query('rollback')
    throw error
  } finally {
    cliente.release()
  }
}