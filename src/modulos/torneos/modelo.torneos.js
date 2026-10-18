import { pool } from '../../config/conexion.bd.js'

// Modelo de torneos (CU 3.1). SQL crudo; las reglas (qué estado permite qué) las deciden los controladores.
// Todas las funciones reciben como último parámetro opcional `db`: el pool o un cliente con una transacción abierta.

// Columnas que se devuelven al frontend, con los nombres en camelCase. Las fechas van como texto ('2026-11-02')
// para evitar corrimientos por zona horaria. `inscriptos` cuenta las inscripciones ACTIVAS.
const SELECT_TORNEO = `
  select t.id, t.nombre, t.disciplina, t.formato, t.estado,
         t.clasifican_por_zona as "clasificanPorZona", t.cupo_maximo as "cupoMaximo",
         t.fase_actual as "faseActual",
         t.fecha_inicio::text as "fechaInicio", t.fecha_fin::text as "fechaFin",
         t.precio_inscripcion::float8 as "precioInscripcion",
         t.categoria_id as "categoriaId", c.nombre_categoria as categoria,
         (select count(*)::int from inscripcion i where i.torneo_id = t.id and i.estado = 'ACTIVA') as inscriptos
    from torneo t
    join categoria_tecnica c on c.id = t.categoria_id`

// Agrega el cupo disponible a una fila (simplifica el front).
const conCupo = (fila) => (fila ? { ...fila, cupoDisponible: Math.max(0, fila.cupoMaximo - fila.inscriptos) } : null)

// datos: { nombre, disciplina, categoriaId, formato, clasificanPorZona, cupoMaximo, fechaInicio, fechaFin, precioInscripcion }
// Se crea siempre en PLANIFICADO (CU 3.1 · paso 7).
export const crearTorneo = async (datos, db = pool) => {
  const { rows } = await db.query(
    `insert into torneo (nombre, disciplina, categoria_id, formato, clasifican_por_zona, cupo_maximo,
                         fecha_inicio, fecha_fin, precio_inscripcion)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id`,
    [
      datos.nombre,
      datos.disciplina,
      datos.categoriaId,
      datos.formato,
      datos.formato === 'ZONAS_Y_ELIMINACION' ? datos.clasificanPorZona : null,
      datos.cupoMaximo,
      datos.fechaInicio,
      datos.fechaFin,
      datos.precioInscripcion ?? 0,
    ]
  )
  return buscarTorneoPorId(rows[0].id, db)
}

export const buscarTorneoPorId = async (id, db = pool) => {
  const { rows } = await db.query(`${SELECT_TORNEO} where t.id = $1`, [id])
  return conCupo(rows[0])
}

// Bloquea la fila del torneo hasta que termine la transacción (usar con un cliente, no con el pool).
// Sirve para que dos operaciones sobre el mismo torneo (dos inscripciones por el último cupo, cerrar
// inscripciones mientras alguien se inscribe...) no se pisen.
export const bloquearTorneo = async (id, cliente) => {
  const { rows } = await cliente.query('select id, estado, formato, fase_actual as "faseActual" from torneo where id = $1 for update', [id])
  return rows[0] ?? null
}

// filtros: { estados: ['PLANIFICADO', ...], disciplina }. Los más próximos primero.
export const listarTorneos = async ({ estados = null, disciplina = null } = {}, db = pool) => {
  const { rows } = await db.query(
    `${SELECT_TORNEO}
      where ($1::estado_torneo[] is null or t.estado = any($1::estado_torneo[]))
        and ($2::disciplina is null or t.disciplina = $2::disciplina)
      order by t.fecha_inicio desc, t.nombre`,
    [estados, disciplina]
  )
  return rows.map(conCupo)
}

// Edición (CU 3.1 · A1). Recibe los mismos datos que crearTorneo; no cambia el estado.
export const actualizarTorneo = async (id, datos, db = pool) => {
  const { rowCount } = await db.query(
    `update torneo
        set nombre = $2, disciplina = $3, categoria_id = $4, formato = $5, clasifican_por_zona = $6,
            cupo_maximo = $7, fecha_inicio = $8, fecha_fin = $9, precio_inscripcion = $10
      where id = $1`,
    [
      id,
      datos.nombre,
      datos.disciplina,
      datos.categoriaId,
      datos.formato,
      datos.formato === 'ZONAS_Y_ELIMINACION' ? datos.clasificanPorZona : null,
      datos.cupoMaximo,
      datos.fechaInicio,
      datos.fechaFin,
      datos.precioInscripcion ?? 0,
    ]
  )
  return rowCount > 0 ? buscarTorneoPorId(id, db) : null
}

// Edita el torneo solo si sigue PLANIFICADO (CU 3.1 · A1). Bloquea la fila mientras tanto, así nadie
// abre las inscripciones entre que se revisa el estado y se guardan los cambios.
// Devuelve { resultado: 'NO_ENCONTRADO' | 'NO_EDITABLE' | 'OK', torneo }.
export const editarTorneoPlanificado = async (id, datos) => {
  const cliente = await pool.connect()
  try {
    await cliente.query('begin')
    const actual = await bloquearTorneo(id, cliente)
    if (!actual) {
      await cliente.query('rollback')
      return { resultado: 'NO_ENCONTRADO', torneo: null }
    }
    if (actual.estado !== 'PLANIFICADO') {
      await cliente.query('rollback')
      return { resultado: 'NO_EDITABLE', torneo: actual }
    }
    const torneo = await actualizarTorneo(id, datos, cliente)
    await cliente.query('commit')
    return { resultado: 'OK', torneo }
  } catch (error) {
    await cliente.query('rollback')
    throw error
  } finally {
    cliente.release()
  }
}


// Cambia el estado (y la fase si se indica). Si se pasa `faseActual: undefined` la fase no se toca.
export const cambiarEstadoTorneo = async (id, estado, faseActual = undefined, db = pool) => {
  const { rowCount } = await db.query(
    faseActual === undefined
      ? 'update torneo set estado = $2 where id = $1'
      : 'update torneo set estado = $2, fase_actual = $3 where id = $1',
    faseActual === undefined ? [id, estado] : [id, estado, faseActual]
  )
  return rowCount > 0
}