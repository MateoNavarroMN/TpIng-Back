import { encriptarPassword } from '../autenticacion/seguridad.autenticacion.js'
import { validarDatosPersonal, validarPassword } from '../autenticacion/validaciones.autenticacion.js'
import { crearUsuario } from './modelo.usuarios.js'

// Roles que el Administrador puede asignar al crear una cuenta de personal.
// ADMINISTRADOR y JUGADOR no están: los administradores se dan de alta fuera del sistema
// y los jugadores se registran solos (CU 1.1).
const ROLES_PERSONAL = ['RECEPCIONISTA', 'ORGANIZADOR']

// Devuelve el rol si se puede asignar, o null (asignarRol del diagrama).
const asignarRol = (rol) => (ROLES_PERSONAL.includes(rol) ? rol : null)

// POST /api/usuarios/personal  (CU 1.1 · A1, solo ADMINISTRADOR)
// Se leen los campos uno por uno: un `estado`, un `dni` o cualquier otro dato del body se ignora.
export const crearPersonal = async (req, res) => {
  const { nombre, apellido, email, telefono, rol, password, confirmarPassword } = req.body ?? {}

  // Datos inválidos
  const errorDatos = validarDatosPersonal({ nombre, apellido, email, telefono })
  if (errorDatos) {
    return res.status(400).json({ mensaje: `Datos inválidos: ${errorDatos.detalle}`, campo: errorDatos.campo })
  }

  // Rol distinto de RECEPCIONISTA / ORGANIZADOR
  if (!asignarRol(rol)) {
    return res.status(400).json({ mensaje: 'Rol no permitido', campo: 'rol' })
  }

  // Contraseña inicial: mismos requisitos que el registro. La confirmación es opcional en la API
  // (la pantalla la pide), pero si viene tiene que coincidir.
  const motivo = validarPassword(password)
  if (motivo) {
    return res.status(400).json({ mensaje: `Contraseña no válida: ${motivo}`, campo: 'password' })
  }
  if (confirmarPassword !== undefined && confirmarPassword !== password) {
    return res.status(400).json({ mensaje: 'Las contraseñas no coinciden', campo: 'confirmarPassword' })
  }

  try {
    const usuario = await crearUsuario({
      email,
      passwordHash: await encriptarPassword(password),
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      telefono: telefono ? telefono.trim() : null,
      rol,
    })
    return res.status(201).json({ mensaje: 'Cuenta de personal creada correctamente', usuario })
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'usuario_email_key') {
      return res.status(409).json({ mensaje: 'Ya existe una cuenta con ese correo', campo: 'email' })
    }
    console.error(error)
    return res.status(500).json({ mensaje: 'No se pudo crear la cuenta de personal' })
  }
}