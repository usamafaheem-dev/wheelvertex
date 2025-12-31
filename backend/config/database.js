import pkg from 'pg'
const { Pool } = pkg

let pool = null
let isConnecting = false
let connectionPromise = null
let lastConnectionAttempt = 0
const CONNECTION_RETRY_DELAY = 1000 // 1 second
const MAX_RETRIES = 3

// Get or create database pool with retry logic
const getPool = async (retryCount = 0) => {
  // If pool exists and is connected, return it
  if (pool) {
    try {
      // Quick health check
      const client = await pool.connect()
      client.release()
      return pool
    } catch (error) {
      // Pool exists but connection is bad, reset it
      console.warn('Pool connection check failed, resetting pool:', error.message)
      pool = null
    }
  }

  // If connection is in progress, wait for it
  if (isConnecting && connectionPromise) {
    try {
      return await connectionPromise
    } catch (error) {
      // If connection failed, retry if we haven't exceeded max retries
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, CONNECTION_RETRY_DELAY * (retryCount + 1)))
        return getPool(retryCount + 1)
      }
      throw error
    }
  }

  // Start new connection
  isConnecting = true
  connectionPromise = (async () => {
    try {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL environment variable is not set')
      }

      // Prevent too frequent connection attempts
      const now = Date.now()
      if (lastConnectionAttempt > 0 && (now - lastConnectionAttempt) < CONNECTION_RETRY_DELAY) {
        await new Promise(resolve => setTimeout(resolve, CONNECTION_RETRY_DELAY))
      }
      lastConnectionAttempt = now

      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        },
        // Optimized for serverless/Vercel
        max: 1, // Single connection for serverless (free tier)
        min: 0, // No minimum (allows pool to close when idle)
        idleTimeoutMillis: 30000, // Close idle connections after 30s
        connectionTimeoutMillis: 10000, // 10 second connection timeout
        // For free-tier databases with cold starts
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000
      })

      // Test the connection with timeout
      const connectPromise = pool.connect()
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      )
      
      const client = await Promise.race([connectPromise, timeoutPromise])
      console.log(`✅ PostgreSQL Connected successfully`)
      client.release()

      // Initialize database tables (with error handling)
      try {
        await initializeTables()
      } catch (initError) {
        console.warn('Table initialization warning (non-fatal):', initError.message)
        // Don't fail connection if tables already exist
      }
      
      isConnecting = false
      return pool
    } catch (error) {
      isConnecting = false
      pool = null
      connectionPromise = null
      console.error('❌ PostgreSQL connection error:', error.message)
      
      // Retry logic for transient errors
      if (retryCount < MAX_RETRIES && (
        error.message.includes('timeout') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      )) {
        console.log(`Retrying connection (attempt ${retryCount + 1}/${MAX_RETRIES})...`)
        await new Promise(resolve => setTimeout(resolve, CONNECTION_RETRY_DELAY * (retryCount + 1)))
        return getPool(retryCount + 1)
      }
      
      throw error
    }
  })()

  return connectionPromise
}

// Legacy function for backward compatibility
const connectDB = async () => {
  return await getPool()
}

const initializeTables = async () => {
  try {
    // Ensure pool is available before using it
    const currentPool = pool || await getPool()
    
    // Create spinfiles table
    await currentPool.query(`
      CREATE TABLE IF NOT EXISTS spinfiles (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        json_content JSONB NOT NULL DEFAULT '[]'::jsonb,
        picture TEXT,
        ticket_number VARCHAR(255) DEFAULT '',
        active BOOLEAN DEFAULT true,
        fixed_winner_ticket VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create passwords table
    await currentPool.query(`
      CREATE TABLE IF NOT EXISTS passwords (
        id SERIAL PRIMARY KEY,
        hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create index on spinfiles for better performance
    await currentPool.query(`
      CREATE INDEX IF NOT EXISTS idx_spinfiles_active ON spinfiles(active)
    `)

    console.log('✅ Database tables initialized')
  } catch (error) {
    console.error('❌ Error initializing tables:', error.message)
    throw error
  }
}

// Export pool getter function (safer for serverless)
export const getDatabasePool = getPool

// Export pool variable (for models - will be set after connection)
export { pool }

export default connectDB

