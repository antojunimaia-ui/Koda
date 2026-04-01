import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: Error | null}> {
  constructor(props: any) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#0f172a', color: '#f87171', padding: 32, fontFamily: 'monospace', height: '100vh', whiteSpace: 'pre-wrap', overflow: 'auto' }}>
          <h2 style={{ color: '#fb923c' }}>⚠ Koda Renderer Crash</h2>
          <b>{this.state.error.message}</b>
          <pre style={{ color: '#94a3b8', marginTop: 16, fontSize: 12 }}>{this.state.error.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
