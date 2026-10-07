import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../convex/_generated/api'

export type Room = NonNullable<FunctionReturnType<typeof api.rooms.myRoom>>
