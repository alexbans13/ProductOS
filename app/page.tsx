import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <div className="z-10 max-w-5xl w-full items-center justify-center text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          ProductOS
        </h1>
        <p className="text-center text-xl text-gray-600 mb-12">
          Product Manager AI Assistant
        </p>
        <p className="text-center text-gray-600 mb-8 max-w-2xl mx-auto">
          Make data-driven decisions with intelligent analysis, agent-based insights, and actionable recommendations.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-white px-6 py-3 text-base font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Get Started
          </Link>
        </div>
      </div>
    </main>
  );
}

