// Modelo de ejemplo. Los modelos reales ejecutan SQL crudo con el Pool de `pg`
// (src/config/conexion.bd.js, se agrega en INF-02), por ejemplo:
//   const { rows } = await pool.query('insert into ejemplo (nombre) values ($1) returning *', [nombre])
//   return rows[0]
// Mientras tanto, si el nombre es "error" se simula una consulta que falla
// para poder probar la respuesta 500 del controlador.
export const insertarEjemplo = async (nombre) => {
  if (nombre === 'error') {
    throw new Error('Falla simulada de la consulta SQL')
  }
  return { id: 1, nombre }
}