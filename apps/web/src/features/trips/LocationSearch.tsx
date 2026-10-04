import { useEffect, useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Location } from '@chippy/shared'
import { Check, LoaderCircle, MapPin, Search } from 'lucide-react'
import { api } from '../../lib/api'

type Suggestion = Location & { id: string }

export function LocationSearch({ fieldName, label, placeholder, initialValue }: { fieldName: string; label: string; placeholder: string; initialValue?: Location }) {
  const id = useId(); const [input, setInput] = useState(initialValue?.label ?? ''); const [debounced, setDebounced] = useState(''); const [selected, setSelected] = useState<Location | null>(initialValue ?? null); const [open, setOpen] = useState(false)
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(input.trim()), 280); return () => window.clearTimeout(timer) }, [input])
  const query = useQuery({ queryKey: ['location-search', debounced], queryFn: () => api<{ locations: Suggestion[] }>(`/locations/search?q=${encodeURIComponent(debounced)}`), enabled: debounced.length >= 2 && !selected, staleTime: 5 * 60_000 })
  const choose = (location: Suggestion) => { setSelected(location); setInput(location.label); setOpen(false) }
  return <label className="location-field" htmlFor={id}>{label}<span className="location-input"><MapPin/><input id={id} value={input} required autoComplete="off" placeholder={placeholder} onFocus={() => setOpen(true)} onChange={(event) => { setInput(event.target.value); setSelected(null); setOpen(true) }}/>{query.isFetching ? <LoaderCircle className="spin"/> : selected ? <Check className="selected-check"/> : <Search/>}</span><input type="hidden" name={fieldName} value={selected ? JSON.stringify(selected) : ''}/>
    {open && !selected && input.trim().length >= 2 && <span className="location-results" role="listbox">{query.isError && <span className="location-message">Location search is unavailable. Try again.</span>}{!query.isFetching && query.data?.locations.length === 0 && <span className="location-message">No locations found nearby.</span>}{query.data?.locations.map((location) => <button type="button" role="option" key={location.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(location)}><MapPin/><span><strong>{location.label}</strong><small>{location.address}</small></span></button>)}</span>}
  </label>
}
