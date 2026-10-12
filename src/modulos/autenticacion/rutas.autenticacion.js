import { Router } from 'express'
import { registrarJugador } from './controlador.autenticacion.js'

const router = Router()

router.post('/registro', registrarJugador)

export default router