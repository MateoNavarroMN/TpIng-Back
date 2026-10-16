import { buscarUsuarioPorId } from './modelo.consulta.usuarios.js'
import { cambiarRolDeUsuario } from './modelo.rol.usuarios.js'

// Roles que se pueden asignar desde acá. ADMINISTRADOR no está: esas cuentas se gestionan fuera del sistema.
const ROLES_ASIGNABLES = ['JUGADOR', 'RECEPCIONISTA', 'ORGANIZADOR']
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// PATCH /api/usuarios/:id/rol  con { rol }  (CU 1.4, solo ADMINISTRADOR)
export const cambiarRol = async (req, res) => {
  const { id } = req.params
  if (!REGEX_UUID.test(id)) return res.status(404).json({ mensaje: 'Usuario no encontrado' })

  const rol = req.body?.rol
  if (typeof rol !== 'string' || !ROLES_ASIGNABLES.includes(rol)) {
    return res.status(400).json({ mensaje: 'Rol no permitido', campo: 'rol' })
  }

  try {
    const { resultado, sesionesCerradas } = await cambiarRolDeUsuario(id, rol)

    if (resultado === 'NO_ENCONTRADO') return res.status(404).json({ mensaje: 'Usuario no encontrado' })
    // 7a: también vale para la propia cuenta del administrador que hace el pedido
    if (resultado === 'ES_ADMINISTRADOR') {
      return res.status(409).json({ mensaje: 'Las cuentas de Administrador se gestionan fuera del sistema' })
    }
    // 7b: el rol pedido es el que ya tiene
    if (resultado === 'SIN_CAMBIOS') return res.status(409).json({ mensaje: 'No hay cambios para guardar' })
    if (resultado === 'SIN_DNI') {
      return res.status(409).json({ mensaje: 'No se puede asignar el rol Jugador: la cuenta no tiene DNI cargado', campo: 'rol' })
    }

    const usuario = await buscarUsuarioPorId(id)
    return res.status(200).json({
      mensaje: 'Rol actualizado correctamente',
      usuario: { ...usuario, gestionable: true },
      sesionesCerradas,
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ mensaje: 'No se pudo cambiar el rol' })
  }
}