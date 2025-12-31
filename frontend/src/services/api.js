import { API_ENDPOINTS } from '../config/api'

// Helper function for API calls
const apiCall = async (url, options = {}) => {
  try {
    // Don't set Content-Type for FormData (let browser set it)
    const headers = {}
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }
    
    const response = await fetch(url, {
      headers: {
        ...headers,
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = `HTTP error! status: ${response.status}`
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorData.message || errorMessage
      } catch (e) {
        // If response is not JSON, try to get text
        try {
          const text = await response.text()
          if (text) errorMessage = text
        } catch (e2) {
          // Use default error message
        }
      }
      
      const error = new Error(errorMessage)
      error.status = response.status
      error.statusText = response.statusText
      throw error
    }

    return await response.json()
  } catch (error) {
    // Handle network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error('Network Error - Backend not reachable:', {
        url,
        message: 'Cannot connect to backend server. Please check if backend is running.'
      })
      throw new Error('Cannot connect to backend server. Please check your internet connection and ensure the backend is running.')
    }
    
    console.error('API Error:', {
      url,
      method: options.method || 'GET',
      status: error.status,
      message: error.message,
      error
    })
    
    throw error
  }
}

// Get list of active spin files
export const getSpinFiles = async () => {
  return apiCall(API_ENDPOINTS.SPINS.LIST)
}

// Get admin list of all spin files
export const getAdminSpinFiles = async () => {
  return apiCall(API_ENDPOINTS.SPINS.ADMIN_LIST)
}

// Upload a new spin file
export const uploadSpinFile = async (formData) => {
  return apiCall(API_ENDPOINTS.SPINS.UPLOAD, {
    method: 'POST',
    body: formData,
    headers: {}, // Let browser set Content-Type for FormData
  })
}

// Spin the wheel and get winner
export const spinWheel = async (spinFileId) => {
  return apiCall(API_ENDPOINTS.SPINS.SPIN(spinFileId), {
    method: 'POST',
  })
}

// Get all filenames
export const getSpinFileNames = async () => {
  return apiCall(API_ENDPOINTS.SPINS.FILENAMES)
}

// Delete a spin file
export const deleteSpinFile = async (id) => {
  return apiCall(API_ENDPOINTS.SPINS.DELETE(id), {
    method: 'DELETE',
  })
}

// Toggle active status of a spin file
export const toggleSpinFileActive = async (id) => {
  return apiCall(API_ENDPOINTS.SPINS.TOGGLE_ACTIVE(id), {
    method: 'PATCH',
  })
}

// Check password for admin operations
export const checkPassword = async (password) => {
  return apiCall(API_ENDPOINTS.SPINS.CHECK_PASSWORD, {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

// Set fixed winner for a spin file
export const setFixedWinner = async (spinFileId, winnerTicket) => {
  return apiCall(API_ENDPOINTS.SPINS.SET_FIXED_WINNER(spinFileId), {
    method: 'POST',
    body: JSON.stringify({ rigged_ticket: winnerTicket }),
  })
}

// Update admin password
export const updatePassword = async (oldPassword, newPassword) => {
  return apiCall(API_ENDPOINTS.SPINS.UPDATE_PASSWORD, {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  })
}

