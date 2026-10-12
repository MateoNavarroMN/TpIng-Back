// Validaciones manuales del módulo de autenticación.
// Cada función devuelve null si todo está bien o { campo, detalle } con el primer problema.

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const REGEX_DNI = /^[0-9]{7,9}$/
const REGEX_TELEFONO = /^[0-9+()\- ]{6,20}$/

const esTexto = (valor) => typeof valor === 'string'

// Quita puntos y espacios del DNI: "30.111.222" → "30111222"
export const normalizarDni = (dni) => (esTexto(dni) ? dni.replace(/[.\s]/g, '') : dni)

// Mínimo 8 caracteres, al menos una letra y un número.
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

// Valida los datos personales del registro.
export const validarDatosRegistro = ({ nombre, apellido, dni, email, telefono }) => {
  const errorNombre = validarNombre(nombre, 'El nombre')
  if (errorNombre) return { campo: 'nombre', detalle: errorNombre }

  const errorApellido = validarNombre(apellido, 'El apellido')
  if (errorApellido) return { campo: 'apellido', detalle: errorApellido }

  if (!REGEX_DNI.test(normalizarDni(dni) ?? '')) {
    return { campo: 'dni', detalle: 'El DNI debe tener entre 7 y 9 dígitos' }
  }

  if (!esTexto(email) || !REGEX_EMAIL.test(email.trim()) || email.trim().length > 254) {
    return { campo: 'email', detalle: 'El correo no tiene un formato válido' }
  }

  // El teléfono es opcional: si no viene (o viene vacío) se guarda como null.
  if (telefono !== undefined && telefono !== null && telefono !== '') {
    if (!esTexto(telefono) || !REGEX_TELEFONO.test(telefono.trim())) {
      return { campo: 'telefono', detalle: 'El teléfono no tiene un formato válido' }
    }
  }

  return null
}