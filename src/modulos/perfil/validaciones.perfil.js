import { validarNombre } from '../autenticacion/validaciones.autenticacion.js'

//entre 6 y 20 caracteres entre dígitos y espacios.
const REGEX_TELEFONO = /^[0-9+()\- ]{6,20}$/

const esTexto = (valor) => typeof valor === 'string'

// Valida los datos que llegan en PATCH /perfil. Solo se revisan los campos que vienen en el pedido.
export const validarCambiosPerfil = ({ nombre, apellido, telefono }) => {
  if (nombre !== undefined) {
    const detalle = validarNombre(nombre, 'El nombre')
    if (detalle) return { campo: 'nombre', detalle }
  }
  if (apellido !== undefined) {
    const detalle = validarNombre(apellido, 'El apellido')
    if (detalle) return { campo: 'apellido', detalle }
  }
  if (telefono !== undefined && telefono !== null && telefono !== '') {
    if (!esTexto(telefono) || !REGEX_TELEFONO.test(telefono.trim())) {
      return { campo: 'telefono', detalle: 'El teléfono no tiene un formato válido' }
    }
  }
  return null
}