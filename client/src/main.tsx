import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './socketListeners'; // registers all socket event handlers
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
