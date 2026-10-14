import { Link } from 'react-router-dom';
import { useDocumentTitle } from '@/lib/hooks';

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-5xl">This page has been swapped away.</h1>
      <p className="mt-3 max-w-md text-muted">The link might be old, or the listing was removed. Let’s get you back to the good stuff.</p>
      <div className="mt-6 flex gap-3">
        <Link to="/browse" className="btn-primary">Browse clothes</Link>
        <Link to="/" className="btn-secondary">Go home</Link>
      </div>
    </div>
  );
}
