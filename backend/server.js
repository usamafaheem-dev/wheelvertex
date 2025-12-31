import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import xlsx from 'xlsx'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import connectDB from './config/database.js'
import SpinFile from './models/SpinFile.js'
import Password from './models/Password.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Process-level error handlers (prevent function crashes)
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  // Don't exit - let Vercel handle it
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  // Don't exit - let Vercel handle it
})

// Database connection is now handled lazily by models
// Connection happens on first request with automatic retries
// This is optimal for Vercel serverless functions with free-tier databases

// Middleware - CORS configuration
app.use(cors({
  origin: '*', // Allow all origins (you can restrict this to specific domains)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false
}))

// Handle preflight requests
app.options('*', cors())

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Database connection middleware (optional - models handle connection themselves)
// This provides early connection for better performance
app.use(async (req, res, next) => {
  // Skip connection check for health and root endpoints (faster response)
  if (req.path === '/api/health' || req.path === '/' || req.path === '/api') {
    return next()
  }
  
  try {
    const { getDatabasePool } = await import('./config/database.js')
    await getDatabasePool() // Ensure connection is ready
    next()
  } catch (error) {
    console.error('Database connection error in middleware:', error.message)
    // Don't block - let the route handler deal with it
    // Models will retry connection automatically
    next()
  }
})

// Configure multer for file uploads
// Use memory storage for Vercel compatibility (serverless functions)
const storage = multer.memoryStorage()

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
})

// Parse Excel file from buffer (for Vercel/serverless)
const parseExcelFile = (buffer) => {
  try {
    const workbook = xlsx.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = xlsx.utils.sheet_to_json(worksheet)
    return data
  } catch (error) {
    console.error('Error parsing Excel file:', error)
    throw new Error('Failed to parse Excel file: ' + error.message)
  }
}

// Convert image buffer to base64
const imageToBase64 = (buffer, mimetype) => {
  try {
    const base64 = buffer.toString('base64')
    return `data:${mimetype || 'image/png'};base64,${base64}`
  } catch (error) {
    console.error('Error converting image to base64:', error)
    return null
  }
}

// Helper function to convert PostgreSQL row to API format
const formatSpinFile = (row) => {
  // Parse json_content if it's a string (JSONB from PostgreSQL)
  let jsonContent = row.json_content
  if (typeof jsonContent === 'string') {
    try {
      jsonContent = JSON.parse(jsonContent)
    } catch (e) {
      jsonContent = []
    }
  }
  
  return {
    id: row.id.toString(),
    filename: row.filename,
    json_content: jsonContent || [],
    picture: row.picture,
    ticketNumber: row.ticket_number || '',
    active: row.active !== false,
    fixedWinnerTicket: row.fixed_winner_ticket || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// API Routes

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Backend API Server', 
    status: 'running',
    database: 'PostgreSQL',
    endpoints: {
      health: '/api/health',
      spins: '/api/spins/*'
    }
  })
})

// API root route (handles "Cannot GET /api" error)
app.get('/api', (req, res) => {
  res.json({ 
    message: 'API Server', 
    status: 'running',
    database: 'PostgreSQL',
    endpoints: {
      health: '/api/health',
      spins: {
        list: '/api/spins/list/',
        adminList: '/api/spins/admin-list/',
        filenames: '/api/spins/filenames/',
        upload: 'POST /api/spins/upload/',
        spin: 'POST /api/spins/spin/:id/',
        delete: 'DELETE /api/spins/delete/:id/',
        toggleActive: 'PATCH /api/spins/toggle-active/:id/',
        setFixedWinner: 'POST /api/spins/set-fixed-winner/:id/'
      },
      auth: {
        checkPassword: 'POST /api/spins/check-password/',
        updatePassword: 'POST /api/spins/update-password/'
      }
    }
  })
})

// Health check
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const { getDatabasePool } = await import('./config/database.js')
    const pool = await getDatabasePool()
    const client = await pool.connect()
    client.release()
    
    res.json({ 
      status: 'ok', 
      message: 'Backend is running', 
      database: 'PostgreSQL',
      connected: true
    })
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      message: 'Backend is running but database connection failed', 
      database: 'PostgreSQL',
      connected: false,
      error: error.message
    })
  }
})

// Get list of active spin files (for users)
app.get('/api/spins/list/', async (req, res) => {
  try {
    const files = await SpinFile.find({ active: true })
    const formattedFiles = files.map(formatSpinFile)
    res.json(formattedFiles)
  } catch (error) {
    console.error('Error getting spin files:', error)
    // Check if it's a database connection error
    if (error.message && (error.message.includes('timeout') || error.message.includes('connection'))) {
      res.status(503).json({ 
        error: 'Database connection failed', 
        message: 'Please try again in a moment',
        retry: true
      })
    } else {
      res.status(500).json({ error: 'Failed to get spin files', message: error.message })
    }
  }
})

// Get admin list of all spin files
app.get('/api/spins/admin-list/', async (req, res) => {
  try {
    const files = await SpinFile.find()
    const formattedFiles = files.map(formatSpinFile)
    res.json(formattedFiles)
  } catch (error) {
    console.error('Error getting admin spin files:', error)
    if (error.message && (error.message.includes('timeout') || error.message.includes('connection'))) {
      res.status(503).json({ 
        error: 'Database connection failed', 
        message: 'Please try again in a moment',
        retry: true
      })
    } else {
      res.status(500).json({ error: 'Failed to get admin spin files', message: error.message })
    }
  }
})

// Get filenames only
app.get('/api/spins/filenames/', async (req, res) => {
  try {
    const files = await SpinFile.select(['id', 'filename'])
    const filenames = files.map(f => ({ id: f.id.toString(), filename: f.filename }))
    res.json(filenames)
  } catch (error) {
    console.error('Error getting filenames:', error)
    res.status(500).json({ error: 'Failed to get filenames' })
  }
})

// Upload a new spin file
app.post('/api/spins/upload/', upload.fields([
  { name: 'excel_file', maxCount: 1 },
  { name: 'picture', maxCount: 1 }
]), async (req, res) => {
  try {
    if (!req.files || !req.files.excel_file) {
      return res.status(400).json({ error: 'Excel file is required' })
    }

    const excelFile = req.files.excel_file[0]
    const pictureFile = req.files.picture ? req.files.picture[0] : null
    const filename = req.body.filename || excelFile.originalname.replace(/\.(xlsx|xls)$/i, '')
    const ticketNumber = req.body.ticket_number || ''

    // Parse Excel file from buffer (Vercel/serverless compatible)
    const jsonContent = parseExcelFile(excelFile.buffer)

    // Convert picture buffer to base64 if provided
    let pictureBase64 = null
    if (pictureFile && pictureFile.buffer) {
      pictureBase64 = imageToBase64(pictureFile.buffer, pictureFile.mimetype)
    }

    // Create file in PostgreSQL
    const spinFile = await SpinFile.create({
      filename: filename.trim(),
      json_content: jsonContent,
      picture: pictureBase64,
      ticketNumber: ticketNumber.trim(),
      active: true
    })

    res.json(formatSpinFile(spinFile))
  } catch (error) {
    console.error('Error uploading file:', error)
    res.status(500).json({ error: error.message || 'Failed to upload file' })
  }
})

// Spin the wheel and get winner
app.post('/api/spins/spin/:id/', async (req, res) => {
  try {
    const { id } = req.params
    const file = await SpinFile.findById(id)

    if (!file) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Parse json_content if it's a string (JSONB from PostgreSQL)
    let jsonContent = file.json_content
    if (typeof jsonContent === 'string') {
      try {
        jsonContent = JSON.parse(jsonContent)
      } catch (e) {
        jsonContent = []
      }
    }

    if (!jsonContent || !Array.isArray(jsonContent) || jsonContent.length === 0) {
      return res.status(400).json({ error: 'No entries available' })
    }

    // Check for fixed winner
    if (file.fixed_winner_ticket) {
      const fixedIndex = jsonContent.findIndex(entry => {
        const ticket = entry.ticket || entry.Ticket || entry.ticketNumber || entry.ticket_number
        return ticket && ticket.toString() === file.fixed_winner_ticket.toString()
      })
      if (fixedIndex !== -1) {
        return res.json({ winner: jsonContent[fixedIndex], index: fixedIndex })
      }
    }

    // Get random winner
    const randomIndex = Math.floor(Math.random() * jsonContent.length)
    const winner = jsonContent[randomIndex]

    res.json({ winner, index: randomIndex })
  } catch (error) {
    console.error('Error spinning wheel:', error)
    res.status(500).json({ error: 'Failed to spin wheel' })
  }
})

// Delete a spin file
app.delete('/api/spins/delete/:id/', async (req, res) => {
  try {
    const { id } = req.params
    const file = await SpinFile.findByIdAndDelete(id)

    if (!file) {
      return res.status(404).json({ error: 'File not found' })
    }

    res.json({ success: true, message: 'File deleted successfully' })
  } catch (error) {
    console.error('Error deleting file:', error)
    res.status(500).json({ error: 'Failed to delete file' })
  }
})

// Toggle active status of a spin file
app.patch('/api/spins/toggle-active/:id/', async (req, res) => {
  try {
    const { id } = req.params
    const file = await SpinFile.findById(id)

    if (!file) {
      return res.status(404).json({ error: 'File not found' })
    }

    const newActiveStatus = !(file.active !== false)
    const updatedFile = await SpinFile.findByIdAndUpdate(id, { active: newActiveStatus })

    res.json(formatSpinFile(updatedFile))
  } catch (error) {
    console.error('Error toggling active status:', error)
    res.status(500).json({ error: 'Failed to toggle active status' })
  }
})

// Check password for admin operations
app.post('/api/spins/check-password/', async (req, res) => {
  try {
    const { password } = req.body

    if (!password) {
      return res.status(400).json({ error: 'Password is required' })
    }

    const passwordDoc = await Password.getPassword()
    const isValid = bcrypt.compareSync(password, passwordDoc.hash)

    res.json({ valid: isValid })
  } catch (error) {
    console.error('Error checking password:', error)
    res.status(500).json({ error: 'Failed to check password' })
  }
})

// Update password
app.post('/api/spins/update-password/', async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old password and new password are required' })
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters long' })
    }

    // Verify old password
    const passwordDoc = await Password.getPassword()
    const isValid = bcrypt.compareSync(oldPassword, passwordDoc.hash)

    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }

    // Update password
    const newHash = bcrypt.hashSync(newPassword, 10)
    await Password.updatePassword(newHash)

    res.json({ success: true, message: 'Password updated successfully' })
  } catch (error) {
    console.error('Error updating password:', error)
    res.status(500).json({ error: 'Failed to update password' })
  }
})

// Set fixed winner for a spin file
app.post('/api/spins/set-fixed-winner/:id/', async (req, res) => {
  try {
    const { id } = req.params
    const { rigged_ticket } = req.body

    const file = await SpinFile.findById(id)

    if (!file) {
      return res.status(404).json({ error: 'File not found' })
    }

    await SpinFile.findByIdAndUpdate(id, { fixedWinnerTicket: rigged_ticket })

    res.json({ success: true, message: 'Fixed winner set' })
  } catch (error) {
    console.error('Error setting fixed winner:', error)
    res.status(500).json({ error: 'Failed to set fixed winner' })
  }
})

// Global error handler (prevents function crashes)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    status: 'error'
  })
})

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
    availableEndpoints: {
      root: '/',
      api: '/api',
      health: '/api/health',
      spins: '/api/spins/*'
    }
  })
})

// Export for Vercel serverless functions
export default app

// Start server only if not in Vercel environment
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`)
    console.log(`📦 Using PostgreSQL database`)
  })
}
