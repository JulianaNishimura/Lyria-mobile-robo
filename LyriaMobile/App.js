import React, { useState, useRef } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
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
      console.log('🎧 Tamanho do áudio:', blob.size);

      if (blob.size === 0) {
        alert('Nenhum áudio foi gravado.');
        setAppState('idle');
        setStatusMsg('Pressione para gravar');
        return;
      }

      // Abre conexão com o backend
      ws.current = new WebSocket('wss://lyria-servicodetranscricao.onrender.com/ws');

      ws.current.onopen = async () => {
        console.log('✅ WebSocket conectado.');
        const arrayBuffer = await blob.arrayBuffer();
        ws.current.send(arrayBuffer);
        console.log('🎤 Áudio enviado ao servidor.');
      };

      ws.current.onmessage = (event) => {
        const respostaTexto = event.data;
        console.log('🧠 Resposta de texto recebida:', respostaTexto);

        setStatusMsg(`IA: ${respostaTexto}`);
        speakText(respostaTexto); // 🔊 Fala o texto com voz natural
        setAppState('idle');
        ws.current.close();
      };

      ws.current.onerror = (error) => {
        console.error('🚨 Erro no WebSocket:', error);
        alert('Erro ao enviar áudio para o servidor.');
        setAppState('idle');
        setStatusMsg('Pressione para gravar');
      };
    };
  }

  function speakText(text) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.pitch = 1;
      utterance.rate = 1;
      utterance.volume = 1;
      speechSynthesis.cancel(); // Interrompe falas anteriores
      speechSynthesis.speak(utterance);
    } else {
      console.error('Este navegador não suporta a síntese de voz.');
    }
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
    backgroundColor: 'transparent',
  },
  micButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#3b4a74',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 13.16,
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
