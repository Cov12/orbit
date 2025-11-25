import React from 'react'

type Props = {
  children: React.ReactNode
}

const ComingSoonPage = ({ children }: Props) => {
  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-900 to-blue-900 text-white">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="mb-4 text-4xl font-bold">Welcome to our community</h1>
          <p className="mb-8 text-lg">
            We&apos;re working hard to bring you an amazing experience. Stay
            tuned for the launch!
          </p>
          <div className="flex flex-col items-center justify-center md:flex-row">
            <input
              type="email"
              placeholder="Email address"
              className="mb-4 rounded-md bg-gray-800 px-4 py-3 text-white focus:outline-none md:mb-0 md:mr-4"
            />
            <button className="rounded-md bg-blue-500 px-6 py-3 font-bold text-white hover:bg-blue-600 focus:outline-none">
              Notify me when we launch
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ComingSoonPage
