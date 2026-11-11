import { Component } from 'react';

/**
 * Last line of defence: if rendering throws, show a way out instead of a
 * blank page. The board itself is saved on the server, so reloading is safe.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    // Surfaced in the browser console for whoever is debugging; there is no
    // error-reporting service wired up.
    console.error('CollabBoard crashed while rendering', error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4" role="alert">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-gray-400 mb-6">
            The page hit an unexpected error. Your board is saved — reloading will bring it back.
          </p>
          <div className="flex gap-3 justify-center">
            <button type="button" onClick={() => window.location.reload()} className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg px-5 py-2.5">
              Reload
            </button>
            <a href="/" className="bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg px-5 py-2.5">
              Home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
