import { Router } from 'express'
import { autenticar } from '../../middlewares/autenticacion.middleware.js'
import { editarPerfil, obtenerPerfil } from './controlador.perfil.js'

const router = Router()

// Todo el módulo es para usuarios con sesión (cualquier rol)
router.use(autenticar)

router.get('/', obtenerPerfil)
router.patch('/', editarPerfil)

export default router