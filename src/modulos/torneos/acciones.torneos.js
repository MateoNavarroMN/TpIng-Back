import { puedeTransicionar } from './estados.torneos.js'

// Reglas de visibilidad y acciones de los torneos según estado y rol (CU 3.1, Anexo B y Anexo C).
// Están juntas acá para que el listado, el detalle y las tareas siguientes usen las mismas.

export const ESTADOS = [
  'PLANIFICADO', 'INSCRIPCIONES_ABIERTAS', 'INSCRIPCIONES_CERRADAS',
  'EN_CURSO', 'FINALIZADO', 'CANCELADO', 'ARCHIVADO',
]

// Pestañas del listado: los activos todavía se están jugando o por jugar; los históricos ya terminaron.
export const VISTAS = {
  activos: ['PLANIFICADO', 'INSCRIPCIONES_ABIERTAS', 'INSCRIPCIONES_CERRADAS', 'EN_CURSO'],
  historicos: ['FINALIZADO', 'CANCELADO', 'ARCHIVADO'],
}

// Organizador y Administrador gestionan torneos (el Administrador incluye los permisos del Organizador, RF-02).
export const gestionaTorneos = (rol) => rol === 'ORGANIZADOR' || rol === 'ADMINISTRADOR'

// Un torneo PLANIFICADO todavía se está armando: solo lo ven quienes gestionan torneos.
export const estadosVisibles = (rol) => (gestionaTorneos(rol) ? ESTADOS : ESTADOS.filter((e) => e !== 'PLANIFICADO'))

// Acciones que la pantalla puede mostrar para este torneo y este rol (simplifica el front).
// Las tareas siguientes (cuadro, resultados, archivo) agregan las suyas acá.
export const accionesPermitidas = (torneo, rol) => {
  const acciones = []
  const { estado } = torneo

  if (gestionaTorneos(rol)) {
    if (estado === 'PLANIFICADO') acciones.push('EDITAR')
    // Abrir y cancelar salen de la misma tabla que valida el backend (estados.torneos.js).
    // Cerrar se pide aparte porque EN_CURSO → INSCRIPCIONES_CERRADAS es la regeneración del cuadro, no un cierre.
    if (puedeTransicionar(estado, 'INSCRIPCIONES_ABIERTAS')) acciones.push('ABRIR_INSCRIPCIONES')
    if (estado === 'INSCRIPCIONES_ABIERTAS') acciones.push('CERRAR_INSCRIPCIONES')
    if (puedeTransicionar(estado, 'CANCELADO')) acciones.push('CANCELAR')
  }
  if (rol === 'ADMINISTRADOR' && estado === 'FINALIZADO') acciones.push('ARCHIVAR')

  // Inscriptos: los ven Recepcionista, Organizador y Administrador desde que se abren las inscripciones.
  if (rol !== 'JUGADOR' && estado !== 'PLANIFICADO') acciones.push('VER_INSCRIPTOS')

  if (rol === 'JUGADOR' && estado === 'INSCRIPCIONES_ABIERTAS' && torneo.cupoDisponible > 0) acciones.push('INSCRIBIRSE')

  return acciones
}