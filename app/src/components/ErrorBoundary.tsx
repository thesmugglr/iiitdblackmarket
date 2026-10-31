import { Component, type ReactNode } from 'react'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) { console.error(error) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="center-box">
        <h1>Something went wrong</h1>
        <p className="muted">Reload the page and try again. If it keeps happening, tell an admin what you were doing.</p>
        <button className="primary" onClick={() => window.location.reload()}>Reload</button>
      </div>
    )
  }
}
