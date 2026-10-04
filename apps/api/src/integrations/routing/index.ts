import { env } from '../../config/env.js'
import { OpenRouteServiceClient } from '../openrouteservice/openrouteservice.client.js'
import { MockRoutingService } from './mock-routing.service.js'

export const routingService = env.NODE_ENV === 'test' || env.ROUTING_PROVIDER === 'mock'
  ? new MockRoutingService()
  : new OpenRouteServiceClient(requiredKey())

function requiredKey() {
  if (!env.OPENROUTESERVICE_API_KEY || env.OPENROUTESERVICE_API_KEY.startsWith('replace_')) throw new Error('OPENROUTESERVICE_API_KEY is required when ROUTING_PROVIDER=ors')
  return env.OPENROUTESERVICE_API_KEY
}
