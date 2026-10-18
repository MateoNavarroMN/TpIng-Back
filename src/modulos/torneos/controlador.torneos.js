import { buscarCategoriaPorId } from './modelo.categorias.js'
import { buscarTorneoPorId, crearTorneo, editarTorneoPlanificado, listarTorneos } from './modelo.torneos.js'
import { VISTAS, accionesPermitidas, estadosVisibles } from './acciones.torneos.js'

const DISCIPLINAS = ['TENIS', 'PADEL']
const FORMATOS = ['ELIMINACION_DIRECTA', 'ZONAS_Y_ELIMINACION']
const LARGO_MAXIMO_NOMBRE = 100
const CUPO_MAXIMO = 128
const PRECIO_MAXIMO = 9999999999
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Fecha 'AAAA-MM-DD' que exista en el calendario (rechaza '2026-02-30')
const esFecha = (valor) => {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const fecha = new Date(`${valor}T00:00:00Z`)
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor
}

const esEntero = (valor, minimo, maximo) => Number.isInteger(valor) && valor >= minimo && valor <= maximo

// Valida el cuerpo de POST y PUT (CU 3.1 · paso 6). Devuelve { campo } del primer error, o { datos } listos para el modelo.
const validarTorneo = async (body) => {
  const { nombre, disciplina, categoriaId, formato, clasificanPorZona, cupoMaximo, fechaInicio, fechaFin, precioInscripcion } = body ?? {}

  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > LARGO_MAXIMO_NOMBRE) return { campo: 'nombre' }
  if (!DISCIPLINAS.includes(disciplina)) return { campo: 'disciplina' }
  if (typeof categoriaId !== 'string' || !REGEX_UUID.test(categoriaId)) return { campo: 'categoriaId' }
  if (!FORMATOS.includes(formato)) return { campo: 'formato' }

  const conZonas = formato === 'ZONAS_Y_ELIMINACION'
  // Con zonas de 3 jugadores clasifican 1 o 2 por zona (si clasificaran los 3 la zona no tendría sentido)
  if (conZonas && !esEntero(clasificanPorZona, 1, 2)) return { campo: 'clasificanPorZona' }
  // Con zonas el cupo tiene que alcanzar para al menos dos zonas de 3
  if (!esEntero(cupoMaximo, conZonas ? 6 : 2, CUPO_MAXIMO)) return { campo: 'cupoMaximo' }

  if (!esFecha(fechaInicio)) return { campo: 'fechaInicio' }
  if (!esFecha(fechaFin) || fechaFin < fechaInicio) return { campo: 'fechaFin' }

  if (typeof precioInscripcion !== 'number' || !Number.isFinite(precioInscripcion) || precioInscripcion < 0
    || precioInscripcion > PRECIO_MAXIMO || Math.round(precioInscripcion * 100) !== precioInscripcion * 100) {
    return { campo: 'precioInscripcion' }
  }

  // La categoría tiene que existir y ser de la misma disciplina que el torneo
  const categoria = await buscarCategoriaPorId(categoriaId)
  if (!categoria || categoria.disciplina !== disciplina) return { campo: 'categoriaId' }

  return {
    datos: {
      nombre: nombre.trim(),
      disciplina,
      categoriaId,
      formato,
      clasificanPorZona: conZonas ? clasificanPorZona : null,
      cupoMaximo,
      fechaInicio,
      fechaFin,
      precioInscripcion,
    },
  }
}

const datosInvalidos = (res, campo) => res.status(400).json({ mensaje: 'Datos inválidos', campo })
const conAcciones = (torneo, rol) => ({ ...torneo, accionesPermitidas: accionesPermitidas(torneo, rol) })

// GET /api/torneos?estado=&disciplina=&vista=activos|historicos  (CU 3.1 y 3.2, cualquier usuario autenticado)
export const listar = async (req, res) => {
  const { estado, disciplina, vista } = req.query
  const visibles = estadosVisibles(req.usuario.rol)

  if (vista !== undefined && !VISTAS[vista]) return res.status(400).json({ mensaje: 'Parámetro inválido: la vista no existe', campo: 'vista' })
  if (estado !== undefined && !visibles.includes(estado)) {
    return res.status(400).json({ mensaje: 'Parámetro inválido: el estado no existe', campo: 'estado' })
  }
  if (disciplina !== undefined && !DISCIPLINAS.includes(disciplina)) {
    return res.status(400).json({ mensaje: 'Parámetro inválido: la disciplina no existe', campo: 'disciplina' })
  }

  // Se cruzan los tres filtros: lo que el rol puede ver, la pestaña y el estado pedido
  const estados = visibles.filter((e) => (!vista || VISTAS[vista].includes(e)) && (!estado || e === estado))

  try {
    const torneos = estados.length > 0 ? await listarTorneos({ estados, disciplina: disciplina ?? null }) : []
    return res.status(200).json({ torneos: torneos.map((t) => conAcciones(t, req.usuario.rol)) })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ mensaje: 'No se pudo obtener el listado de torneos' })
  }
}

// GET /api/torneos/:id  (CU 3.1 y 3.2, cualquier usuario autenticado)
export const obtener = async (req, res) => {
  const { id } = req.params
  if (!REGEX_UUID.test(id)) return res.status(404).json({ mensaje: 'Torneo no encontrado' })

  try {
    const torneo = await buscarTorneoPorId(id)
    // Un torneo que el rol no puede ver responde igual que uno que no existe
    if (!torneo || !estadosVisibles(req.usuario.rol).includes(torneo.estado)) {
      return res.status(404).json({ mensaje: 'Torneo no encontrado' })
    }
    return res.status(200).json({ torneo: conAcciones(torneo, req.usuario.rol) })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ mensaje: 'No se pudo obtener el torneo' })
  }
}

// POST /api/torneos  (CU 3.1 · pasos 4 a 7, Organizador o Administrador)
export const crear = async (req, res) => {
  try {
    const { campo, datos } = await validarTorneo(req.body)
    if (campo) return datosInvalidos(res, campo)

    const torneo = await crearTorneo(datos)
    return res.status(201).json({ mensaje: 'Torneo creado correctamente', torneo: conAcciones(torneo, req.usuario.rol) })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ mensaje: 'No se pudo crear el torneo' })
  }
}

// PUT /api/torneos/:id  (CU 3.1 · A1, Organizador o Administrador). Solo mientras está PLANIFICADO.
export const editar = async (req, res) => {
  const { id } = req.params
  if (!REGEX_UUID.test(id)) return res.status(404).json({ mensaje: 'Torneo no encontrado' })

  try {
    const { campo, datos } = await validarTorneo(req.body)
    if (campo) return datosInvalidos(res, campo)

    const { resultado, torneo } = await editarTorneoPlanificado(id, datos)
    if (resultado === 'NO_ENCONTRADO') return res.status(404).json({ mensaje: 'Torneo no encontrado' })
    if (resultado === 'NO_EDITABLE') {
      return res.status(409).json({ mensaje: 'El torneo ya no se puede editar', estado: torneo.estado })
    }

    return res.status(200).json({ mensaje: 'Torneo actualizado correctamente', torneo: conAcciones(torneo, req.usuario.rol) })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ mensaje: 'No se pudo actualizar el torneo' })
  }
}