import { Router } from 'express'
import { autenticar, autorizar } from '../../middlewares/autenticacion.middleware.js'
import { activar, bloquear } from './controlador.estado.usuarios.js'

const router = Router()

// Se montan en /api/usuarios (ver app.js): solo ADMINISTRADOR
router.post('/:id/bloquear', autenticar, autorizar('ADMINISTRADOR'), bloquear)
router.post('/:id/activar', autenticar, autorizar('ADMINISTRADOR'), activar)

export default router