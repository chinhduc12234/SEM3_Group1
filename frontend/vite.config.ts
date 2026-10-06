import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], server: { proxy: {
  '/api/auth': 'http://localhost:5101', '/api/users': 'http://localhost:5101', '/api/products': 'http://localhost:5102'
} } });
