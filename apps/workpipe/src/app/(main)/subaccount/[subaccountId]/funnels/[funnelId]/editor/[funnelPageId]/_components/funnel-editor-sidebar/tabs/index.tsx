import { Database, Plus, SettingsIcon, SquareStackIcon } from 'lucide-react'

import { TabsList, TabsTrigger } from '@/components/ui/tabs'

type Props = Record<string, never>

const TabList = (props: Props) => {
  return (
    <TabsList className="flex h-fit w-full flex-col items-center justify-evenly gap-4 bg-transparent">
      <TabsTrigger
        value="Settings"
        className="h-10 w-10 p-0 data-[state=active]:bg-muted"
      >
        <SettingsIcon />
      </TabsTrigger>
      <TabsTrigger
        value="Components"
        className="h-10 w-10 p-0 data-[state=active]:bg-muted"
      >
        <Plus />
      </TabsTrigger>

      <TabsTrigger
        value="Layers"
        className="h-10 w-10 p-0 data-[state=active]:bg-muted"
      >
        <SquareStackIcon />
      </TabsTrigger>
      <TabsTrigger
        value="Media"
        className="h-10 w-10 p-0 data-[state=active]:bg-muted"
      >
        <Database />
      </TabsTrigger>
    </TabsList>
  )
}

export default TabList
