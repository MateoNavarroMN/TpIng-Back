import { pool } from '../../config/conexion.bd.js'

// Para comparar sin mayúsculas ni acentos: minúsculas, sin tildes y la ñ como n.
// Se aplica igual al texto buscado (en JS) y a las columnas (en SQL), sin necesitar extensiones de Postgres.
const CON_TILDES = 'áàäâéèëêíìïîóòöôúùüûñ'
const SIN_TILDES = 'aaaaeeeeiiiioooouuuun'
export const sinTildes = (texto) =>
  texto.toLowerCase().replace(/[áàäâéèëêíìïîóòöôúùüûñ]/g, (c) => SIN_TILDES[CON_TILDES.indexOf(c)])
const columnaNormalizada = (expresion) => `translate(lower(${expresion}), '${CON_TILDES}', '${SIN_TILDES}')`

// Escapa % _ \ para que el texto buscado se tome literal dentro de un LIKE
const escaparLike = (texto) => texto.replace(/[\\%_]/g, '\\$&')

const COLUMNAS = `u.id, u.email, u.nombre, u.apellido, u.telefono, u.rol, u.estado,
            u.fecha_registro::text as fecha_registro, u.ultimo_acceso,
            j.id as jugador_id, j.dni`

// Cada palabra buscada tiene que aparecer en el nombre, apellido, correo o DNI (todas las palabras a la vez),
// así "ana pérez" encuentra a Ana Pérez. El DNI se compara también sin puntos ("30.123.456").
export const listarUsuarios = async ({ q, rol, estado, pagina, tamanio }, db = pool) => {
  const condiciones = []
  const valores = []
  const agregar = (valor) => {
    valores.push(valor)
    return `$${valores.length}`
  }

  for (const palabra of sinTildes(q ?? '').split(/\s+/).filter(Boolean)) {
    const patron = agregar(`%${escaparLike(palabra)}%`)
    const soloDigitos = palabra.replace(/\./g, '')
    const porDni = soloDigitos ? ` or j.dni like ${agregar(`%${escaparLike(soloDigitos)}%`)}` : ''
    condiciones.push(
      `(${columnaNormalizada('u.nombre')} like ${patron}
        or ${columnaNormalizada('u.apellido')} like ${patron}
        or u.email like ${patron}${porDni})`
    )
  }
  if (rol) condiciones.push(`u.rol = ${agregar(rol)}`)
  if (estado) condiciones.push(`u.estado = ${agregar(estado)}`)

  const donde = condiciones.length > 0 ? `where ${condiciones.join(' and ')}` : ''
  const desde = `from usuario u left join jugador j on j.usuario_id = u.id ${donde}`

  const { rows: conteo } = await db.query(`select count(*)::int as total ${desde}`, valores)
  const { rows } = await db.query(
    `select ${COLUMNAS} ${desde}
      order by u.apellido, u.nombre, u.id
      limit ${agregar(tamanio)} offset ${agregar((pagina - 1) * tamanio)}`,
    valores
  )
  return { usuarios: rows, total: conteo[0].total }
}

export const buscarUsuarioPorId = async (id, db = pool) => {
  const { rows } = await db.query(
    `select ${COLUMNAS}
       from usuario u
       left join jugador j on j.usuario_id = u.id
      where u.id = $1`,
    [id]
  )
  return rows[0] ?? null
}