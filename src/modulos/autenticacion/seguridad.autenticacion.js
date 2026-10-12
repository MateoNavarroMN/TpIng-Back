import bcrypt from 'bcryptjs'

const RONDAS = 10

// Devuelve el hash que se guarda en usuario.password_hash.
export const encriptarPassword = (password) => bcrypt.hash(password, RONDAS)

// true si la contraseña coincide con el hash guardado.
export const compararPassword = (password, hash) => bcrypt.compare(password, hash)