import React, { useState, useRef } from 'react';
import { View, Pressable, Text, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome } from '@expo/vector-icons';

export default function App() {
  const [appState, setAppState] = useState('idle');
  const [statusMsg, setStatusMsg] = useState('Pressione para gravar');
  const ws = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/wav' };
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunks.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      mediaRecorder.start();
      setAppState('recording');
      setStatusMsg('Gravando...');
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível acessar o microfone.');
      setAppState('idle');
    }
  }

  function stopRecording() {
    if (!mediaRecorderRef.current) return;

    setAppState('processing');
    setStatusMsg('Enviando...');

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());

    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(audioChunks.current, { type: 'audio/wav' });
      if (blob.size < 1000) {
        setStatusMsg('Áudio muito curto');
        setAppState('idle');
        return;
      }

      ws.current = new WebSocket('wss://lyria-servicodetranscricao.onrender.com/ws');

      ws.current.onopen = () => {
        ws.current.send(blob);
        setStatusMsg('Processando no servidor...');
      };

      ws.current.onmessage = (event) => {
        const audioBlob = new Blob([event.data], { type: 'audio/mp3' });
        const url = URL.createObjectURL(audioBlob);
        new Audio(url).play();
        setStatusMsg('Pronto');
        setAppState('idle');
        ws.current.close();
      };

      ws.current.onerror = () => {
        Alert.alert('Erro', 'Falha na conexão com o servidor');
        setAppState('idle');
        setStatusMsg('Pressione para gravar');
      };
    };
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1d294d', '#000000']} style={styles.background} />
      <View style={styles.micContainer}>
        <Pressable
          onPressIn={appState === 'idle' ? startRecording : null}
          onPressOut={appState === 'recording' ? stopRecording : null}
          disabled={appState === 'processing'}
          style={({ pressed }) => [
            styles.micButton,
            appState === 'recording' && styles.recording,
            pressed && styles.pressed,
          ]}
        >
          <FontAwesome
            name="microphone"
            size={100}
            color={appState === 'recording' ? '#ff3333' : '#ffffff'}
          />
        </Pressable>
      </View>
      <Text style={styles.statusText}>{statusMsg}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  background: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  micContainer: { padding: 20 },
  micButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#3b5998',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
  },
  recording: { backgroundColor: '#8B0000' },
  pressed: { opacity: 0.8 },
  statusText: { marginTop: 30, color: '#fff', fontSize: 20, fontWeight: 'bold' },
});