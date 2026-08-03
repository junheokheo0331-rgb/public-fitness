import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SessionProvider } from './lib/session.jsx';
import { WorkoutProvider } from './lib/workout/WorkoutContext.jsx';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <SessionProvider>
        <WorkoutProvider>
          <App />
        </WorkoutProvider>
      </SessionProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
