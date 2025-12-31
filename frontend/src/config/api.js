// API Configuration
// Set VITE_API_BASE_URL in .env file for local development
// Production: https://justwheel.vercel.app/api
// Local: http://localhost:3001/api
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://justwheel.vercel.app/api'

export const API_ENDPOINTS = {
  SPINS: {
    LIST: `${API_BASE_URL}/spins/list/`,
    UPLOAD: `${API_BASE_URL}/spins/upload/`,
    SPIN: (id) => `${API_BASE_URL}/spins/spin/${id}/`,
    FILENAMES: `${API_BASE_URL}/spins/filenames/`,
    DELETE: (id) => `${API_BASE_URL}/spins/delete/${id}/`,
    TOGGLE_ACTIVE: (id) => `${API_BASE_URL}/spins/toggle-active/${id}/`,
    CHECK_PASSWORD: `${API_BASE_URL}/spins/check-password/`,
    ADMIN_LIST: `${API_BASE_URL}/spins/admin-list/`,
    SET_FIXED_WINNER: (id) => `${API_BASE_URL}/spins/set-fixed-winner/${id}/`,
    UPDATE_PASSWORD: `${API_BASE_URL}/spins/update-password/`,
  }
}

export default API_BASE_URL

