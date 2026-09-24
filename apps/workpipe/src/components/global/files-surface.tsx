'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import FilesBrowser from './files-browser'

// The single Files surface (#24) — Media and Documents are the same Drive store
// split by mime type, so they're two tabs over one browser rather than two
// separate pages/sidebar entries.
export default function FilesSurface({
  subAccountId,
}: {
  subAccountId: string
}) {
  return (
    <Tabs defaultValue="media" className="w-full">
      <TabsList>
        <TabsTrigger value="media">Media</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
      </TabsList>
      <TabsContent value="media" className="mt-4">
        <FilesBrowser subAccountId={subAccountId} kind="media" />
      </TabsContent>
      <TabsContent value="documents" className="mt-4">
        <FilesBrowser subAccountId={subAccountId} kind="documents" />
      </TabsContent>
    </Tabs>
  )
}
