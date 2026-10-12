import { crearJugadorCompleto } from '../usuarios/modelo.usuarios.js'
import { encriptarPassword } from './seguridad.autenticacion.js'
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