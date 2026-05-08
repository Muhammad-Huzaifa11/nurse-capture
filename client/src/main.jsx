import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from '@/auth/AuthContext'
import { SeatAuthProvider } from '@/auth/SeatAuthContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <SeatAuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SeatAuthProvider>
    </AuthProvider>
  </StrictMode>,
)
