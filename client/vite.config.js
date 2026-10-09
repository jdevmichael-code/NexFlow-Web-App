import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const SERVER = 'http://localhost:4000'

export default defineConfig({
    plugins: [
        vue(), 
        tailwindcss()
    ],
    resolve: {
        alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
        port: 5173,
        // Send API, image and socket requests to the Express server.
        // The browser sees one origin, so the session cookie just works.
        proxy: {
            '/api': SERVER,
            '/files': SERVER,
            '/socket.io': { target: SERVER, ws: true },
        },
    },
})
