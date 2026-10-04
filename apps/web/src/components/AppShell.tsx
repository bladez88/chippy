import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Bell, CalendarDays, LogOut, Map, Menu, Settings, Users, X } from 'lucide-react'
import { useAuth } from '../features/auth/AuthProvider'
import { FriendsPanel } from '../features/friends/FriendsPanel'
import { NotificationsPanel } from '../features/notifications/NotificationsPanel'

export function AppShell() {
  const [menu,setMenu]=useState(false); const [panel,setPanel]=useState<'menu'|'friends'|'notifications'>('menu'); const {logout,user}=useAuth()
  const open=(next:typeof panel)=>{setPanel(next);setMenu(true)}
  return <><Outlet/><nav className="bottom-nav" aria-label="Primary"><NavLink to="/calendar"><CalendarDays/><span>Calendar</span></NavLink><NavLink to="/map"><Map/><span>Map</span></NavLink><button className={menu?'active':''} onClick={()=>menu?setMenu(false):open('menu')}><Menu/><span>Menu</span></button></nav>
    {menu&&<div className="sheet-backdrop menu-backdrop" onMouseDown={(e)=>e.target===e.currentTarget&&setMenu(false)}><aside className="sheet menu-sheet"><div className="sheet-handle"/><header><div><p className="eyebrow">{panel==='menu'?`Hi, ${user?.name}`:panel}</p><h2>{panel==='menu'?'Your Chippy':panel==='friends'?'Friends':'Notifications'}</h2></div><button className="icon-button" onClick={()=>setMenu(false)}><X/></button></header>{panel==='friends'?<FriendsPanel/>:panel==='notifications'?<NotificationsPanel/>:<div className="menu-list"><button onClick={()=>setPanel('friends')}><Users/><span><strong>Friends</strong><small>Connections and requests</small></span></button><button onClick={()=>setPanel('notifications')}><Bell/><span><strong>Notifications</strong><small>Ride updates</small></span></button><button disabled><Settings/><span><strong>Settings</strong><small>Coming after the vertical slice</small></span></button><button onClick={()=>logout()}><LogOut/><span><strong>Log out</strong><small>See you on the next trip</small></span></button></div>}</aside></div>}
  </>
}
