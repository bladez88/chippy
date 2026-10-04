import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useAuth } from '../features/auth/AuthProvider'
import { LoginPage } from '../features/auth/LoginPage'
import { CalendarPage } from '../features/calendar/CalendarPage'
import { MapPage } from '../features/map/MapPage'
import { AppShell } from '../components/AppShell'

export function App() {
  const {user,loading}=useAuth(); const {needRefresh:[needRefresh],updateServiceWorker}=useRegisterSW()
  if(loading)return <div className="app-loading"><span className="brand-mark">c</span><p>Getting your route ready…</p></div>
  if(!user)return <LoginPage/>
  return <BrowserRouter><Routes><Route element={<AppShell/>}><Route path="/calendar" element={<CalendarPage/>}/><Route path="/map" element={<MapPage/>}/><Route path="*" element={<Navigate to="/calendar" replace/>}/></Route></Routes>{needRefresh&&<div className="update-toast"><span>A fresh Chippy is ready.</span><button onClick={()=>updateServiceWorker(true)}>Update</button></div>}</BrowserRouter>
}
