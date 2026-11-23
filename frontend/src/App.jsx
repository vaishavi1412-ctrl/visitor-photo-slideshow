import { useEffect, useState } from 'react';

function App() {
  const [status, setStatus] = useState('Checking backend...');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(`Backend says: ${data.status}`))
      .catch(() => setStatus('Backend is not reachable'));
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Visitor Photo Slideshow</h1>
      <p>{status}</p>
    </div>
  );
}

export default App;