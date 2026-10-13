import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const RONDAS = 10

// Devuelve el hash que se guarda en usuario.password_hash.
export const encriptarPassword = (password) => bcrypt.hash(password, RONDAS)

// true si la contraseña coincide con el hash guardado.
export const compararPassword = (password, hash) => bcrypt.compare(password, hash)

// Hash de una contraseña que nadie conoce. El login lo compara cuando el correo no existe,
// para que tarde lo mismo que con un correo válido y no se pueda adivinar qué correos están registrados.
export const HASH_FALSO = bcrypt.hashSync('contraseña-que-no-existe', RONDAS)

// Duración de la sesión y del token.
export const HORAS_SESION = Number(process.env.JWT_HORAS) || 8

// Crea el token firmado con { sub: id del usuario, rol, sid: id de la sesión }.
// El `sid` permite revocar el token: M1-BE-04 comprueba que la sesión siga ACTIVA en cada pedido.
export const generarTokenJWT = ({ usuarioId, rol, sesionId }) => {
  if (!process.env.JWT_SECRET) throw new Error('Falta la variable de entorno JWT_SECRET')
  return jwt.sign({ sub: usuarioId, rol, sid: sesionId }, process.env.JWT_SECRET, {
    expiresIn: `${HORAS_SESION}h`,
  })
}

// Verifica la firma y el vencimiento del token. Devuelve el contenido ({ sub, rol, sid, iat, exp })
// o null si el token es falso, está alterado o venció.
export const verificarTokenJWT = (token, { ignorarVencimiento = false } = {}) => {
  if (!process.env.JWT_SECRET) throw new Error('Falta la variable de entorno JWT_SECRET')
  try {
    return jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: ignorarVencimiento })
  } catch {
    return null
  }
}