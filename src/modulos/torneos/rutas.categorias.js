import { Router } from 'express'
import { autenticar } from '../../middlewares/autenticacion.middleware.js'
import { listar } from './controlador.categorias.js'

const router = Router()

router.get('/', autenticar, listar)

export default router