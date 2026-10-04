import type { Location } from '@chippy/shared'

const SAME_ORIGIN_TOLERANCE_METERS = 150

export const privacySafePickupLabel = (driverOrigin: Location, passengerOrigin: Location) => {
  if (distanceMeters(driverOrigin, passengerOrigin) <= SAME_ORIGIN_TOLERANCE_METERS) return driverOrigin.label
  return generalArea(passengerOrigin.address)
}

const distanceMeters = (a: Location, b: Location) => {
  const radians = (value: number) => value * Math.PI / 180
  const latitudeDelta = radians(b.latitude - a.latitude)
  const longitudeDelta = radians(b.longitude - a.longitude)
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(longitudeDelta / 2) ** 2
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

const generalArea = (address: string) => {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean)
  const last = parts.at(-1)?.toLowerCase()
  const cityIndex = last === 'canada' || last === 'ca' ? parts.length - 3 : parts.length > 2 ? parts.length - 2 : 0
  return `${parts[Math.max(0, cityIndex)] ?? 'Pickup'} area`
}
