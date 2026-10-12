import express from 'express'
import cors from 'cors'
import { pool } from './config/conexion.bd.js'
import rutasEjemplo from './modulos/ejemplo/rutas.ejemplo.js'

const app = express()

// CORS
const origenes = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origen) => origen.trim())
  : '*'

// Middlewares
app.use(cors({ origin: origenes }))
app.use(express.json())

// Ruta de salud: además de responder, comprueba que la base de datos contesta
app.get('/health', async (req, res) => {
  try {
    await pool.query('select 1')
    res.status(200).json({ mensaje: 'API de Viper funcionando correctamente' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ mensaje: 'No se pudo conectar con la base de datos' })
  }
})

// Rutas de los módulos
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