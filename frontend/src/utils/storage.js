/**
 * Storage utilities for managing files and data in localStorage/IndexedDB
 */

const STORAGE_KEYS = {
  FILES: 'spinWheelFiles',
  PASSWORD: 'adminPassword', // Default password hash
  CURRENT_FILE: 'currentSpinFile'
}

/**
 * Get all stored files from localStorage
 * @returns {Array} Array of file objects
 */
export const getStoredFiles = () => {
  try {
    const files = localStorage.getItem(STORAGE_KEYS.FILES)
    return files ? JSON.parse(files) : []
  } catch (e) {
    console.error('Failed to get stored files:', e)
    return []
  }
}

/**
 * Save a file to localStorage
 * @param {Object} fileData - File object with id, filename, json_content, picture, etc.
 * @returns {Object} Saved file object
 */
export const saveFile = (fileData) => {
  try {
    const files = getStoredFiles()
    
    // Generate ID if not provided
    if (!fileData.id) {
      fileData.id = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
    
    // Check if file with same filename exists
    const existingIndex = files.findIndex(f => f.filename === fileData.filename)
    
    if (existingIndex >= 0) {
      // Update existing file
      files[existingIndex] = { ...files[existingIndex], ...fileData }
    } else {
      // Add new file
      files.push(fileData)
    }
    
    localStorage.setItem(STORAGE_KEYS.FILES, JSON.stringify(files))
    return fileData
  } catch (e) {
    console.error('Failed to save file:', e)
    throw new Error('Failed to save file: ' + e.message)
  }
}

/**
 * Delete a file from localStorage
 * @param {string} fileId - File ID to delete
 * @returns {boolean} Success status
 */
export const deleteFile = (fileId) => {
  try {
    const files = getStoredFiles()
    const filtered = files.filter(f => f.id !== fileId)
    localStorage.setItem(STORAGE_KEYS.FILES, JSON.stringify(filtered))
    return true
  } catch (e) {
    console.error('Failed to delete file:', e)
    return false
  }
}

/**
 * Get a file by ID
 * @param {string} fileId - File ID
 * @returns {Object|null} File object or null
 */
export const getFileById = (fileId) => {
  const files = getStoredFiles()
  return files.find(f => f.id === fileId) || null
}

/**
 * Get active files (for dropdown)
 * @returns {Array} Array of active file objects
 */
export const getActiveFiles = () => {
  const files = getStoredFiles()
  return files.filter(f => f.active !== false)
}

/**
 * Toggle file active status
 * @param {string} fileId - File ID
 * @param {boolean} active - Active status
 * @returns {boolean} Success status
 */
export const toggleFileActive = (fileId, active) => {
  try {
    const files = getStoredFiles()
    const file = files.find(f => f.id === fileId)
    if (file) {
      file.active = active
      localStorage.setItem(STORAGE_KEYS.FILES, JSON.stringify(files))
      return true
    }
    return false
  } catch (e) {
    console.error('Failed to toggle file active:', e)
    return false
  }
}

/**
 * Check admin password (client-side only)
 * @param {string} password - Password to check
 * @returns {boolean} Valid or not
 */
export const checkPassword = (password) => {
  if (!password || password.trim() === '') {
    return false
  }
  
  // Default password: "admin"
  // Always accept "admin" as valid password
  if (password === 'admin') {
    return true
  }
  
  // Check against stored hash if exists
  const storedHash = localStorage.getItem(STORAGE_KEYS.PASSWORD)
  if (storedHash) {
    const inputHash = btoa(password).substring(0, 10)
    return inputHash === storedHash
  }
  
  // If no stored hash, only "admin" is valid
  return false
}

/**
 * Set admin password
 * @param {string} password - New password
 */
export const setPassword = (password) => {
  const hash = btoa(password).substring(0, 10)
  localStorage.setItem(STORAGE_KEYS.PASSWORD, hash)
}

