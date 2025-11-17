import React, { useState, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Alert,
  Pressable,
  Platform,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons'; // pode manter (é só ícone) ou trocar por react-native-vector-icons

export default function App() {
  const [status, setStatus] = useState('Segure para falar com a Lyria');
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const ws = useRef<WebSocket | null>(null);

  const start = async () => {
    try {
      chunks.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const options: MediaRecorderOptions = {};
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
      Alert.alert('Microfone', 'Permita o acesso ao microfone');
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
        type: mediaRecorder.current!.mimeType || 'audio/wav',
      });

      if (blob.size < 3000) {
        setStatus('Áudio muito curto');
        return;
      }

      ws.current = new WebSocket('wss://lyria-servicodetranscricao.onrender.com/ws');

      ws.current.onopen = () => ws.current!.send(blob);
      ws.current.onmessage = (e) => {
        const audio = new Blob([e.data], { type: 'audio/mp3' });
        new Audio(URL.createObjectURL(audio)).play();
        setStatus('Lyria respondeu! Segure para falar novamente');
        ws.current?.close();
      };
      ws.current.onerror = () => {
        Alert.alert('Erro', 'Sem conexão com o servidor');
        setStatus('Erro de rede');
      };
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.background} />

      <Text style={styles.title}>Lyria</Text>

      <Pressable
        onPressIn={start}
        onPressOut={stop}
        style={({ pressed }) => [
          styles.button,
          recording && styles.recording,
          pressed && { opacity: 0.9 },
        ]}
      >
        <FontAwesome name="microphone" size={110} color="#fff" />
        {recording && <View style={styles.pulse} />}
      </Pressable>

      <Text style={styles.status}>{status}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f0c29',
  },
  title: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 100,
  },
  button: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#6a11cb',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
  recording: {
    backgroundColor: '#ff0044',
    transform: [{ scale: 1.15 }],
  },
  pulse: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 10,
    borderColor: '#ff0044',
    opacity: 0.5,
  },
  status: {
    marginTop: 70,
    color: '#fff',
    fontSize: 20,
    textAlign: 'center',
    paddingHorizontal: 40,
    fontWeight: '600',
  },
});