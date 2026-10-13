import { buscarPerfil } from '../modulos/usuarios/modelo.usuarios.js'
import { buscarSesionVigente } from '../modulos/autenticacion/modelo.autenticacion.js'
import { verificarTokenJWT } from '../modulos/autenticacion/seguridad.autenticacion.js'

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const sesionInvalida = (res) => res.status(401).json({ mensaje: 'Sesión inválida o vencida' })

export const autenticar = async (req, res, next) => {
  try {
    const [tipo, token] = (req.headers.authorization ?? '').split(' ')
    if (tipo !== 'Bearer' || !token) return sesionInvalida(res)

    const datos = verificarTokenJWT(token)
    if (!datos || !REGEX_UUID.test(datos.sid) || !REGEX_UUID.test(datos.sub)) return sesionInvalida(res)

    // La sesión tiene que seguir ACTIVA, sin vencer y ser de ese usuario
    const sesion = await buscarSesionVigente(datos.sid)
    if (!sesion || sesion.usuario_id !== datos.sub) return sesionInvalida(res)

    const usuario = await buscarPerfil(datos.sub)
    if (!usuario || usuario.estado !== 'ACTIVO') return sesionInvalida(res)

    req.usuario = usuario
    req.sesionId = sesion.id
    next()
  } catch (error) {
    console.error(error)
    res.status(500).json({ mensaje: 'No se pudo validar la sesión' })
  }
}

const PERMISOS_DE = {
  ADMINISTRADOR: ['ADMINISTRADOR', 'RECEPCIONISTA', 'ORGANIZADOR'],
  RECEPCIONISTA: ['RECEPCIONISTA'],
  ORGANIZADOR: ['ORGANIZADOR'],
  JUGADOR: ['JUGADOR'],
}

// Se usa siempre después de `autenticar`:
//   router.post('/', autenticar, autorizar('ORGANIZADOR'), crearTorneo)
export const autorizar = (...rolesPermitidos) => (req, res, next) => {
  if (!req.usuario) return sesionInvalida(res)

  const permisos = PERMISOS_DE[req.usuario.rol] ?? []
  if (!rolesPermitidos.some((rol) => permisos.includes(rol))) {
    return res.status(403).json({ mensaje: 'Sin permiso' })
  }
  next()
}