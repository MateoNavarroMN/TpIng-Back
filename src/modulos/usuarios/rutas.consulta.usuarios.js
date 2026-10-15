import { Router } from 'express'
import { autenticar, autorizar } from '../../middlewares/autenticacion.middleware.js'
import { listar, obtener } from './controlador.consulta.usuarios.js'

const router = Router()

// Se monta en /api/usuarios (ver app.js). Solo para el Administrador.
router.get('/', autenticar, autorizar('ADMINISTRADOR'), listar)
router.get('/:id', autenticar, autorizar('ADMINISTRADOR'), obtener)

export default router