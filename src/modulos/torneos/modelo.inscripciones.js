import { pool } from '../../config/conexion.bd.js'

// Modelo de inscripciones a torneos (CU 3.2). Un jugador (Tenis) o una pareja titular + compañero (Pádel).
// La base impide dos inscripciones ACTIVAS del mismo jugador en un torneo (índices únicos y un trigger
// para el caso cruzado titular/compañero): en ese caso la consulta falla con el código 23505.

const SELECT_INSCRIPCION = `
  select i.id, i.torneo_id as "torneoId", i.estado, i.estado_pago as "estadoPago",
         i.fecha_inscripcion::text as "fechaInscripcion", i.vence_en as "venceEn",
         i.fecha_pago as "fechaPago", i.cabeza_de_serie as "cabezaDeSerie",
         i.titular_jugador_id as "titularJugadorId", ut.nombre as "titularNombre", ut.apellido as "titularApellido",
         i.companero_jugador_id as "companeroJugadorId", uc.nombre as "companeroNombre", uc.apellido as "companeroApellido"
    from inscripcion i
    join jugador jt on jt.id = i.titular_jugador_id
    join usuario ut on ut.id = jt.usuario_id
    left join jugador jc on jc.id = i.companero_jugador_id
    left join usuario uc on uc.id = jc.usuario_id`

// Se registra ACTIVA y con el pago PENDIENTE (CU 3.2 · paso 7). `venceEn` es el límite para pagar.
export const crearInscripcion = async ({ torneoId, titularJugadorId, companeroJugadorId = null, venceEn = null }, db = pool) => {
  const { rows } = await db.query(
    `insert into inscripcion (torneo_id, titular_jugador_id, companero_jugador_id, vence_en)
     values ($1, $2, $3, $4)
     returning id`,
    [torneoId, titularJugadorId, companeroJugadorId, venceEn]
  )
  return buscarInscripcionPorId(rows[0].id, db)
}

export const buscarInscripcionPorId = async (id, db = pool) => {
  const { rows } = await db.query(`${SELECT_INSCRIPCION} where i.id = $1`, [id])
  return rows[0] ?? null
}

// Inscripciones de un torneo (listado del organizador). Por defecto todas; con `soloActivas` solo las ACTIVAS.
export const listarInscripcionesDeTorneo = async (torneoId, { soloActivas = false } = {}, db = pool) => {
  const { rows } = await db.query(
    `${SELECT_INSCRIPCION}
      where i.torneo_id = $1 and (not $2 or i.estado = 'ACTIVA')
      order by i.fecha_inscripcion, ut.apellido, ut.nombre, i.id`,
    [torneoId, soloActivas]
  )
  return rows
}

export const contarInscripcionesActivas = async (torneoId, db = pool) => {
  const { rows } = await db.query(
    "select count(*)::int as total from inscripcion where torneo_id = $1 and estado = 'ACTIVA'",
    [torneoId]
  )
  return rows[0].total
}

// Inscripción ACTIVA de un jugador en un torneo, sea titular o compañero (CU 3.2 · paso 5). null si no tiene.
export const buscarInscripcionActivaDeJugador = async (torneoId, jugadorId, db = pool) => {
  const { rows } = await db.query(
    `${SELECT_INSCRIPCION}
      where i.torneo_id = $1 and i.estado = 'ACTIVA'
        and (i.titular_jugador_id = $2 or i.companero_jugador_id = $2)`,
    [torneoId, jugadorId]
  )
  return rows[0] ?? null
}

// Anula una inscripción ACTIVA (libera el cupo). Devuelve false si no estaba activa.
export const anularInscripcion = async (id, db = pool) => {
  const { rowCount } = await db.query(
    "update inscripcion set estado = 'ANULADA' where id = $1 and estado = 'ACTIVA'",
    [id]
  )
  return rowCount > 0
}

// Anula las inscripciones del torneo con pago PENDIENTE y plazo vencido (CU 3.2 · 7a). Devuelve cuántas.
export const anularInscripcionesVencidas = async (torneoId, db = pool) => {
  const { rowCount } = await db.query(
    `update inscripcion set estado = 'ANULADA'
      where torneo_id = $1 and estado = 'ACTIVA' and estado_pago = 'PENDIENTE'
        and vence_en is not null and vence_en < now()`,
    [torneoId]
  )
  return rowCount
}

// Marca el pago (CU 3.2 · 7a, M3-BE-07): guarda la fecha y quién lo registró.
// Devuelve false si la inscripción no está ACTIVA con el pago PENDIENTE.
export const confirmarPagoInscripcion = async (id, operadorUsuarioId, db = pool) => {
  const { rowCount } = await db.query(
    `update inscripcion
        set estado_pago = 'PAGADO', fecha_pago = now(), pago_registrado_por = $2
      where id = $1 and estado = 'ACTIVA' and estado_pago = 'PENDIENTE'`,
    [id, operadorUsuarioId]
  )
  return rowCount > 0
}