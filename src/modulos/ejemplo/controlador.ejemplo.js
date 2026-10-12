import { insertarEjemplo } from './modelo.ejemplo.js'

// Controlador de ejemplo: muestra el patrón que siguen todos los controladores.
// 1. Validar a mano los datos del pedido y responder 400 si algo falta.
// 2. Llamar al modelo dentro de un try/catch y responder 500 si la consulta falla.
export const crearEjemplo = async (req, res) => {
  const { nombre } = req.body ?? {}

  if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
    return res.status(400).json({ mensaje: 'El nombre es obligatorio' })
  }

  try {
    const ejemplo = await insertarEjemplo(nombre.trim())
    return res.status(201).json({ mensaje: 'Ejemplo creado correctamente', ejemplo })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ mensaje: 'No se pudo crear el ejemplo' })
  }
}