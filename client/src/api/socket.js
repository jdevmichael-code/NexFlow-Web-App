import { io } from 'socket.io-client'

// One shared connection for the whole app. It connects after login
// (stores/auth.js) and sends the session cookie automatically.
// We only listen on it — all saving goes through the REST API.
export const socket = io({ autoConnect: false, withCredentials: true })
