'use client'

import { useEffect, useMemo, useState } from 'react'

import {
  Business,
  BusinessSidebarOption,
  SubAccount,
  SubAccountSidebarOption,
} from '@prisma/client'
import clsx from 'clsx'
import { ChevronsUpDown, Compass, Menu, PlusCircleIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { icons } from '@/lib/constants'
import { useModal } from '@/providers/modal-provider'

import SubAccountDetails from '../forms/subaccount-details'
import CustomModal from '../global/custom-modal'
import { AspectRatio } from '../ui/aspect-ratio'
import { Button } from '../ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Separator } from '../ui/separator'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet'

type Props = {
  defaultOpen?: boolean
  subAccounts: SubAccount[]
  sidebarOpt: BusinessSidebarOption[] | SubAccountSidebarOption[]
  sidebarLogo: string
  details: any
  user: any
  id: string
}

const MenuOptions = ({
  details,
  id,
  sidebarLogo,
  sidebarOpt,
  subAccounts,
  user,
  defaultOpen,
}: Props) => {
  const { setOpen } = useModal()
  const [isMounted, setIsMounted] = useState(false)

  const openState = useMemo(
    () => (defaultOpen ? { open: true } : {}),
    [defaultOpen]
  )

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return

  return (
    <Sheet modal={false} {...openState}>
      <SheetTrigger
        asChild
        className="felx absolute left-4 top-4 z-[100] md:!hidden"
      >
        <Button variant="outline" size={'icon'}>
          <Menu />
        </Button>
      </SheetTrigger>

      <SheetContent
        //cleanup
        // showX={!defaultOpen}
        side={'left'}
        className={clsx('fixed top-0 border-r-[1px] p-6 backdrop-blur-xl', {
          'z-0 hidden w-[300px] md:inline-block': defaultOpen,
          'z-[100] inline-block w-full md:hidden': !defaultOpen,
        })}
      >
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <div>
          <AspectRatio ratio={16 / 5}>
            <Image
              src={sidebarLogo}
              alt="Sidebar Logo"
              fill
              className="rounded-md object-contain"
            />
          </AspectRatio>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                className="my-4 flex w-full items-center justify-between py-8"
                variant="ghost"
              >
                <div className="flex items-center gap-2 text-left">
                  <Compass />
                  <div className="flex flex-col">
                    {details.name}
                    <span className="text-muted-foreground">
                      {details.address}
                    </span>
                  </div>
                </div>
                <div>
                  <ChevronsUpDown size={16} className="text-muted-foreground" />
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="z-[200] mt-4 h-80 w-80">
              <Command className="rounded-lg">
                <CommandInput placeholder="Search Accounts..." />
                <CommandList className="pb-16">
                  <CommandEmpty> No results found</CommandEmpty>
                  {/* {(user?.role === 'BUSINESS_OWNER' ||
                    user?.role === 'BUSINESS_ADMIN') &&
                    user?.Business && ( */}
                  <CommandGroup heading="Business">
                    <CommandItem className="broder-[1px] my-2 cursor-pointer rounded-md border-border !bg-transparent p-2 text-primary transition-all hover:!bg-muted">
                      {defaultOpen ? (
                        <Link
                          href={`/business/${user?.Business?.id}`}
                          className="flex h-full w-full gap-4"
                        >
                          <div className="relative w-16">
                            <Image
                              src={user?.Business?.businessLogo}
                              alt="Business Logo"
                              fill
                              className="rounded-md object-contain"
                            />
                          </div>
                          <div className="flex flex-1 flex-col">
                            {user?.Business?.name}
                            <span className="text-muted-foreground">
                              {user?.Business?.address}
                            </span>
                          </div>
                        </Link>
                      ) : (
                        <SheetClose asChild>
                          <Link
                            href={`/business/${user?.Business?.id}`}
                            className="flex h-full w-full gap-4"
                          >
                            <div className="relative w-16">
                              <Image
                                src={user?.Business?.businessLogo}
                                alt="Business Logo"
                                fill
                                className="rounded-md object-contain"
                              />
                            </div>
                            <div className="flex flex-1 flex-col">
                              {user?.Business?.name}
                              <span className="text-muted-foreground">
                                {user?.Business?.address}
                              </span>
                            </div>
                          </Link>
                        </SheetClose>
                      )}
                    </CommandItem>
                  </CommandGroup>
                  {/* )} */}
                  <CommandGroup heading="Accounts">
                    {!!subAccounts
                      ? subAccounts.map(subaccount => (
                          <CommandItem key={subaccount.id}>
                            {defaultOpen ? (
                              <Link
                                href={`/subaccount/${subaccount.id}`}
                                className="flex h-full w-full gap-4"
                              >
                                <div className="relative w-16">
                                  <Image
                                    src={subaccount.subAccountLogo}
                                    alt="subaccount Logo"
                                    fill
                                    className="rounded-md object-contain"
                                  />
                                </div>
                                <div className="flex flex-1 flex-col">
                                  {subaccount.name}
                                  <span className="text-muted-foreground">
                                    {subaccount.address}
                                  </span>
                                </div>
                              </Link>
                            ) : (
                              <SheetClose asChild>
                                <Link
                                  href={`/subaccount/${subaccount.id}`}
                                  className="flex h-full w-full gap-4"
                                >
                                  <div className="relative w-16">
                                    <Image
                                      src={subaccount.subAccountLogo}
                                      alt="subaccount Logo"
                                      fill
                                      className="rounded-md object-contain"
                                    />
                                  </div>
                                  <div className="flex flex-1 flex-col">
                                    {subaccount.name}
                                    <span className="text-muted-foreground">
                                      {subaccount.address}
                                    </span>
                                  </div>
                                </Link>
                              </SheetClose>
                            )}
                          </CommandItem>
                        ))
                      : 'No Accounts'}
                  </CommandGroup>
                </CommandList>
                {/* {(user?.role === 'BUSINESS_OWNER' ||
                  user?.role === 'BUSINESS_ADMIN') && ( */}
                <SheetClose asChild>
                  <Button
                    className="flex w-full gap-2"
                    onClick={() => {
                      setOpen(
                        <CustomModal
                          title="Create A Subaccount"
                          subheading="You can switch between your business account and the subaccount from the sidebar"
                        >
                          <SubAccountDetails
                            businessDetails={user?.Business as Business}
                            userId={user?.id as string}
                            userName={user?.name}
                          />
                        </CustomModal>
                      )
                    }}
                  >
                    <PlusCircleIcon size={15} />
                    Create Sub Account
                  </Button>
                </SheetClose>
                {/* )} */}
              </Command>
            </PopoverContent>
          </Popover>
          <p className="mb-2 text-xs text-muted-foreground">MENU LINKS</p>
          <Separator className="mb-4" />
          <nav className="relative">
            <Command className="overflow-visible rounded-lg bg-transparent">
              <CommandInput placeholder="Search..." />
              <CommandList className="overflow-visible py-4">
                <CommandEmpty>No Results Found</CommandEmpty>
                <CommandGroup className="overflow-visible">
                  {sidebarOpt.map(sidebarOptions => {
                    let val
                    const result = icons.find(
                      icon => icon.value === sidebarOptions.icon
                    )
                    if (result) {
                      val = <result.path />
                    }
                    return (
                      <CommandItem
                        key={sidebarOptions.id}
                        className={clsx('w-full md:w-[320px]', {
                          'cmdk-item-disabled': false,
                        })}
                      >
                        <Link
                          href={sidebarOptions.link}
                          className="flex w-[320px] items-center gap-2 rounded-md transition-all hover:bg-transparent md:w-full"
                        >
                          {val}
                          <span>{sidebarOptions.name}</span>
                        </Link>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default MenuOptions
