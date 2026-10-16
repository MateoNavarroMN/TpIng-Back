import { Router } from 'express'
import { autenticar, autorizar } from '../../middlewares/autenticacion.middleware.js'
import { cambiarRol } from './controlador.rol.usuarios.js'

const router = Router()

// Se monta en /api/usuarios (ver app.js): PATCH /api/usuarios/:id/rol, solo ADMINISTRADOR
router.patch('/:id/rol', autenticar, autorizar('ADMINISTRADOR'), cambiarRol)

export default router