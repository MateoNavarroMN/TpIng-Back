import { Router } from 'express'
import { autenticar } from '../../middlewares/autenticacion.middleware.js'
import { cambiarPasswordPropia } from './controlador.password.js'

const router = Router()

// Se monta en /api/perfil/password (ver app.js), así que la ruta es PATCH /api/perfil/password
router.patch('/', autenticar, cambiarPasswordPropia)

export default router