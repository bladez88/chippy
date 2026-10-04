import type { Location } from '@chippy/shared'

export const sameLocationSnapshot = (a: Location, b: Location) => a.label === b.label
  && a.address === b.address
  && a.latitude === b.latitude
  && a.longitude === b.longitude
