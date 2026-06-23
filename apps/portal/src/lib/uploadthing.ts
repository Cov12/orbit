import { generateUploadDropzone } from "@uploadthing/react";

import type { PortalFileRouter } from "@/app/api/uploadthing/core";

// Typed dropzone bound to the Portal FileRouter (v7 component generator).
export const UploadDropzone = generateUploadDropzone<PortalFileRouter>();
