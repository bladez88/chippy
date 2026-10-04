import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NotificationDto, RideRequestDto } from '@chippy/shared'
import { Bell } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { api, liveQueryOptions, queryKeys } from '../../lib/api'
import { RideRequestCard } from '../carpools/RideRequestCard'

export function NotificationsPanel() {
  const client=useQueryClient(); const notes=useQuery({queryKey:queryKeys.notifications,queryFn:()=>api<{notifications:NotificationDto[]}>('/notifications'),...liveQueryOptions}); const requests=useQuery({queryKey:queryKeys.requests,queryFn:()=>api<{requests:RideRequestDto[]}>('/ride-requests'),...liveQueryOptions})
  const decide=useMutation({mutationFn:({id,decision}:{id:string;decision:'accept'|'decline'})=>api(`/ride-requests/${id}/${decision}`,{method:'PATCH'}),onSuccess:()=>client.invalidateQueries()})
  const read=useMutation({mutationFn:(id:string)=>api(`/notifications/${id}/read`,{method:'PATCH'}),onSuccess:()=>client.invalidateQueries({queryKey:queryKeys.notifications})})
  const incoming=requests.data?.requests.filter((r)=>r.status==='PENDING'&&r.routeImpact)??[]
  return <div className="panel-content">{incoming.map((request)=><RideRequestCard key={request.id} request={request} isPending={decide.isPending} onDecision={(decision)=>decide.mutate({id:request.id,decision})}/>)}
    <div className="notification-list">{notes.data?.notifications.length===0&&<div className="empty-state"><Bell/><h3>All caught up</h3><p>Ride updates will appear here.</p></div>}{notes.data?.notifications.map((note)=><button className={`notification ${note.readAt?'':'unread'}`} key={note.id} onClick={()=>!note.readAt&&read.mutate(note.id)}><span/><div><strong>{note.title}</strong><p>{note.body}</p><small>{formatDistanceToNow(parseISO(note.createdAt),{addSuffix:true})}</small></div></button>)}</div>
  </div>
}
