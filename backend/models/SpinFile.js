import { getDatabasePool } from '../config/database.js'

// Helper to get pool safely (ensures connection)
const getPool = async () => {
  return await getDatabasePool()
}

const SpinFile = {
  // Find all spin files
  async find(query = {}) {
    try {
      const pool = await getPool()
      let sql = 'SELECT * FROM spinfiles WHERE 1=1'
      const params = []
      
      if (query.active !== undefined) {
        sql += ' AND active = $' + (params.length + 1)
        params.push(query.active !== false)
      }
      
      sql += ' ORDER BY created_at DESC'
      
      const result = await pool.query(sql, params)
      return result.rows
    } catch (error) {
      console.error('Error finding spin files:', error)
      throw error
    }
  },

  // Find by ID
  async findById(id) {
    try {
      const pool = await getPool()
      const result = await pool.query('SELECT * FROM spinfiles WHERE id = $1', [id])
      return result.rows[0] || null
    } catch (error) {
      console.error('Error finding spin file by ID:', error)
      throw error
    }
  },

  // Create new spin file
  async create(data) {
    try {
      const pool = await getPool()
      const { filename, json_content, picture, ticketNumber, active, fixedWinnerTicket } = data
      const result = await pool.query(
        `INSERT INTO spinfiles (filename, json_content, picture, ticket_number, active, fixed_winner_ticket)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          filename.trim(),
          JSON.stringify(json_content || []),
          picture || null,
          ticketNumber?.trim() || '',
          active !== false,
          fixedWinnerTicket || null
        ]
      )
      return result.rows[0]
    } catch (error) {
      console.error('Error creating spin file:', error)
      throw error
    }
  },

  // Update spin file
  async findByIdAndUpdate(id, update) {
    try {
      const pool = await getPool()
      const updates = []
      const values = []
      let paramCount = 1

      if (update.active !== undefined) {
        updates.push(`active = $${paramCount++}`)
        values.push(update.active !== false)
      }
      if (update.fixedWinnerTicket !== undefined) {
        updates.push(`fixed_winner_ticket = $${paramCount++}`)
        values.push(update.fixedWinnerTicket || null)
      }

      if (updates.length === 0) {
        return await this.findById(id)
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`)
      values.push(id)

      const result = await pool.query(
        `UPDATE spinfiles SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('Error updating spin file:', error)
      throw error
    }
  },

  // Delete spin file
  async findByIdAndDelete(id) {
    try {
      const pool = await getPool()
      const result = await pool.query('DELETE FROM spinfiles WHERE id = $1 RETURNING *', [id])
      return result.rows[0] || null
    } catch (error) {
      console.error('Error deleting spin file:', error)
      throw error
    }
  },

  // Select specific fields
  async select(fields, query = {}) {
    try {
      const pool = await getPool()
      let sql = `SELECT ${fields.join(', ')} FROM spinfiles WHERE 1=1`
      const params = []
      
      if (query.active !== undefined) {
        sql += ' AND active = $' + (params.length + 1)
        params.push(query.active !== false)
      }
      
      sql += ' ORDER BY created_at DESC'
      
      const result = await pool.query(sql, params)
      return result.rows
    } catch (error) {
      console.error('Error selecting spin files:', error)
      throw error
    }
  }
}

export default SpinFile

