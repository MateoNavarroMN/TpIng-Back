import { Router } from 'express'
import { iniciarSesion, registrarJugador } from './controlador.autenticacion.js'

const router = Router()

router.post('/registro', registrarJugador)
router.post('/login', iniciarSesion)

export default router