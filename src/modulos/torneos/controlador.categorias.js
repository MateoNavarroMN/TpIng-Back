import { listarCategorias } from './modelo.categorias.js'

const DISCIPLINAS = ['TENIS', 'PADEL']

// GET /api/categorias?disciplina=  (cualquier usuario autenticado). El formulario de torneos la usa
// para mostrar solo las categorías de la disciplina elegida.
export const listar = async (req, res) => {
  const { disciplina } = req.query
  if (disciplina !== undefined && !DISCIPLINAS.includes(disciplina)) {
    return res.status(400).json({ mensaje: 'Parámetro inválido: la disciplina no existe', campo: 'disciplina' })
  }

  try {
    const categorias = await listarCategorias(disciplina ?? null)
    return res.status(200).json({ categorias })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ mensaje: 'No se pudo obtener el listado de categorías' })
  }
}