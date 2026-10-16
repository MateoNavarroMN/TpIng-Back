import { buscarUsuarioPorId } from './modelo.consulta.usuarios.js'
import { cambiarEstadoDeUsuario } from './modelo.estado.usuarios.js'

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Arma el controlador de bloquear o de activar: los dos siguen los mismos pasos y las mismas respuestas.
const crearControlador = (nuevoEstado, mensajeOk, mensajeError) => async (req, res) => {
  const { id } = req.params
  if (!REGEX_UUID.test(id)) return res.status(404).json({ mensaje: 'Usuario no encontrado' })

  try {
    const { resultado, sesionesCerradas } = await cambiarEstadoDeUsuario(id, nuevoEstado)

    if (resultado === 'NO_ENCONTRADO') return res.status(404).json({ mensaje: 'Usuario no encontrado' })
    if (resultado === 'ES_ADMINISTRADOR') {
      return res.status(409).json({ mensaje: 'Las cuentas de Administrador se gestionan fuera del sistema' })
    }
    if (resultado === 'SIN_CAMBIOS') return res.status(409).json({ mensaje: 'El usuario ya está en ese estado' })

    const usuario = await buscarUsuarioPorId(id)
    return res.status(200).json({ mensaje: mensajeOk, usuario: { ...usuario, gestionable: true }, sesionesCerradas })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ mensaje: mensajeError })
  }
}

// POST /api/usuarios/:id/bloquear  (CU 1.4 · A1, solo ADMINISTRADOR)
export const bloquear = crearControlador('BLOQUEADO', 'Usuario bloqueado correctamente', 'No se pudo bloquear al usuario')

// POST /api/usuarios/:id/activar  (CU 1.4 · A2, solo ADMINISTRADOR)
export const activar = crearControlador('ACTIVO', 'Usuario activado correctamente', 'No se pudo activar al usuario')