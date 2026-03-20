import React from 'react'
import ReactDOM from 'react-dom/client'
import { LDProvider } from 'launchdarkly-react-client-sdk'
import App from './App.tsx'
import './index.css'

const clientSideID = import.meta.env.VITE_LAUNCHDARKLY_CLIENT_ID || '';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LDProvider
      clientSideID={clientSideID}
      context={{ kind: 'user', key: 'demo-user', name: 'Demo User' }}
    >
      <App />
    </LDProvider>
  </React.StrictMode>,
)
