import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/eczar';
import '@fontsource-variable/inter';
import '@fontsource/mukta/400.css';
import '@fontsource/mukta/600.css';
import './styles/index.css';
import 'leaflet/dist/leaflet.css';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/layout/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find root element to mount to');
const root = ReactDOM.createRoot(rootElement);

function ConfigError({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div role="alert" className="max-w-lg rounded-lg border border-danger/30 bg-surface p-6 shadow-card">
        <h1 className="text-2xl font-semibold">Mewar Sync is not configured</h1>
        <p className="mt-2 text-sm text-ink-muted">{message}</p>
      </div>
    </div>
  );
}

// App (and Firebase) are loaded dynamically so a missing configuration shows a
// readable message instead of a blank page.
import('./App')
  .then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
  })
  .catch((err: unknown) => {
    const message = err instanceof Error && /configuration/i.test(err.message)
      ? err.message
      : 'The application failed to start. Please refresh the page.';
    root.render(<ConfigError message={message} />);
  });
