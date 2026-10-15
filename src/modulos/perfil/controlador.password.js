import { compararPassword, encriptarPassword } from '../autenticacion/seguridad.autenticacion.js'
import { validarPassword } from '../autenticacion/validaciones.autenticacion.js'
import { buscarHashPorId, cambiarPassword } from '../usuarios/modelo.usuarios.js'

const esTexto = (valor) => typeof valor === 'string'

// PATCH /api/perfil/password  (CU 1.3 · A1)
// Body: { actual, nueva, confirmacion }. Cambia la contraseña del usuario de la sesión y
// cierra sus demás sesiones (otros navegadores o dispositivos); la sesión actual sigue abierta.
export const cambiarPasswordPropia = async (req, res) => {
  const { actual, nueva, confirmacion } = req.body ?? {}

  if (!esTexto(actual) || !actual) {
    return res.status(400).json({ mensaje: 'Datos inválidos: la contraseña actual es obligatoria', campo: 'actual' })
  }
  if (!esTexto(nueva) || !nueva) {
    return res.status(400).json({ mensaje: 'Datos inválidos: la contraseña nueva es obligatoria', campo: 'nueva' })
  }
  if (!esTexto(confirmacion) || !confirmacion) {
    return res.status(400).json({ mensaje: 'Datos inválidos: falta confirmar la contraseña nueva', campo: 'confirmacion' })
  }

  try {
    // A1a · la contraseña actual tiene que ser correcta
    const hashActual = await buscarHashPorId(req.usuario.id)
    if (!hashActual || !(await compararPassword(actual, hashActual))) {
      return res.status(400).json({ mensaje: 'La contraseña actual es incorrecta', campo: 'actual' })
    }

    // A1b · la nueva tiene que cumplir los requisitos, ser distinta de la actual y coincidir con la confirmación
    const motivo = validarPassword(nueva)
    if (motivo) {
      return res.status(400).json({ mensaje: `Contraseña no válida: ${motivo}`, campo: 'nueva' })
    }
    if (nueva === actual) {
      return res.status(400).json({ mensaje: 'Contraseña no válida: debe ser distinta de la actual', campo: 'nueva' })
    }
    if (nueva !== confirmacion) {
      return res.status(400).json({ mensaje: 'Contraseña no válida: la confirmación no coincide', campo: 'confirmacion' })
    }

    const sesionesCerradas = await cambiarPassword(req.usuario.id, await encriptarPassword(nueva), req.sesionId)
    return res.status(200).json({ mensaje: 'Contraseña actualizada correctamente', sesionesCerradas })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ mensaje: 'No se pudo cambiar la contraseña' })
  }
}