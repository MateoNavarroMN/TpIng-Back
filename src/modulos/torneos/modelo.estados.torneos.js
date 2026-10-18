import { pool } from '../../config/conexion.bd.js'
import { puedeTransicionar } from './estados.torneos.js'
import { bloquearTorneo, buscarTorneoPorId, cambiarEstadoTorneo } from './modelo.torneos.js'
import { anularInscripcionesVencidas } from './modelo.inscripciones.js'

// Cambios de estado del torneo (CU 3.1 · A2, A3 y A4). Cada uno corre en una transacción con la fila del
// torneo bloqueada: si dos personas tocan el mismo torneo a la vez, la segunda espera y ve el estado nuevo.
//
// `pasoExtra(cliente, torneoId)` corre dentro de la misma transacción antes de cambiar el estado
// (anular inscripciones, etc.) y lo que devuelve se agrega al resultado.
// Devuelve { resultado: 'NO_ENCONTRADO' | 'TRANSICION_INVALIDA' | 'OK', estadoActual?, torneo?, ... }.
const transicionar = async (id, hacia, pasoExtra = null) => {
  const cliente = await pool.connect()
  try {
    await cliente.query('begin')
    const actual = await bloquearTorneo(id, cliente)
    if (!actual) {
      await cliente.query('rollback')
      return { resultado: 'NO_ENCONTRADO' }
    }
    if (!puedeTransicionar(actual.estado, hacia)) {
      await cliente.query('rollback')
      return { resultado: 'TRANSICION_INVALIDA', estadoActual: actual.estado }
    }

    const extra = pasoExtra ? await pasoExtra(cliente, id) : {}
    await cambiarEstadoTorneo(id, hacia, undefined, cliente)
    const torneo = await buscarTorneoPorId(id, cliente)
    await cliente.query('commit')
    return { resultado: 'OK', torneo, ...extra }
  } catch (error) {
    await cliente.query('rollback')
    throw error
  } finally {
    cliente.release()
  }
}

// A2: PLANIFICADO → INSCRIPCIONES_ABIERTAS
export const abrirInscripciones = (id) => transicionar(id, 'INSCRIPCIONES_ABIERTAS')

// A3: INSCRIPCIONES_ABIERTAS → INSCRIPCIONES_CERRADAS. Antes se anulan las inscripciones con el plazo de
// pago vencido (liberan el cupo). Las que siguen PENDIENTES quedan ACTIVAS, pero el cuadro (CU 3.4) solo
// toma las PAGADAS, así que quedan afuera salvo que recepción registre el pago antes de generarlo.
export const cerrarInscripciones = (id) =>
  transicionar(id, 'INSCRIPCIONES_CERRADAS', async (cliente, torneoId) => ({
    inscripcionesVencidasAnuladas: await anularInscripcionesVencidas(torneoId, cliente),
  }))

// A4: cualquiera de los cuatro primeros estados → CANCELADO. Anula todas las inscripciones ACTIVAS.
// Las reservas de tipo Torneo se cancelan acá cuando existan (M3-BE-12, vía partido.reserva_id).
// Los reembolsos se gestionan fuera del sistema.
export const cancelarTorneo = (id) =>
  transicionar(id, 'CANCELADO', async (cliente, torneoId) => {
    const { rowCount } = await cliente.query(
      "update inscripcion set estado = 'ANULADA' where torneo_id = $1 and estado = 'ACTIVA'",
      [torneoId]
    )
    return { inscripcionesAnuladas: rowCount }
  })

// Lo que el organizador ve antes de confirmar el cierre (A3): cuántas inscripciones activas hay y cuántas
// siguen con el pago pendiente (esas quedan fuera del cuadro). Solo lee, no cambia nada.
export const resumenCierre = async (id, db = pool) => {
  const { rows } = await db.query(
    `select t.estado,
            count(i.id) filter (where i.estado = 'ACTIVA')::int as inscriptas,
            count(i.id) filter (where i.estado = 'ACTIVA' and i.estado_pago = 'PAGADO')::int as pagadas,
            count(i.id) filter (where i.estado = 'ACTIVA' and i.estado_pago = 'PENDIENTE')::int as pendientes
       from torneo t
       left join inscripcion i on i.torneo_id = t.id
      where t.id = $1
      group by t.id`,
    [id]
  )
  return rows[0] ?? null
}