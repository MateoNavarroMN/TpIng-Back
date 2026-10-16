import { Router } from 'express'
import { autenticar, autorizar } from '../../middlewares/autenticacion.middleware.js'
import { modificarContacto } from './controlador.contacto.usuarios.js'

const router = Router()

// Se monta en /api/usuarios: PATCH /api/usuarios/:id/contacto, solo ADMINISTRADOR
router.patch('/:id/contacto', autenticar, autorizar('ADMINISTRADOR'), modificarContacto)

export default router