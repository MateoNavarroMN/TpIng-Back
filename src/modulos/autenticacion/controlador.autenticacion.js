import {
  buscarPerfil,
  buscarPorEmail,
  crearJugadorCompleto,
  registrarAccesoExitoso,
  registrarIntentoFallido,
  reiniciarIntentos,
} from '../usuarios/modelo.usuarios.js'
import { cerrarSesion, crearSesion } from './modelo.autenticacion.js'
import {
  HASH_FALSO,
  HORAS_SESION,
  compararPassword,
  encriptarPassword,
  generarTokenJWT,
  verificarTokenJWT,
} from './seguridad.autenticacion.js'
import { normalizarDni, validarDatosRegistro, validarPassword } from './validaciones.autenticacion.js'

// POST /api/auth/registro
// La cuenta siempre se crea como JUGADOR ACTIVO.
export const registrarJugador = async (req, res) => {
  const { nombre, apellido, dni, email, telefono, password, confirmarPassword } = req.body ?? {}

  // Datos inválidos
  const errorDatos = validarDatosRegistro({ nombre, apellido, dni, email, telefono })
  if (errorDatos) {
    return res.status(400).json({ mensaje: `Datos inválidos: ${errorDatos.detalle}`, campo: errorDatos.campo })
  }

  // Contraseña que no cumple los requisitos, o que no coincide con la confirmación
  const motivo = validarPassword(password)
  if (motivo) {
    return res.status(400).json({ mensaje: `Contraseña no válida: ${motivo}`, campo: 'password' })
  }
  if (password !== confirmarPassword) {
    return res.status(400).json({ mensaje: 'Las contraseñas no coinciden', campo: 'confirmarPassword' })
  }

  try {
    const usuario = await crearJugadorCompleto({
      email,
      passwordHash: await encriptarPassword(password),
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      telefono: telefono ? telefono.trim() : null,
      dni: normalizarDni(dni),
    })
    return res.status(201).json({ mensaje: 'Cuenta creada correctamente', usuario })
  } catch (error) {
    // La unicidad la garantiza la base (también ante dos registros simultáneos).
    if (error.code === '23505' && error.constraint === 'usuario_email_key') {
      return res.status(409).json({ mensaje: 'Ya existe una cuenta con ese correo', campo: 'email' }) // 5b
    }
    if (error.code === '23505' && error.constraint === 'jugador_dni_key') {
      return res.status(409).json({ mensaje: 'Ya existe una cuenta con ese DNI', campo: 'dni' }) // 5c
    }
    console.error(error)
    return res.status(500).json({ mensaje: 'No se pudo crear la cuenta' })
  }
}

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_INTENTOS = 5
const MINUTOS_ESPERA = 15

const credencialesInvalidas = (res) => res.status(401).json({ mensaje: 'Credenciales inválidas' })

const cuentaEnEspera = (res, bloqueoHasta) =>
  res.status(423).json({
    mensaje: 'Cuenta en espera, reintentá más tarde',
    segundosRestantes: Math.max(1, Math.ceil((bloqueoHasta - Date.now()) / 1000)),
  })

// POST /api/auth/login
export const iniciarSesion = async (req, res) => {
  const { email, password } = req.body ?? {}

  if (typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ mensaje: 'Datos inválidos: el correo es obligatorio', campo: 'email' })
  }
  if (typeof password !== 'string' || !password) {
    return res.status(400).json({ mensaje: 'Datos inválidos: la contraseña es obligatoria', campo: 'password' })
  }

  try {
    const usuario = await buscarPorEmail(email)

    // El correo no existe: se compara igual contra un hash falso para no delatarlo por el tiempo de respuesta
    if (!usuario) {
      await compararPassword(password, HASH_FALSO)
      return credencialesInvalidas(res)
    }

    // Cuenta bloqueada por el Administrador: mismo mensaje genérico
    if (usuario.estado === 'BLOQUEADO') return credencialesInvalidas(res)

    // Cuenta en espera: se rechaza aunque la contraseña sea correcta.
    // Si la espera ya venció, se reinicia el contador y se sigue con el login normal.
    if (usuario.bloqueo_hasta) {
      if (usuario.bloqueo_hasta > new Date()) return cuentaEnEspera(res, usuario.bloqueo_hasta)
      await reiniciarIntentos(usuario.id)
    }

    // Contraseña incorrecta: suma un intento; al 5.º queda en espera 15 minutos
    if (!(await compararPassword(password, usuario.password_hash))) {
      const intento = await registrarIntentoFallido(usuario.id, MAX_INTENTOS, MINUTOS_ESPERA)
      if (intento.bloqueo_hasta && intento.bloqueo_hasta > new Date()) {
        return cuentaEnEspera(res, intento.bloqueo_hasta)
      }
      return credencialesInvalidas(res)
    }

    // Login correcto: reinicia intentos, anota el último acceso, crea la sesión y firma el token
    await registrarAccesoExitoso(usuario.id)
    const sesion = await crearSesion(usuario.id, HORAS_SESION)
    const token = generarTokenJWT({ usuarioId: usuario.id, rol: usuario.rol, sesionId: sesion.id })

    return res.status(200).json({ token, usuario: await buscarPerfil(usuario.id) })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ mensaje: 'No se pudo iniciar sesión' })
  }
}

// GET /api/auth/me: el usuario de la sesión actual (lo carga el middleware `autenticar`).
export const obtenerUsuarioActual = (req, res) => {
  res.status(200).json({ usuario: req.usuario })
}

// POST /api/auth/logout  (CU 1.2 · A2)
// Cierra solo la sesión del token que llega.
export const cerrarSesionActual = async (req, res) => {
  try {
    const [tipo, token] = (req.headers.authorization ?? '').split(' ')
    const datos = tipo === 'Bearer' && token ? verificarTokenJWT(token, { ignorarVencimiento: true }) : null

    // Con firma válida, el `sid` es una sesión nuestra. Un token falso no cierra nada.
    if (datos && REGEX_UUID.test(datos.sid)) {
      await cerrarSesion(datos.sid)
    }
    return res.status(200).json({ mensaje: 'Sesión cerrada' })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ mensaje: 'No se pudo cerrar la sesión' })
  }
}