import { createRouteHandler } from "uploadthing/next";

import { portalFileRouter } from "./core";

// Export the route handlers for the App Router.
export const { GET, POST } = createRouteHandler({
  router: portalFileRouter,
});
