import { abrirInscripciones, cancelarTorneo, cerrarInscripciones, resumenCierre } from './modelo.estados.torneos.js'
import { accionesPermitidas } from './acciones.torneos.js'

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const noEncontrado = (res) => res.status(404).json({ mensaje: 'Torneo no encontrado' })
const transicionInvalida = (res, estadoActual) =>
  res.status(409).json({ mensaje: 'Transición de estado no permitida', estado: estadoActual })

// Arma la respuesta común de las tres transiciones. `datos` es lo que devolvió el modelo.
const responder = (req, res, datos, mensaje) => {
  const { resultado, estadoActual, torneo, ...extra } = datos
  if (resultado === 'NO_ENCONTRADO') return noEncontrado(res)
  if (resultado === 'TRANSICION_INVALIDA') return transicionInvalida(res, estadoActual)
  return res.status(200).json({
    mensaje,
    torneo: { ...torneo, accionesPermitidas: accionesPermitidas(torneo, req.usuario.rol) },
    ...extra,
  })
}

// Envuelve cada handler: valida el id y responde 500 si la base falla.
const conTorneo = (accion, mensajeError) => async (req, res) => {
  if (!REGEX_UUID.test(req.params.id)) return noEncontrado(res)
  try {
    return await accion(req, res)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ mensaje: mensajeError })
  }
}

// POST /api/torneos/:id/abrir-inscripciones  (CU 3.1 · A2)
export const abrir = conTorneo(
  async (req, res) => responder(req, res, await abrirInscripciones(req.params.id), 'Inscripciones abiertas'),
  'No se pudieron abrir las inscripciones'
)

// GET /api/torneos/:id/cerrar-inscripciones/preview  (CU 3.1 · A3, antes de confirmar)
export const previewCierre = conTorneo(async (req, res) => {
  const resumen = await resumenCierre(req.params.id)
  if (!resumen) return noEncontrado(res)
  if (resumen.estado !== 'INSCRIPCIONES_ABIERTAS') return transicionInvalida(res, resumen.estado)
  const { inscriptas, pagadas, pendientes } = resumen
  return res.status(200).json({ inscriptas, pagadas, pendientes })
}, 'No se pudo obtener el resumen del cierre')

// POST /api/torneos/:id/cerrar-inscripciones  (CU 3.1 · A3)
export const cerrar = conTorneo(
  async (req, res) => responder(req, res, await cerrarInscripciones(req.params.id), 'Inscripciones cerradas'),
  'No se pudieron cerrar las inscripciones'
)

// POST /api/torneos/:id/cancelar  (CU 3.1 · A4)
export const cancelar = conTorneo(
  async (req, res) => responder(req, res, await cancelarTorneo(req.params.id), 'Torneo cancelado'),
  'No se pudo cancelar el torneo'
)