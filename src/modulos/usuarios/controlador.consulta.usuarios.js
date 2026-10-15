import { buscarUsuarioPorId, listarUsuarios } from './modelo.consulta.usuarios.js'

const ROLES = ['ADMINISTRADOR', 'RECEPCIONISTA', 'ORGANIZADOR', 'JUGADOR']
const ESTADOS = ['ACTIVO', 'BLOQUEADO']
const TAMANIO_POR_DEFECTO = 10
const TAMANIO_MAXIMO = 50
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Las cuentas de ADMINISTRADOR se muestran pero no se pueden modificar desde la pantalla (CU 1.4)
const conGestionable = (usuario) => ({ ...usuario, gestionable: usuario.rol !== 'ADMINISTRADOR' })

// Un parámetro de query tiene que venir una sola vez y como texto (?q=a&q=b llega como arreglo)
const texto = (valor) => (typeof valor === 'string' ? valor.trim() : undefined)

// Entero positivo escrito solo con dígitos; si no viene, usa el valor por defecto; si viene mal, null
const entero = (valor, porDefecto) => {
  if (valor === undefined) return porDefecto
  return typeof valor === 'string' && /^\d{1,6}$/.test(valor) && Number(valor) >= 1 ? Number(valor) : null
}

const invalido = (res, mensaje, campo) => res.status(400).json({ mensaje: `Parámetro inválido: ${mensaje}`, campo })

// GET /api/usuarios?q=&rol=&estado=&pagina=&tamanio=  (CU 1.4, solo ADMINISTRADOR)
export const listar = async (req, res) => {
  const { q, rol, estado } = req.query
  if (q !== undefined && texto(q) === undefined) return invalido(res, 'q', 'q')
  if (rol !== undefined && !ROLES.includes(rol)) return invalido(res, 'el rol no existe', 'rol')
  if (estado !== undefined && !ESTADOS.includes(estado)) return invalido(res, 'el estado no existe', 'estado')

  const pagina = entero(req.query.pagina, 1)
  if (pagina === null) return invalido(res, 'la página debe ser un número desde 1', 'pagina')
  const tamanio = entero(req.query.tamanio, TAMANIO_POR_DEFECTO)
  if (tamanio === null || tamanio > TAMANIO_MAXIMO) {
    return invalido(res, `el tamaño debe estar entre 1 y ${TAMANIO_MAXIMO}`, 'tamanio')
  }

  try {
    const { usuarios, total } = await listarUsuarios({ q: texto(q), rol, estado, pagina, tamanio })
    // 2a: sin resultados es una lista vacía, no un error
    return res.status(200).json({
      usuarios: usuarios.map(conGestionable),
      total,
      pagina,
      tamanio,
      totalPaginas: Math.ceil(total / tamanio),
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ mensaje: 'No se pudo obtener el listado de usuarios' })
  }
}

// GET /api/usuarios/:id  (CU 1.4, solo ADMINISTRADOR)
export const obtener = async (req, res) => {
  const { id } = req.params
  if (!REGEX_UUID.test(id)) return res.status(404).json({ mensaje: 'Usuario no encontrado' })

  try {
    const usuario = await buscarUsuarioPorId(id)
    if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' })
    return res.status(200).json({ usuario: conGestionable(usuario) })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ mensaje: 'No se pudo obtener el usuario' })
  }
}