import Image from 'next/image'
import Link from 'next/link'

import { ModeToggle } from '@/components/global/mode-toggle'
import type { AuthUser } from '@/lib/auth'
import { UserAvatar } from '@/lib/auth-client'

type Props = {
  user?: AuthUser | null
}

const Navigation = ({ user }: Props) => {
  return (
    <div className="fixed left-0 right-0 top-0 z-10 flex items-center justify-between p-4 [background-color:#006af542] [background-size:16px_16px]">
      <aside className="flex items-center gap-2">
        {/* cleanup */}
        <Image
          src={'/assets/workpipe-logo-blue.png'}
          width={80}
          height={80}
          alt="plur logo"
        />
        <span className="text-xl font-bold">WorkPipe.</span>
      </aside>
      <nav className="absolute left-[50%] top-[50%] hidden translate-x-[-50%] translate-y-[-50%] transform md:block">
        <ul className="flex items-center justify-center gap-8">
          <Link href={'#pricing'}>Pricing</Link>
          <Link href={'#'}>About</Link>
          <Link href={'#'}>Documentation</Link>
          <Link href={'#'}>Features</Link>
        </ul>
      </nav>
      <aside className="flex items-center gap-2">
        {/* <Link
          href={'/business'}
          className="bg-primary text-white p-2 px-4 rounded-md hover:bg-primary/80"
        >
          {user ? 'Dashboard' : 'Login' }
        </Link> */}
        {user ? (
          <Link
            href={'/business'}
            className="rounded-md bg-primary p-2 px-4 text-white hover:bg-primary/80"
          >
            {' '}
            Dashboard
          </Link>
        ) : (
          <Link
            href={'/business'}
            className="rounded-md bg-primary p-2 px-4 text-white hover:bg-primary/80"
          >
            {' '}
            Login
          </Link>
        )}

        <UserAvatar />
        <ModeToggle />
      </aside>
    </div>
  )
}

export default Navigation
