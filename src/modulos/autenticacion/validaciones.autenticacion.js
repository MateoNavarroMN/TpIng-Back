// Validaciones manuales del módulo de autenticación.
// Cada función devuelve null si todo está bien o { campo, detalle } con el primer problema.

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const REGEX_DNI = /^[0-9]{7,9}$/
const REGEX_TELEFONO = /^[0-9+()\- ]{6,20}$/

const esTexto = (valor) => typeof valor === 'string'

// Quita puntos y espacios del DNI: "30.111.222" → "30111222"
export const normalizarDni = (dni) => (esTexto(dni) ? dni.replace(/[.\s]/g, '') : dni)

// Reglas de contraseña (5d): mínimo 8 caracteres, al menos una letra y un número.
// bcrypt solo usa los primeros 72 bytes, por eso se fija ese máximo.
export const validarPassword = (password) => {
  if (!esTexto(password) || password.length === 0) return 'La contraseña es obligatoria'
  if (password.length < 8) return 'Debe tener al menos 8 caracteres'
  if (Buffer.byteLength(password) > 72) return 'Debe tener como máximo 72 caracteres'
  if (!/[A-Za-z]/.test(password)) return 'Debe incluir al menos una letra'
  if (!/[0-9]/.test(password)) return 'Debe incluir al menos un número'
  return null
}

export const validarNombre = (valor, etiqueta) => {
  if (!esTexto(valor) || !valor.trim()) return `${etiqueta} es obligatorio`
  if (valor.trim().length > 60) return `${etiqueta} puede tener como máximo 60 caracteres`
  return null
}

export const validarDni = (dni) =>
  REGEX_DNI.test(normalizarDni(dni) ?? '') ? null : 'El DNI debe tener entre 7 y 9 dígitos'

export const validarEmail = (email) =>
  esTexto(email) && REGEX_EMAIL.test(email.trim()) && email.trim().length <= 254
    ? null
    : 'El correo no tiene un formato válido'

// El teléfono es opcional: si no viene (o viene vacío) es válido y se guarda como null.
export const validarTelefono = (telefono) => {
  if (telefono === undefined || telefono === null || telefono === '') return null
  return esTexto(telefono) && REGEX_TELEFONO.test(telefono.trim()) ? null : 'El teléfono no tiene un formato válido'
}

// Devuelve el primer error de una lista de [campo, detalle] o null si no hay ninguno
const primerError = (revisiones) => {
  const falla = revisiones.find(([, detalle]) => detalle)
  return falla ? { campo: falla[0], detalle: falla[1] } : null
}

// Valida los datos personales del registro (5a). La contraseña se valida aparte (5d).
export const validarDatosRegistro = ({ nombre, apellido, dni, email, telefono }) =>
  primerError([
    ['nombre', validarNombre(nombre, 'El nombre')],
    ['apellido', validarNombre(apellido, 'El apellido')],
    ['dni', validarDni(dni)],
    ['email', validarEmail(email)],
    ['telefono', validarTelefono(telefono)],
  ])

// Igual que el registro pero sin DNI: lo usa el alta de personal por el Administrador.
export const validarDatosPersonal = ({ nombre, apellido, email, telefono }) =>
  primerError([
    ['nombre', validarNombre(nombre, 'El nombre')],
    ['apellido', validarNombre(apellido, 'El apellido')],
    ['email', validarEmail(email)],
    ['telefono', validarTelefono(telefono)],
  ])