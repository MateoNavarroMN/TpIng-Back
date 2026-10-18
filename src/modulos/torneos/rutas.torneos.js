import { Router } from 'express'
import { autenticar, autorizar } from '../../middlewares/autenticacion.middleware.js'
import { crear, editar, listar, obtener } from './controlador.torneos.js'

const router = Router()

router.use(autenticar)

router.get('/', listar)
router.get('/:id', obtener)
// El Administrador también pasa: incluye los permisos del Organizador (RF-02)
router.post('/', autorizar('ORGANIZADOR'), crear)
router.put('/:id', autorizar('ORGANIZADOR'), editar)

export default router