import { useInstall } from '../lib/install'

export default function Install() {
  const { canPrompt, installed, prompt } = useInstall()
  return (
    <>
      <h1>Get the app</h1>
      <p className="muted">Install The Smugglr on your phone or laptop. It opens full screen like any other app and keeps you signed in.</p>
      {installed && <p className="panel">You're already using the installed app.</p>}
      {!installed && canPrompt && <p><button className="primary" onClick={() => void prompt()}>Install app</button></p>}
      <div className="panel"><h3>Android (Chrome)</h3><p>Open the menu (the three dots), then choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p></div>
      <div className="panel"><h3>iPhone and iPad (Safari)</h3><p>Tap the Share button, then <strong>Add to Home Screen</strong>.</p></div>
      <div className="panel"><h3>Laptop (Chrome or Edge)</h3><p>Click the install icon at the right end of the address bar, or open the browser menu and choose <strong>Install</strong>.</p></div>
    </>
  )
}
