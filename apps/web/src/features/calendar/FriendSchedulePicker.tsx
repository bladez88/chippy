import type { FriendDto } from '@chippy/shared'
import { Check, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { FRIEND_COLORS } from './friend-schedule'

export function FriendSchedulePicker({ friends, selectedIds, onChange }: { friends: FriendDto[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const accepted = useMemo(() => friends.filter((friend) => friend.status === 'ACCEPTED'), [friends])
  const filtered = accepted.filter((friend) => `${friend.name} ${friend.email}`.toLowerCase().includes(search.toLowerCase()))
  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id])

  return <section className="friend-compare" aria-label="Compare friend schedules">
    <div className="friend-search"><Search/><input value={search} onFocus={() => setOpen(true)} onChange={(event) => { setSearch(event.target.value); setOpen(true) }} placeholder="Compare friends’ schedules" aria-label="Search accepted friends"/>{open && <button type="button" aria-label="Close friend search" onClick={() => setOpen(false)}><X/></button>}</div>
    {open && <div className="friend-results">{filtered.length ? filtered.map((friend) => { const selected = selectedIds.includes(friend.id); const colorIndex = selected ? selectedIds.indexOf(friend.id) : selectedIds.length; return <button type="button" key={friend.id} onClick={() => toggle(friend.id)} aria-pressed={selected}><span className="friend-color" style={{ background: FRIEND_COLORS[colorIndex % FRIEND_COLORS.length] }}/><span><strong>{friend.name}</strong><small>{friend.email}</small></span>{selected && <Check/>}</button> }) : <p>{accepted.length ? 'No friends match that search.' : 'Add and accept a friend to compare schedules.'}</p>}</div>}
    {selectedIds.length > 0 && <div className="friend-chips">{selectedIds.map((id, index) => { const friend = accepted.find((item) => item.id === id); return friend && <button type="button" key={id} onClick={() => toggle(id)} title={`Hide ${friend.name}'s schedule`}><i style={{ background: FRIEND_COLORS[index % FRIEND_COLORS.length] }}/>{friend.name}<X/></button> })}</div>}
  </section>
}
