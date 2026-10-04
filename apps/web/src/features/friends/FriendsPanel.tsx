import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FriendDto } from '@chippy/shared'
import { Check, UserPlus, X } from 'lucide-react'
import { api, queryKeys } from '../../lib/api'

export function FriendsPanel() {
  const client = useQueryClient(); const [error,setError]=useState(''); const query = useQuery({ queryKey: queryKeys.friends, queryFn: () => api<{ friends: FriendDto[] }>('/friends') })
  const refresh = () => client.invalidateQueries({ queryKey: queryKeys.friends })
  const add = useMutation({ mutationFn: (email: string) => api('/friends/requests', { method:'POST', body: JSON.stringify({email}) }), onSuccess: refresh, onError: (e: Error) => setError(e.message) })
  const update = useMutation({ mutationFn: ({id,status}:{id:string;status:'ACCEPTED'|'BLOCKED'}) => api(`/friends/requests/${id}`, {method:'PATCH',body:JSON.stringify({status})}), onSuccess: refresh })
  const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();add.mutate(String(new FormData(e.currentTarget).get('email')))}
  return <div className="panel-content"><form className="friend-add" onSubmit={submit}><input name="email" type="email" placeholder="Friend’s email" required/><button className="button primary"><UserPlus/>Add</button></form>{error&&<p className="form-error">{error}</p>}<div className="people-list">{query.data?.friends.map((friend)=><article className="person" key={friend.friendshipId}><span className="friend-avatar">{friend.name.at(0)}</span><div><strong>{friend.name}</strong><small>{friend.email} · {friend.status.toLowerCase()}</small></div>{friend.status==='PENDING'&&friend.direction==='INCOMING'&&<span className="person-actions"><button onClick={()=>update.mutate({id:friend.friendshipId,status:'ACCEPTED'})}><Check/></button><button onClick={()=>update.mutate({id:friend.friendshipId,status:'BLOCKED'})}><X/></button></span>}</article>)}</div><p className="helper">Demo friend: Daniel is already connected. To test a new request, use another seeded account after adding it.</p></div>
}
