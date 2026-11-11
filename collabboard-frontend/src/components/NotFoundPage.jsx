import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-indigo-400 font-mono text-sm tracking-widest mb-3">404</p>
        <h1 className="text-3xl font-bold text-white mb-2">Page not found</h1>
        <p className="text-gray-400 mb-6">That address doesn&rsquo;t lead anywhere on CollabBoard.</p>
        <Link to="/" className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-5 py-2.5">
          Back to Home
        </Link>
      </div>
    </main>
  );
}
