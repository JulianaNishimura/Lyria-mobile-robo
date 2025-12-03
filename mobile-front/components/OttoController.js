import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View, PanResponder, Animated, TouchableOpacity, Dimensions } from 'react-native';

const ESP_IP = 'http://192.168.4.1'; // Default IP for ESP32 AP

export default function OttoController() {
  const [mode, setMode] = useState(0); // 0 = Walk, 1 = Roll
  const [connectionStatus, setConnectionStatus] = useState('Desconectado');

  // Joystick State
  const pan = useRef(new Animated.ValueXY()).current;
  const lastSent = useRef(0);

  // Joystick Configuration
  const joyRadius = 75;
  const joyKnobRadius = 30;

  const sendCommand = async (x, y) => {
    try {
      // Mapping: UI is Top (-y), Bottom (+y). Robot might expect Forward (+y).
      // Check original code: "bool forward = RemoteXY.J_y > 0;"
      // In RemoteXY, Up is usually +Y.
      // In React Native PanResponder, Down is +Y.
      // So we invert Y.
      const robotX = Math.round(x);
      const robotY = Math.round(-y);

      await fetch(`${ESP_IP}/cmd?x=${robotX}&y=${robotY}`, { method: 'GET' })
        .then(() => setConnectionStatus('Conectado'))
        .catch(() => setConnectionStatus('Erro de Conexão'));
    } catch (e) {
      setConnectionStatus('Erro de envio');
    }
  };

  const throttleSend = (x, y) => {
    const now = Date.now();
    // Throttle 150ms
    if (now - lastSent.current > 150) {
        // Normalize x,y to -100..100 based on joyRadius
        // Pan x,y are pixels from center.
        let normX = (x / joyRadius) * 100;
        let normY = (y / joyRadius) * 100;

        // Clamp
        normX = Math.max(-100, Math.min(100, normX));
        normY = Math.max(-100, Math.min(100, normY));

        sendCommand(normX, normY);
        lastSent.current = now;
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        {
          useNativeDriver: false,
          listener: (evt, gestureState) => {
             // Limit movement to radius
             let { dx, dy } = gestureState;
             const dist = Math.sqrt(dx * dx + dy * dy);
             if (dist > joyRadius) {
                 const ratio = joyRadius / dist;
                 dx *= ratio;
                 dy *= ratio;
                 // Manually set value because we are clamping
                 pan.setValue({ x: dx, y: dy });
             }
             throttleSend(dx, dy);
          }
        }
      ),
      onPanResponderRelease: () => {
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
        sendCommand(0, 0); // Stop
      },
    })
  ).current;

  const setRobotMode = async (newMode) => {
    setMode(newMode);
    try {
        await fetch(`${ESP_IP}/setMode?mode=${newMode}`);
    } catch(e) {
        console.log("Error setting mode");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Otto Ninja Controller</Text>
      <Text style={styles.status}>{connectionStatus}</Text>

      {/* Mode Switch */}
      <View style={styles.modeContainer}>
        <TouchableOpacity
            style={[styles.modeBtn, mode === 0 && styles.activeMode]}
            onPress={() => setRobotMode(0)}>
            <Text style={styles.btnText}>ANDAR</Text>
        </TouchableOpacity>
        <TouchableOpacity
            style={[styles.modeBtn, mode === 1 && styles.activeMode]}
            onPress={() => setRobotMode(1)}>
            <Text style={styles.btnText}>ROLAR</Text>
        </TouchableOpacity>
      </View>

      {/* Joystick Area */}
      <View style={styles.joyPad}>
        <View style={styles.joyBase}>
            <Animated.View
            style={{
                transform: pan.getTranslateTransform(),
            }}
            {...panResponder.panHandlers}
            >
                <View style={styles.joyKnob} />
            </Animated.View>
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    width: '100%',
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  status: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 20,
  },
  modeContainer: {
    flexDirection: 'row',
    marginBottom: 40,
  },
  modeBtn: {
    backgroundColor: '#333',
    padding: 15,
    marginHorizontal: 10,
    borderRadius: 8,
    width: 100,
    alignItems: 'center',
  },
  activeMode: {
    backgroundColor: '#ff4747',
  },
  btnText: {
    color: 'white',
    fontWeight: 'bold',
  },
  joyPad: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  joyBase: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  joyKnob: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
});
