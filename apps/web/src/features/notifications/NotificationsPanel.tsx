import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NotificationDto, RideRequestDto } from '@chippy/shared'
import { Bell, Check, X } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { api, queryKeys } from '../../lib/api'

export function NotificationsPanel() {
  const client=useQueryClient(); const notes=useQuery({queryKey:queryKeys.notifications,queryFn:()=>api<{notifications:NotificationDto[]}>('/notifications')}); const requests=useQuery({queryKey:queryKeys.requests,queryFn:()=>api<{requests:RideRequestDto[]}>('/ride-requests')})
  const decide=useMutation({mutationFn:({id,decision}:{id:string;decision:'accept'|'decline'})=>api(`/ride-requests/${id}/${decision}`,{method:'PATCH'}),onSuccess:()=>client.invalidateQueries()})
  const read=useMutation({mutationFn:(id:string)=>api(`/notifications/${id}/read`,{method:'PATCH'}),onSuccess:()=>client.invalidateQueries({queryKey:queryKeys.notifications})})
  const incoming=requests.data?.requests.filter((r)=>r.status==='PENDING'&&r.friend.id==='user-jimmy')??[]
  return <div className="panel-content">{incoming.map((request)=><article className="request-card" key={request.id}><span className="friend-avatar">{request.friend.name.at(0)}</span><div><strong>{request.friend.name} needs a ride</strong><small>Suggested contribution ${request.fuelContributionAmount??0}</small><span className="request-actions"><button className="button primary" onClick={()=>decide.mutate({id:request.id,decision:'accept'})}><Check/>Accept</button><button className="button secondary" onClick={()=>decide.mutate({id:request.id,decision:'decline'})}><X/>Decline</button></span></div></article>)}
    <div className="notification-list">{notes.data?.notifications.length===0&&<div className="empty-state"><Bell/><h3>All caught up</h3><p>Ride updates will appear here.</p></div>}{notes.data?.notifications.map((note)=><button className={`notification ${note.readAt?'':'unread'}`} key={note.id} onClick={()=>!note.readAt&&read.mutate(note.id)}><span/><div><strong>{note.title}</strong><p>{note.body}</p><small>{formatDistanceToNow(parseISO(note.createdAt),{addSuffix:true})}</small></div></button>)}</div>
  </div>
}
