import { Router } from 'express'
import { crearEjemplo } from './controlador.ejemplo.js'

const router = Router()

router.post('/', crearEjemplo)

export default router