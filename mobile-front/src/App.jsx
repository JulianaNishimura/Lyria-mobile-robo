import { useState, useRef } from "react";

export default function App() {
  const [gravando, setGravando] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const WS_URL = "wss://lyria-servicodetranscricao.onrender.com/ws"; 

  async function iniciarGravacao() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunksRef.current = [];

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "audio/webm" // compatível com navegadores
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = enviarAudio;

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setGravando(true);
  }

  function pararGravacao() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setGravando(false);
    }
  }

  function enviarAudio() {
    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const reader = new FileReader();

    reader.onloadend = async () => {
      const buffer = reader.result;

      const socket = new WebSocket(WS_URL);

      socket.binaryType = "arraybuffer";

      socket.onopen = () => {
        socket.send(buffer); 
      };

      socket.onmessage = (event) => {
        const audioBytes = new Uint8Array(event.data);
        tocarAudio(audioBytes);
      };

      socket.onerror = (err) => {
        console.error("WebSocket error:", err);
      };
    };

    reader.readAsArrayBuffer(blob);
  }

  function tocarAudio(bytes) {
    const blob = new Blob([bytes], { type: "audio/mp3" });
    const url = URL.createObjectURL(blob);

    const audio = new Audio(url);
    audio.play();
  }

  return (
    <div style={{ textAlign: "center", marginTop: "80px" }}>
      <h1>🎤 Lyria Voice</h1>
      {!gravando ? (
        <button
          onClick={iniciarGravacao}
          style={{
            padding: "15px 30px",
            fontSize: "18px",
            background: "green",
            color: "white",
            borderRadius: "8px",
            border: "none",
          }}
        >
          Iniciar Gravação
        </button>
      ) : (
        <button
          onClick={pararGravacao}
          style={{
            padding: "15px 30px",
            fontSize: "18px",
            background: "red",
            color: "white",
            borderRadius: "8px",
            border: "none",
          }}
        >
          Parar & Enviar
        </button>
      )}
    </div>
  );
}
