import pg from 'pg'

// Pool de conexiones a Postgres (Supabase).
export const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
})

// Si una conexión inactiva del pool falla, se registra el error en vez de tirar la API.
pool.on('error', (error) => {
    console.error('Error en una conexión inactiva de la base de datos:', error.message)
})