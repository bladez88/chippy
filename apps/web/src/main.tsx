import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './features/auth/AuthProvider'
import { App } from './app/App'
import './styles/index.css'
const client=new QueryClient({defaultOptions:{queries:{staleTime:30_000,retry:1}}})
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={client}><AuthProvider><App/></AuthProvider></QueryClientProvider></StrictMode>)
