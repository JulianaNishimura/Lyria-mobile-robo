import React, { useState, useRef } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome } from '@expo/vector-icons';
import * as Speech from 'expo-speech';

export default function App() {
  const [appState, setAppState] = useState('idle');
  const [statusMsg, setStatusMsg] = useState('Pressione para gravar');
  const ws = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunks.current = [];

      setAppState('recording');
      setStatusMsg('🎙️ Gravando...');

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.current.push(event.data);
      };

      mediaRecorder.start();
    } catch (err) {
      console.error('Erro ao acessar microfone:', err);
      alert('Não foi possível acessar o microfone.');
      setAppState('idle');
    }
  }

  async function stopRecording() {
    if (!mediaRecorderRef.current) return;

    setAppState('processing');
    setStatusMsg('⏳ Processando...');
    mediaRecorderRef.current.stop();

    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(audioChunks.current, { type: 'audio/webm' });

      if (blob.size === 0) {
        alert('Nenhum áudio foi gravado.');
        setAppState('idle');
        setStatusMsg('Pressione para gravar');
        return;
      }

      ws.current = new WebSocket('wss://lyria-servicodetranscricao.onrender.com/ws');

      ws.current.onopen = async () => {
        const arrayBuffer = await blob.arrayBuffer();
        ws.current.send(arrayBuffer);
      };

      ws.current.onmessage = (event) => {
        const respostaTexto = event.data;

        setStatusMsg(`IA: ${respostaTexto}`);
        Speech.speak(respostaTexto, {
          language: 'pt-BR',
          pitch: 1.05,
          rate: 0.95,
        });

        setAppState('idle');
        ws.current.close();
      };

      ws.current.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
        alert('Erro ao enviar áudio para o servidor.');
        setAppState('idle');
        setStatusMsg('Pressione para gravar');
      };
    };
  }

  function handleRecordButtonPress() {
    if (appState === 'recording') {
      stopRecording();
    } else if (appState === 'idle') {
      startRecording();
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1d294d', '#000000']} style={styles.background} />
      <View style={styles.micContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.micButton,
            appState === 'recording' && styles.micButtonRecording,
            pressed && styles.micButtonPressed,
          ]}
          onPress={handleRecordButtonPress}
          disabled={appState === 'processing'}
        >
          <FontAwesome
            name="microphone"
            size={100}
            color={appState === 'recording' ? '#ff4747' : '#ffffff'}
          />
        </Pressable>
      </View>
      <Text style={styles.statusText}>{statusMsg}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  background: { position: 'absolute', left: 0, right: 0, top: 0, height: '100%' },
  micContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 10,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  micButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#3b4a74',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 20,
  },
  micButtonRecording: { backgroundColor: '#5a2a2a' },
  micButtonPressed: { backgroundColor: '#2c385a' },
  statusText: {
    marginTop: 30,
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
