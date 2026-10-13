import { Router } from 'express'
import { autenticar } from '../../middlewares/autenticacion.middleware.js'
import { iniciarSesion, obtenerUsuarioActual, registrarJugador } from './controlador.autenticacion.js'

const router = Router()

router.post('/registro', registrarJugador)
router.post('/login', iniciarSesion)
router.get('/me', autenticar, obtenerUsuarioActual)

export default router