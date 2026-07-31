import BlurPage from '@/components/global/blur-page'
import FilesBrowser from '@/components/global/files-browser'

type Props = {
  params: Promise<{ subaccountId: string }>
}

const DocumentsPage = async ({ params }: Props) => {
  const { subaccountId } = await params

  return (
    <BlurPage>
      <div className="flex flex-col gap-4 pb-6">
        <div>
          <h1 className="text-2xl">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Contracts, PDFs, and other files for this sub-account, stored
            securely in Orbit Drive.
          </p>
        </div>
        <FilesBrowser subAccountId={subaccountId} kind="documents" />
      </div>
    </BlurPage>
  )
}

export default DocumentsPage
