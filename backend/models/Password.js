import { getDatabasePool } from '../config/database.js'
import bcrypt from 'bcryptjs'

// Helper to get pool safely
const getPool = async () => {
  return await getDatabasePool()
}

const Password = {
  // Get password (only one should exist)
  async getPassword() {
    try {
      const pool = await getPool()
      const result = await pool.query('SELECT * FROM passwords ORDER BY id LIMIT 1')
      let password = result.rows[0]
      
      if (!password) {
        // Create default password hash for "admin"
        const defaultHash = bcrypt.hashSync('admin', 10)
        const insertResult = await pool.query(
          'INSERT INTO passwords (hash) VALUES ($1) RETURNING *',
          [defaultHash]
        )
        password = insertResult.rows[0]
      }
      
      return password
    } catch (error) {
      console.error('Error getting password:', error)
      throw error
    }
  },

  // Update password
  async updatePassword(newHash) {
    try {
      const pool = await getPool()
      const result = await pool.query('SELECT * FROM passwords ORDER BY id LIMIT 1')
      let password = result.rows[0]
      
      if (password) {
        const updateResult = await pool.query(
          'UPDATE passwords SET hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
          [newHash, password.id]
        )
        password = updateResult.rows[0]
      } else {
        const insertResult = await pool.query(
          'INSERT INTO passwords (hash) VALUES ($1) RETURNING *',
          [newHash]
        )
        password = insertResult.rows[0]
      }
      
      return password
    } catch (error) {
      console.error('Error updating password:', error)
      throw error
    }
  }
}

export default Password

