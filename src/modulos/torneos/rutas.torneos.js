import { Router } from 'express'
import { autenticar, autorizar } from '../../middlewares/autenticacion.middleware.js'
import { crear, editar, listar, obtener } from './controlador.torneos.js'
import { abrir, cancelar, cerrar, previewCierre } from './controlador.estados.torneos.js'

const router = Router()

router.use(autenticar)

router.get('/', listar)
router.get('/:id', obtener)
// El Administrador también pasa: incluye los permisos del Organizador (RF-02)
router.post('/', autorizar('ORGANIZADOR'), crear)
router.put('/:id', autorizar('ORGANIZADOR'), editar)

// Cambios de estado (CU 3.1 · A2, A3 y A4)
router.post('/:id/abrir-inscripciones', autorizar('ORGANIZADOR'), abrir)
router.get('/:id/cerrar-inscripciones/preview', autorizar('ORGANIZADOR'), previewCierre)
router.post('/:id/cerrar-inscripciones', autorizar('ORGANIZADOR'), cerrar)
router.post('/:id/cancelar', autorizar('ORGANIZADOR'), cancelar)

export default router