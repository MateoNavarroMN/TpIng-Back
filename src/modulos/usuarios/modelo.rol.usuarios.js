import { pool } from '../../config/conexion.bd.js'
import { cerrarSesionesDeUsuario } from '../autenticacion/modelo.autenticacion.js'

// Cambia el rol de un usuario y cierra todas sus sesiones, en una transacción: o se hacen las dos cosas o ninguna.
// Se bloquea la fila del usuario (for update) mientras se decide, así dos cambios simultáneos no se pisan.
// No lanza por reglas de negocio: devuelve un `resultado` para que el controlador elija la respuesta.
//   NO_ENCONTRADO · ES_ADMINISTRADOR · SIN_CAMBIOS · SIN_DNI · OK (con sesionesCerradas)
export const cambiarRolDeUsuario = async (id, nuevoRol) => {
  const cliente = await pool.connect()
  try {
    await cliente.query('begin')
    const { rows } = await cliente.query(
      `select u.rol, j.id as jugador_id
         from usuario u
         left join jugador j on j.usuario_id = u.id
        where u.id = $1
          for update of u`,
      [id]
    )
    const usuario = rows[0]

    let resultado = null
    if (!usuario) resultado = 'NO_ENCONTRADO'
    else if (usuario.rol === 'ADMINISTRADOR') resultado = 'ES_ADMINISTRADOR'
    else if (usuario.rol === nuevoRol) resultado = 'SIN_CAMBIOS'
    // Ser JUGADOR exige tener perfil de jugador (con DNI); el personal creado por el Administrador no lo tiene
    else if (nuevoRol === 'JUGADOR' && !usuario.jugador_id) resultado = 'SIN_DNI'

    if (resultado) {
      await cliente.query('rollback')
      return { resultado }
    }

    await cliente.query('update usuario set rol = $2 where id = $1', [id, nuevoRol])
    const sesionesCerradas = await cerrarSesionesDeUsuario(id, null, cliente)
    await cliente.query('commit')
    return { resultado: 'OK', sesionesCerradas }
  } catch (error) {
    await cliente.query('rollback')
    throw error
  } finally {
    cliente.release()
  }
}