import { Router } from 'express'
import { autenticar, autorizar } from '../../middlewares/autenticacion.middleware.js'
import { crearPersonal } from './controlador.usuarios.js'

const router = Router()

// Todo este módulo es solo para el Administrador
router.use(autenticar, autorizar('ADMINISTRADOR'))

router.post('/personal', crearPersonal)

export default router