import { pool } from '../src/config/conexion.bd.js'
import { crearJugadorCompleto, crearUsuario } from '../src/modulos/usuarios/modelo.usuarios.js'
import { encriptarPassword } from '../src/modulos/autenticacion/seguridad.autenticacion.js'

// Prueba manual de GET y PATCH /api/perfil (M1-BE-07). La API tiene que estar corriendo.
// Uso: node --env-file=.env scripts/probar-perfil.js   (opcional: API_URL=http://localhost:3000)
const API = process.env.API_URL ?? 'http://localhost:3000'
const CLAVE = 'clave1234'
const JUGADOR = 'perfil.jugador@test.com'
const STAFF = 'perfil.staff@test.com'

const ok = (condicion, mensaje) => {
  console.log(`${condicion ? 'OK   ' : 'FALLÓ'} ${mensaje}`)
  if (!condicion) process.exitCode = 1
}
const limpiar = () => pool.query('delete from usuario where email = any($1)', [[JUGADOR, STAFF]])

const llamar = async (metodo, token, cuerpo, ruta = '/perfil') => {
  const respuesta = await fetch(`${API}/api${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  return { status: respuesta.status, datos: await respuesta.json().catch(() => null) }
}
const login = async (email) => (await llamar('POST', null, { email, password: CLAVE }, '/auth/login')).datos.token
const fila = async (email) => (await pool.query(
  'select u.email, u.nombre, u.apellido, u.telefono, u.rol, u.estado, j.dni from usuario u left join jugador j on j.usuario_id = u.id where u.email = $1', [email])).rows[0]

try {
  await limpiar()
  const hash = await encriptarPassword(CLAVE)
  await crearJugadorCompleto({ email: JUGADOR, passwordHash: hash, nombre: 'Ana', apellido: 'Pérez', telefono: '351 111 2222', dni: '30999888' })
  await crearUsuario({ email: STAFF, passwordHash: hash, nombre: 'Rita', apellido: 'Staff', rol: 'RECEPCIONISTA' })
  const tokenJ = await login(JUGADOR)
  const tokenS = await login(STAFF)

  // GET
  let r = await llamar('GET')
  ok(r.status === 401, 'GET sin token → 401')
  r = await llamar('GET', tokenJ)
  ok(r.status === 200 && r.datos.usuario?.email === JUGADOR && r.datos.usuario?.rol === 'JUGADOR', 'GET jugador → 200 con correo y rol')
  ok(r.datos.usuario?.nombre === 'Ana' && r.datos.usuario?.apellido === 'Pérez' && r.datos.usuario?.telefono === '351 111 2222', 'GET trae nombre, apellido y teléfono')
  ok(r.datos.usuario?.dni === '30999888' && !('password_hash' in r.datos.usuario), 'GET jugador incluye el DNI y nunca el hash')
  r = await llamar('GET', tokenS)
  ok(r.status === 200 && r.datos.usuario?.rol === 'RECEPCIONISTA' && r.datos.usuario?.dni === null, 'GET personal → 200 y dni null (no es jugador)')

  // PATCH correcto
  r = await llamar('PATCH', tokenJ, { nombre: '  Anabel ', apellido: 'Gómez', telefono: '351 333 4444' })
  ok(r.status === 200 && r.datos.usuario?.nombre === 'Anabel' && r.datos.usuario?.apellido === 'Gómez' && r.datos.usuario?.telefono === '351 333 4444', 'PATCH → 200 con el perfil actualizado (y sin espacios sobrantes)')
  ok((await fila(JUGADOR)).nombre === 'Anabel', 'el cambio quedó guardado en la base')

  // Campos que no se pueden modificar
  r = await llamar('PATCH', tokenJ, { nombre: 'Anabel', email: 'hack@test.com', dni: '11111111', rol: 'ADMINISTRADOR', estado: 'BLOQUEADO' })
  const f = await fila(JUGADOR)
  ok(r.status === 200 && f.email === JUGADOR && f.dni === '30999888' && f.rol === 'JUGADOR' && f.estado === 'ACTIVO', 'email, dni, rol y estado en el PATCH se ignoran')

  // Cambios parciales
  r = await llamar('PATCH', tokenJ, { apellido: 'López' })
  const p = await fila(JUGADOR)
  ok(r.status === 200 && p.apellido === 'López' && p.nombre === 'Anabel' && p.telefono === '351 333 4444', 'enviar solo el apellido conserva el resto')
  r = await llamar('PATCH', tokenJ, { telefono: '' })
  ok(r.status === 200 && (await fila(JUGADOR)).telefono === null, 'teléfono vacío lo borra (null)')
  r = await llamar('PATCH', tokenS, { telefono: '+54 9 351 555-0000' })
  ok(r.status === 200 && r.datos.usuario?.telefono === '+54 9 351 555-0000', 'el personal también edita su perfil')

  // 6a: datos inválidos
  for (const [cuerpo, campo] of [
    [{ nombre: '   ' }, 'nombre'], [{ nombre: '' }, 'nombre'], [{ nombre: 123 }, 'nombre'], [{ nombre: 'x'.repeat(61) }, 'nombre'],
    [{ apellido: ' ' }, 'apellido'], [{ telefono: 'abc' }, 'telefono'], [{ telefono: 12345678 }, 'telefono'],
  ]) {
    r = await llamar('PATCH', tokenJ, cuerpo)
    ok(r.status === 400 && r.datos.mensaje.startsWith('Datos inválidos') && r.datos.campo === campo, `6a · ${JSON.stringify(cuerpo).slice(0, 30)} → 400 con campo "${campo}"`)
  }
  r = await llamar('PATCH', tokenJ, {})
  ok(r.status === 400 && r.datos.mensaje.startsWith('Datos inválidos'), 'PATCH sin ningún dato → 400')
  r = await llamar('PATCH', tokenJ, { email: 'solo@test.com' })
  ok(r.status === 400, 'PATCH que solo trae campos no editables → 400')
  const despues = await fila(JUGADOR)
  ok(despues.nombre === 'Anabel' && despues.apellido === 'López', 'los pedidos rechazados no cambiaron nada')

  r = await llamar('PATCH', null, { nombre: 'X' })
  ok(r.status === 401, 'PATCH sin token → 401')
} catch (error) {
  console.error('Error:', error.message)
  process.exitCode = 1
} finally {
  await limpiar()
  await pool.end()
}