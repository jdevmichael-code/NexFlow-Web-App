import axios from 'axios'

// All REST calls go through this. The session lives in an httpOnly cookie,
// which the browser sends automatically — we never touch the token in JavaScript.
export const api = axios.create({ baseURL: '/api', withCredentials: true })

let handleLoggedOut = () => {}

/** Set what should happen when the server says we are no longer logged in. */
export function onLoggedOut(callback) {
    handleLoggedOut = callback
}

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const isLoginAttempt = error.config?.url?.startsWith('/auth/')
        if (error.response?.status === 401 && !isLoginAttempt) handleLoggedOut()
        return Promise.reject(error)
    },
)

/** A readable message for any failed request. */
export function errorMessage(error) {
    return error.response?.data?.error || 'Could not reach the server. Please try again.'
}
