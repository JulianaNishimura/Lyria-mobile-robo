import React, { useState, useRef } from 'react';

export default function App() {
  const [status, setStatus] = useState('Segure para falar com a Lyria');
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef(null);
  const chunks = useRef([]);
  const ws = useRef(null);

  const start = async () => {
    try {
      chunks.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const options = {};
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        options.mimeType = 'audio/wav';
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorder.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.start();
      setRecording(true);
      setStatus('Gravando... solte para enviar');
    } catch (err) {
      console.error('Erro no microfone:', err);
      alert('Permita o acesso ao microfone');
      setStatus('Erro no microfone');
    }
  };

  const stop = () => {
    if (!mediaRecorder.current || !recording) return;

    mediaRecorder.current.stop();
    mediaRecorder.current.stream.getTracks().forEach(t => t.stop());
    setRecording(false);
    setStatus('Enviando para Lyria...');

    mediaRecorder.current.onstop = async () => {
      const blob = new Blob(chunks.current, {
        type: mediaRecorder.current.mimeType || 'audio/wav',
      });

      console.log('Audio blob size:', blob.size, 'type:', blob.type);

      if (blob.size < 3000) {
        setStatus('Áudio muito curto');
        return;
      }

      try {
        ws.current = new WebSocket('wss://lyria-servicodetranscricao.onrender.com/ws');

        ws.current.onopen = () => {
          console.log('WebSocket conectado, enviando áudio...');
          ws.current.send(blob);
        };

        ws.current.onmessage = (e) => {
          console.log('Resposta recebida');
          try {
            const audio = new Blob([e.data], { type: 'audio/mp3' });
            const audioUrl = URL.createObjectURL(audio);
            const audioElement = new Audio(audioUrl);
            
            audioElement.play().then(() => {
              console.log('Reproduzindo resposta');
              setStatus('Lyria respondeu! Segure para falar novamente');
            }).catch(err => {
              console.error('Erro ao reproduzir:', err);
              setStatus('Erro ao reproduzir resposta');
            });

            audioElement.onended = () => {
              URL.revokeObjectURL(audioUrl);
            };
          } catch (err) {
            console.error('Erro ao processar resposta:', err);
            setStatus('Erro ao processar resposta');
          }
          ws.current?.close();
        };

        ws.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          alert('Sem conexão com o servidor');
          setStatus('Erro de rede');
        };

        ws.current.onclose = () => {
          console.log('WebSocket fechado');
        };
      } catch (err) {
        console.error('Erro ao conectar:', err);
        setStatus('Erro de conexão');
      }
    };
  };

  return (
    <div style={styles.container}>
      <div style={styles.background} />

      <h1 style={styles.title}>Lyria</h1>

      <button
        onMouseDown={start}
        onMouseUp={stop}
        onTouchStart={start}
        onTouchEnd={stop}
        style={{
          ...styles.button,
          ...(recording ? styles.recording : {}),
        }}
      >
        <svg 
          width="110" 
          height="110" 
          viewBox="0 0 24 24" 
          fill="white"
        >
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
        {recording && <div style={styles.pulse} />}
      </button>

      <p style={styles.status}>{status}</p>
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
    zIndex: -1,
  },
  title: {
    color: '#fff',
    fontSize: '48px',
    fontWeight: 'bold',
    marginBottom: '100px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  button: {
    position: 'relative',
    width: '220px',
    height: '220px',
    borderRadius: '110px',
    backgroundColor: '#6a11cb',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
    transition: 'all 0.3s ease',
  },
  recording: {
    backgroundColor: '#ff0044',
    transform: 'scale(1.15)',
  },
  pulse: {
    position: 'absolute',
    width: '260px',
    height: '260px',
    borderRadius: '130px',
    border: '10px solid #ff0044',
    opacity: 0.5,
    animation: 'pulse 1.5s infinite',
  },
  status: {
    marginTop: '70px',
    color: '#fff',
    fontSize: '20px',
    textAlign: 'center',
    padding: '0 40px',
    fontWeight: '600',
    maxWidth: '600px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
};