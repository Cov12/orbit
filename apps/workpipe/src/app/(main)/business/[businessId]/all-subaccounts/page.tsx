import { SubAccount } from '@prisma/client'
import Link from 'next/link'

import LogoOrInitial from '@/components/global/logo-or-initial'
import { AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { isDemoMode } from '@/lib/deployment'
import { getAuthUserDetails } from '@/lib/queries'
import { syncSubAccountsFromPortal } from '@/lib/subaccount-sync'

import CreateSubaccountButton from './_components/create-subaccount-btn'
import DeleteButton from './_components/delete-button'

type Props = {
  params: Promise<{ businessId: string }>
}

const AllSubaccountsPage = async ({ params }: Props) => {
  const { businessId } = await params
  // Same re-pull as the layout — repeated here so the list below is guaranteed
  // to query `user.Business.SubAccount` after the sync, not alongside it. The
  // TTL + in-flight dedupe makes the second call free.
  await syncSubAccountsFromPortal()
  const user = await getAuthUserDetails()
  if (!user) return

  return (
    <AlertDialog>
      <div className="flex flex-col">
        <CreateSubaccountButton
          user={user}
          id={businessId}
          className="m-6 w-[200px] self-end"
        />
        <Command className="rounded-lg bg-transparent">
          <CommandInput placeholder="Search Account..." />
          <CommandList>
            <CommandEmpty>No Results Found.</CommandEmpty>
            <CommandGroup heading="Sub Accounts">
              {!!user.Business?.SubAccount.length ? (
                user.Business.SubAccount.map((subaccount: SubAccount) => (
                  <CommandItem
                    key={subaccount.id}
                    className="my-2 h-32 cursor-pointer rounded-lg border-[1px] border-border !bg-background p-4 text-primary transition-all hover:!bg-background"
                  >
                    <Link
                      href={`/subaccount/${subaccount.id}`}
                      className="flex h-full w-full gap-4"
                    >
                      <div className="relative w-32">
                        <LogoOrInitial
                          src={subaccount.subAccountLogo}
                          name={subaccount.name}
                          alt="subaccount logo"
                          className="rounded-md bg-muted/50 object-contain p-4"
                          initialClassName="text-3xl"
                        />
                      </div>
                      <div className="flex flex-col justify-between">
                        <div className="flex flex-col">
                          {subaccount.name}
                          <span className="text-xs text-muted-foreground">
                            {subaccount.address}
                          </span>
                        </div>
                      </div>
                    </Link>
                    {!isDemoMode() && (
                    <AlertDialogTrigger asChild>
                      <Button
                        size={'sm'}
                        variant={'destructive'}
                        className="w-20 !text-white hover:bg-red-600 hover:text-white"
                      >
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    )}
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-left">
                          Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDescription className="text-left">
                          This action cannot be undone. This will delete the
                          subaccount and all data related to the subaccount.
                        </AlertDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex items-center">
                        <AlertDialogCancel className="mb-2">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive hover:bg-destructive">
                          <DeleteButton subaccountId={subaccount.id} />
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </CommandItem>
                ))
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  No Sub accounts
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    </AlertDialog>
  )
}

export default AllSubaccountsPage
