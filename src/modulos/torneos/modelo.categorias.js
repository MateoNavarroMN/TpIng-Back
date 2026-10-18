import { pool } from '../../config/conexion.bd.js'

// Modelo de categorías técnicas (tabla de M4 que usan los torneos: cada torneo pide una categoría).

const COLUMNAS = `id, nombre_categoria as nombre, disciplina,
  puntos_minimos as "puntosMinimos", puntos_maximos as "puntosMaximos"`

// Categorías ordenadas de menor a mayor puntaje. Sin disciplina devuelve las de Tenis y Pádel.
export const listarCategorias = async (disciplina = null, db = pool) => {
  const { rows } = await db.query(
    `select ${COLUMNAS}
       from categoria_tecnica
      where $1::disciplina is null or disciplina = $1::disciplina
      order by disciplina, puntos_minimos`,
    [disciplina]
  )
  return rows
}

export const buscarCategoriaPorId = async (id, db = pool) => {
  const { rows } = await db.query(`select ${COLUMNAS} from categoria_tecnica where id = $1`, [id])
  return rows[0] ?? null
}

// Categoría de un jugador en una disciplina (CU 3.2 · paso 6). Sale de su ranking; si todavía no tiene
// ranking en esa disciplina (nunca jugó), se toma la categoría inicial (la de menor puntaje).
export const categoriaDeJugador = async (jugadorId, disciplina, db = pool) => {
  const { rows } = await db.query(
    `select c.id, c.nombre_categoria as nombre, c.disciplina,
            c.puntos_minimos as "puntosMinimos", c.puntos_maximos as "puntosMaximos"
       from categoria_tecnica c
       left join ranking_disciplina r on r.categoria_id = c.id and r.jugador_id = $1
      where c.disciplina = $2::disciplina
      order by (r.id is null), c.puntos_minimos
      limit 1`,
    [jugadorId, disciplina]
  )
  return rows[0] ?? null
}