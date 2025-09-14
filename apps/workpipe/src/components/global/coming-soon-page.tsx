import React from 'react';

type Props = {
  children: React.ReactNode;
};

const ComingSoonPage = ({ children }: Props) => {
  return (
    <div
      className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-blue-900 text-white"
    >
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Welcome to our community</h1>
          <p className="text-lg mb-8">
            We're working hard to bring you an amazing experience. Stay tuned for
            the launch!
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center">
            <input
              type="email"
              placeholder="Email address"
              className="bg-gray-800 text-white rounded-md py-3 px-4 mb-4 md:mb-0 md:mr-4 focus:outline-none"
            />
            <button className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-md focus:outline-none">
              Notify me when we launch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComingSoonPage;
