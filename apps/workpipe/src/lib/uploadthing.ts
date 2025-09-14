import { generateComponents } from '@uploadthing/react'
import { generateReactHelpers } from '@uploadthing/react/hooks'

import type { WorkPipeFileRouter } from '@/app/api/uploadthing/core'

export const { UploadButton, UploadDropzone, Uploader } =
  generateComponents<WorkPipeFileRouter>()

export const { useUploadThing, uploadFiles } =
  generateReactHelpers<WorkPipeFileRouter>()
