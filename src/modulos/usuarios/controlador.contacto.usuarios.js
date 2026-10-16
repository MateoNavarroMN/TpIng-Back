import { normalizarDni, validarDni, validarEmail } from '../autenticacion/validaciones.autenticacion.js'
import { buscarUsuarioPorId } from './modelo.consulta.usuarios.js'
import { cambiarContactoDeUsuario } from './modelo.contacto.usuarios.js'

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const datosInvalidos = (res, detalle, campo) =>
  res.status(400).json({ mensaje: `Datos inválidos: ${detalle}`, ...(campo && { campo }) })

// PATCH /api/usuarios/:id/contacto  con { email?, dni? }  (solo ADMINISTRADOR)
// Los campos se leen uno por uno: cualquier otro dato del body (rol, estado, nombre…) se ignora.
export const modificarContacto = async (req, res) => {
  const { id } = req.params
  if (!REGEX_UUID.test(id)) return res.status(404).json({ mensaje: 'Usuario no encontrado' })

  const { email, dni } = req.body ?? {}
  if (email === undefined && dni === undefined) return datosInvalidos(res, 'enviá el correo o el DNI a modificar')

  // Formato
  if (email !== undefined) {
    const motivo = validarEmail(email)
    if (motivo) return datosInvalidos(res, motivo.charAt(0).toLowerCase() + motivo.slice(1), 'email')
  }
  if (dni !== undefined) {
    // validarDni acepta un número (lo convierte a texto al probar el formato); acá se exige texto como en el resto de la API
    const motivo = typeof dni === 'string' ? validarDni(dni) : 'El DNI debe ser un texto de 7 a 9 dígitos'
    if (motivo) return datosInvalidos(res, motivo.charAt(0).toLowerCase() + motivo.slice(1), 'dni')
  }

  try {
    const { resultado } = await cambiarContactoDeUsuario(id, {
      email,
      dni: dni === undefined ? undefined : normalizarDni(dni),
    })

    if (resultado === 'NO_ENCONTRADO') return res.status(404).json({ mensaje: 'Usuario no encontrado' })
    if (resultado === 'ES_ADMINISTRADOR') {
      return res.status(409).json({ mensaje: 'Las cuentas de Administrador se gestionan fuera del sistema' })
    }
    if (resultado === 'SIN_PERFIL_JUGADOR') {
      return res.status(400).json({ mensaje: 'El usuario no tiene perfil de jugador', campo: 'dni' })
    }
    if (resultado === 'SIN_CAMBIOS') return res.status(409).json({ mensaje: 'No hay cambios para guardar' })
    // Unicidad
    if (resultado === 'EMAIL_DUPLICADO') return res.status(409).json({ mensaje: 'Ya existe una cuenta con ese correo', campo: 'email' })
    if (resultado === 'DNI_DUPLICADO') return res.status(409).json({ mensaje: 'Ya existe una cuenta con ese DNI', campo: 'dni' })

    const usuario = await buscarUsuarioPorId(id)
    return res.status(200).json({ mensaje: 'Datos actualizados correctamente', usuario: { ...usuario, gestionable: true } })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ mensaje: 'No se pudieron actualizar los datos' })
  }
}