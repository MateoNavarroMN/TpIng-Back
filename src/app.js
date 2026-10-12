import express from 'express'
import cors from 'cors'
import rutasEjemplo from './modulos/ejemplo/rutas.ejemplo.js'

const app = express()

// CORS: CORS_ORIGIN acepta uno o varios orígenes separados por coma.
// Si no está definido, se permite cualquier origen (útil en desarrollo).
const origenes = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origen) => origen.trim())
  : '*'

// Middlewares
app.use(cors({ origin: origenes }))
app.use(express.json())

// Ruta de salud
app.get('/health', (req, res) => {
  res.status(200).json({ mensaje: 'API de Viper funcionando correctamente' })
})

// Rutas de los módulos: cada módulo nuevo agrega su línea acá
// (por ejemplo app.use('/api/auth', rutasAutenticacion))
app.use('/api/ejemplo', rutasEjemplo)

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada' })
})

// Errores que no capturó ningún controller (por ejemplo, un JSON mal formado)
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ mensaje: 'El cuerpo del pedido no es un JSON válido' })
  }
  console.error(err)
  res.status(500).json({ mensaje: 'Error interno del servidor' })
})

export default app