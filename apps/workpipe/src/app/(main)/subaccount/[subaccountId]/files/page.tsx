import BlurPage from '@/components/global/blur-page'
import FilesSurface from '@/components/global/files-surface'

type Props = {
  params: Promise<{ subaccountId: string }>
}

const FilesPage = async ({ params }: Props) => {
  const { subaccountId } = await params

  return (
    <BlurPage>
      <div className="flex flex-col gap-4 pb-6">
        <div>
          <h1 className="text-2xl">Files</h1>
          <p className="text-sm text-muted-foreground">
            Media and documents for this sub-account, stored securely in Orbit
            Drive.
          </p>
        </div>
        <FilesSurface subAccountId={subaccountId} />
      </div>
    </BlurPage>
  )
}

export default FilesPage
