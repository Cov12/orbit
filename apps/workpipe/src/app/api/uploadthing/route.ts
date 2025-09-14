import { createNextRouteHandler } from 'uploadthing/next'

import { wpFileRouter } from './core'

export const { GET, POST } = createNextRouteHandler({ router: wpFileRouter })

