import { pool } from '../../config/conexion.bd.js'
import { cerrarSesionesDeUsuario } from '../autenticacion/modelo.autenticacion.js'

// Bloquea o activa una cuenta, en una transacción (la fila del usuario queda bloqueada con `for update`
// mientras se decide, así dos pedidos simultáneos no se pisan).
//   BLOQUEADO → pone el estado y cierra todas las sesiones del usuario.
//   ACTIVO    → pone el estado y limpia intentos_fallidos y bloqueo_hasta (la cuenta arranca de cero).
// No lanza por reglas de negocio: devuelve un `resultado` para que el controlador elija la respuesta.
//   NO_ENCONTRADO · ES_ADMINISTRADOR · SIN_CAMBIOS · OK (con sesionesCerradas, solo al bloquear)
export const cambiarEstadoDeUsuario = async (id, nuevoEstado) => {
  const cliente = await pool.connect()
  try {
    await cliente.query('begin')
    const { rows } = await cliente.query('select rol, estado from usuario where id = $1 for update', [id])
    const usuario = rows[0]

    let resultado = null
    if (!usuario) resultado = 'NO_ENCONTRADO'
    else if (usuario.rol === 'ADMINISTRADOR') resultado = 'ES_ADMINISTRADOR'
    else if (usuario.estado === nuevoEstado) resultado = 'SIN_CAMBIOS'

    if (resultado) {
      await cliente.query('rollback')
      return { resultado }
    }

    let sesionesCerradas = 0
    if (nuevoEstado === 'BLOQUEADO') {
      await cliente.query(`update usuario set estado = 'BLOQUEADO' where id = $1`, [id])
      sesionesCerradas = await cerrarSesionesDeUsuario(id, null, cliente)
    } else {
      await cliente.query(
        `update usuario set estado = 'ACTIVO', intentos_fallidos = 0, bloqueo_hasta = null where id = $1`,
        [id]
      )
    }
    await cliente.query('commit')
    return { resultado: 'OK', sesionesCerradas }
  } catch (error) {
    await cliente.query('rollback')
    throw error
  } finally {
    cliente.release()
  }
}