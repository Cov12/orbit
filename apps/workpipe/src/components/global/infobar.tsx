'use client'
import { useState } from 'react'

import { Role } from '@prisma/client'
import { Bell } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

import { UserAvatar } from '@/lib/auth-client'
import { NotificationWithUser } from '@/lib/types'

import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Card } from '../ui/card'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet'
import { Switch } from '../ui/switch'

import { ModeToggle } from './mode-toggle'

type Props = {
  notifications: NotificationWithUser | []
  role?: Role
  className?: string
  subAccountId?: string
}

const InfoBar = ({ notifications, subAccountId, className, role }: Props) => {
  const [allNotifications, setAllNotifications] = useState(notifications)
  const [showAll, setShowAll] = useState(true)

  const handleClick = () => {
    if (!showAll) {
      setAllNotifications(notifications)
    } else {
      if (notifications?.length !== 0) {
        setAllNotifications(
          notifications?.filter(item => item.subAccountId === subAccountId) ??
            []
        )
      }
    }
    setShowAll(prev => !prev)
  }

  return (
    <>
      <div
        className={twMerge(
          'fixed left-0 right-0 top-0 z-[20] flex items-center gap-4 border-b-[1px] bg-background/80 p-4 backdrop-blur-md md:left-[300px]',
          className
        )}
      >
        <div className="ml-auto flex items-center gap-2">
          <UserAvatar />
          <Sheet>
            <SheetTrigger>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white">
                <Bell size={17} />
              </div>
            </SheetTrigger>
            <SheetContent className="mr-4 mt-4 overflow-auto pr-4">
              <SheetHeader className="text-left">
                <SheetTitle>Notifications</SheetTitle>
                <SheetDescription>
                  {(role === 'BUSINESS_ADMIN' || role === 'BUSINESS_OWNER') && (
                    <Card className="flex items-center justify-between p-4">
                      Current Subaccount
                      <Switch onCheckedChange={handleClick} />
                    </Card>
                  )}
                </SheetDescription>
              </SheetHeader>
              {allNotifications?.map(notification => (
                <div
                  key={notification.id}
                  className="mb-2 flex flex-col gap-y-2 overflow-x-hidden text-ellipsis"
                >
                  <div className="flex gap-2">
                    <Avatar>
                      <AvatarImage
                        src={notification.User.avatarUrl}
                        alt="Profile Picture"
                      />
                      <AvatarFallback className="bg-primary">
                        {notification.User.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <p>
                        <span className="font-bold">
                          {notification.notification.split('|')[0]}
                        </span>
                        <span className="text-muted-foreground">
                          {notification.notification.split('|')[1]}
                        </span>
                        <span className="font-bold">
                          {notification.notification.split('|')[2]}
                        </span>
                      </p>
                      <small className="text-xs text-muted-foreground">
                        {new Date(notification.createdAt).toLocaleDateString(
                          'en-US',
                          {
                            month: '2-digit',
                            day: '2-digit',
                            year: 'numeric',
                          }
                        )}
                      </small>
                    </div>
                  </div>
                </div>
              ))}
              {allNotifications?.length === 0 && (
                <div
                  className="flex items-center justify-center text-muted-foreground"
                  mb-4
                >
                  You have no notifications
                </div>
              )}
            </SheetContent>
          </Sheet>
          <ModeToggle />
        </div>
      </div>
    </>
  )
}

export default InfoBar
