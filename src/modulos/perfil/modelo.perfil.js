import { pool } from '../../config/conexion.bd.js'

// Actualiza solo los datos que el propio usuario puede modificar: nombre, apellido y teléfono.
export const actualizarPerfil = async (id, { nombre, apellido, telefono }, db = pool) => {
  const { rowCount } = await db.query(
    'update usuario set nombre = $2, apellido = $3, telefono = $4 where id = $1',
    [id, nombre, apellido, telefono]
  )
  return rowCount > 0
}