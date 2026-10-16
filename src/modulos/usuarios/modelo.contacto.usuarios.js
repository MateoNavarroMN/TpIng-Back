import { pool } from '../../config/conexion.bd.js'
import { normalizarEmail } from './modelo.usuarios.js'

// Cambia el correo y/o el DNI de un usuario, en una transacción (la fila del usuario queda bloqueada
// con `for update` mientras se decide). Solo se aplican los datos que realmente cambian.
// No lanza por reglas de negocio: devuelve un `resultado` para que el controlador elija la respuesta.
//   NO_ENCONTRADO · ES_ADMINISTRADOR · SIN_PERFIL_JUGADOR · SIN_CAMBIOS · EMAIL_DUPLICADO · DNI_DUPLICADO · OK
// `dni` llega ya normalizado (solo dígitos). Si dos pedidos chocan a la vez, la restricción única de la base
// (error 23505) cubre lo que la revisión previa no alcanzó a ver.
export const cambiarContactoDeUsuario = async (id, { email, dni }) => {
  const cliente = await pool.connect()
  try {
    await cliente.query('begin')
    const { rows } = await cliente.query(
      `select u.rol, u.email, j.id as jugador_id, j.dni
         from usuario u
         left join jugador j on j.usuario_id = u.id
        where u.id = $1
          for update of u`,
      [id]
    )
    const actual = rows[0]

    const nuevoEmail = email === undefined ? undefined : normalizarEmail(email)
    const cambiaEmail = nuevoEmail !== undefined && nuevoEmail !== actual?.email
    const cambiaDni = dni !== undefined && dni !== actual?.dni

    let resultado = null
    if (!actual) resultado = 'NO_ENCONTRADO'
    else if (actual.rol === 'ADMINISTRADOR') resultado = 'ES_ADMINISTRADOR'
    else if (dni !== undefined && !actual.jugador_id) resultado = 'SIN_PERFIL_JUGADOR'
    else if (!cambiaEmail && !cambiaDni) resultado = 'SIN_CAMBIOS'
    else if (cambiaEmail && (await cliente.query('select 1 from usuario where email = $1 and id <> $2', [nuevoEmail, id])).rowCount > 0) {
      resultado = 'EMAIL_DUPLICADO'
    } else if (cambiaDni && (await cliente.query('select 1 from jugador where dni = $1 and id <> $2', [dni, actual.jugador_id])).rowCount > 0) {
      resultado = 'DNI_DUPLICADO'
    }

    if (resultado) {
      await cliente.query('rollback')
      return { resultado }
    }

    if (cambiaEmail) await cliente.query('update usuario set email = $2 where id = $1', [id, nuevoEmail])
    if (cambiaDni) await cliente.query('update jugador set dni = $2 where id = $1', [actual.jugador_id, dni])
    await cliente.query('commit')
    return { resultado: 'OK' }
  } catch (error) {
    await cliente.query('rollback')
    if (error.code === '23505') {
      return { resultado: error.constraint?.includes('dni') ? 'DNI_DUPLICADO' : 'EMAIL_DUPLICADO' }
    }
    throw error
  } finally {
    cliente.release()
  }
}