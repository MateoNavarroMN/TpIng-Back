// Máquina de estados del torneo (Anexo B). Es la única tabla de transiciones del módulo:
// cualquier cambio de estado se valida contra ella.
//
//   PLANIFICADO → INSCRIPCIONES_ABIERTAS → INSCRIPCIONES_CERRADAS → EN_CURSO → FINALIZADO → ARCHIVADO
//   CANCELADO desde cualquiera de los cuatro primeros.
//   EN_CURSO → INSCRIPCIONES_CERRADAS solo al regenerar el cuadro (CU 3.4 · 6a).
export const TRANSICIONES = {
  PLANIFICADO: ['INSCRIPCIONES_ABIERTAS', 'CANCELADO'],
  INSCRIPCIONES_ABIERTAS: ['INSCRIPCIONES_CERRADAS', 'CANCELADO'],
  INSCRIPCIONES_CERRADAS: ['EN_CURSO', 'CANCELADO'],
  EN_CURSO: ['FINALIZADO', 'CANCELADO', 'INSCRIPCIONES_CERRADAS'],
  FINALIZADO: ['ARCHIVADO'],
  CANCELADO: [],
  ARCHIVADO: [],
}

export const puedeTransicionar = (desde, hacia) => (TRANSICIONES[desde] ?? []).includes(hacia)