'use client'
import React from 'react'

import { ProgressCircle } from '@tremor/react'

type Props = {
  value: number
  description: React.ReactNode
}

const CircleProgress = ({ description, value = 0 }: Props) => {
  return (
    <div className="flex items-center gap-4">
      <ProgressCircle
        showAnimation={true}
        value={value ? value : 0}
        radius={70}
        strokeWidth={20}
      >
        {value ? value : 0}%
      </ProgressCircle>
      <div>
        <b>Closing Rate</b>
        <div className="text-muted-foreground">{description}</div>
      </div>
    </div>
  )
}

export default CircleProgress
