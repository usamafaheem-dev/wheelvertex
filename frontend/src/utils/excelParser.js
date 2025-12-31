import * as XLSX from 'xlsx'

/**
 * Parse Excel file in browser and return JSON data
 * @param {File} file - Excel file (.xlsx or .xls)
 * @returns {Promise<Array>} Array of objects representing rows
 */
export const parseExcelFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        
        // Convert to JSON (array of objects)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          raw: false, // Convert dates and numbers to strings
          defval: '', // Default value for empty cells
        })
        
        if (!jsonData || jsonData.length === 0) {
          reject(new Error('Excel file is empty or has no data'))
          return
        }
        
        resolve(jsonData)
      } catch (error) {
        reject(new Error(`Failed to parse Excel file: ${error.message}`))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Convert image file to Base64 string
 * @param {File} file - Image file
 * @returns {Promise<string>} Base64 string
 */
export const imageToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      resolve(e.target.result)
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read image file'))
    }
    
    reader.readAsDataURL(file)
  })
}

