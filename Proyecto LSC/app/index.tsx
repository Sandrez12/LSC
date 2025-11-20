// app/index.tsx - VERSIÓN FINAL CON DISEÑO PREMIUM 2025
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import axios from 'axios';

export default function LSCTranslator() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const cameraRef = useRef<any>(null);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState('');
  const [glosas, setGlosas] = useState<string[]>([]);
  const [confianzas, setConfianzas] = useState<number[]>([]);
  const [ip, setIp] = useState('107.22.118.192');
  const [port] = useState('8080');
  const [isRecordingReady, setIsRecordingReady] = useState(false);
  const API_URL = `http://${ip}:${port}/predict`;

  // Animaciones suaves
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => setIsRecordingReady(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (recording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [recording]);

  if (cameraPermission === null || micPermission === null) {
    return <View style={styles.container}><Text style={styles.permissionText}>Cargando permisos...</Text></View>;
  }

  if (!cameraPermission.granted || !micPermission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          {!cameraPermission.granted ? 'Necesitamos acceso a la cámara' : 'Necesitamos permiso del micrófono'}
        </Text>
        <TouchableOpacity
          onPress={!cameraPermission.granted ? requestCameraPermission : requestMicPermission}
          style={styles.permissionButton}
        >
          <Text style={styles.permissionButtonText}>Permitir acceso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const startRecording = async () => {
    if (recording || !cameraRef.current || !isRecordingReady) return;
    if (!ip.trim()) {
      Alert.alert('Error', 'Ingresa la IP del servidor');
      return;
    }

    setRecording(true);
    setResult('');
    setGlosas([]);
    setConfianzas([]);

    try {
      const videoPromise = cameraRef.current.recordAsync({ maxDuration: 5 });
      await new Promise(resolve => setTimeout(resolve, 1500));
      const video = await videoPromise;

      if (video?.uri) {
        const fileInfo = await FileSystem.getInfoAsync(video.uri);
        if (fileInfo.exists && 'size' in fileInfo && fileInfo.size > 0) {
          await processVideo(video.uri);
        } else {
          throw new Error('Video vacío. Graba más tiempo.');
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo grabar');
    } finally {
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && recording) cameraRef.current.stopRecording();
  };

  const processVideo = async (uri: string) => {
    setProcessing(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const response = await axios.post(API_URL, { file: base64 }, { timeout: 60000 });

      if (response.data.success) {
        setGlosas(response.data.glosas_detectadas || []);
        setConfianzas(response.data.confianzas || []);
        setResult(response.data.frase_natural || 'Seña reconocida');
      } else {
        setResult(response.data.error || 'No se reconoció');
      }
    } catch (error: any) {
      setResult('Error de conexión');
      Alert.alert('Error', error.response?.data?.error || error.message || 'No se pudo conectar');
    } finally {
      setProcessing(false);
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" mode="video" active={true} />

          {/* Overlay principal con degradado hermoso */}
          <View style={styles.overlay}>
            {/* Título premium */}
            <Text style={styles.title}>Traductor LSC → Español</Text>
            <Text style={styles.subtitle}>Lengua de Señas Colombiana en tiempo real</Text>

            {/* Banner de inicialización */}
            {!isRecordingReady && (
              <View style={styles.initBanner}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.initText}>Preparando la magia...</Text>
              </View>
            )}

            {/* Input de IP estilo tarjeta moderna */}
            <View style={styles.ipCard}>
              <Text style={styles.ipLabel}>IP del servidor</Text>
              <TextInput
                style={styles.ipInput}
                value={ip}
                onChangeText={setIp}
                placeholder="107.22.118.192"
                placeholderTextColor="#999"
                keyboardType="numeric"
                editable={!recording && !processing}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>

            {/* Estado actual */}
            <Text style={styles.statusText}>
              {recording ? 'Grabando... (mínimo 2 seg)' : 'Presiona y haz tu seña'}
            </Text>

            {/* Procesando */}
            {processing && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color="#00ff88" />
                <Text style={styles.processingText}>Analizando tu seña...</Text>
              </View>
            )}

            {/* Resultado final - tarjeta espectacular */}
            {result ? (
              <Animated.View style={[styles.resultCard, { transform: [{ scale: scaleAnim }] }]}>
                <Text style={styles.checkIcon}>Checkmark</Text>

                {glosas.length > 0 && (
                  <>
                    <Text style={styles.glosasText}>Glosas detectadas</Text>
                    <Text style={styles.glosas}>{glosas.join(' → ')}</Text>
                    {confianzas.length > 0 && (
                      <Text style={styles.confianza}>
                        Confianza: {(confianzas[0] * 100).toFixed(1)}%
                      </Text>
                    )}
                  </>
                )}

                <Text style={styles.fraseFinal}>{result}</Text>

                <TouchableOpacity
                  style={styles.newButton}
                  onPress={() => {
                    Animated.spring(scaleAnim, { toValue: 1.1, useNativeDriver: true }).start(() => scaleAnim.setValue(1));
                    setResult(''); setGlosas([]); setConfianzas([]);
                  }}
                >
                  <Text style={styles.newText}>Nueva seña</Text>
                </TouchableOpacity>
              </Animated.View>
            ) : (
              /* Botón de grabación con pulso */
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity
                  style={[
                    styles.recordButton,
                    recording && styles.recordingActive,
                    !isRecordingReady && styles.buttonDisabled,
                  ]}
                  onPress={recording ? stopRecording : startRecording}
                  disabled={processing || !isRecordingReady}
                  activeOpacity={0.8}
                >
                  <Text style={styles.recordText}>
                    {recording ? 'Detener' : 'Grabar'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

/* ===================== ESTILOS PREMIUM 2025 ===================== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 20 },
  permissionText: { color: '#fff', fontSize: 20, textAlign: 'center', marginBottom: 30, fontWeight: '600' },
  permissionButton: { backgroundColor: '#0066ff', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 16 },
  permissionButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 60,
    backgroundColor: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%)',
  },

  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 20,
    fontWeight: '500',
    letterSpacing: 0.5,
  },

  initBanner: {
    flexDirection: 'row',
    backgroundColor: '#ff6b00',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    gap: 10,
    marginBottom: 16,
    shadowColor: '#ff6b00',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  initText: { color: '#fff', fontWeight: 'bold' },

  ipCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 16,
    borderRadius: 20,
    width: '88%',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 12,
  },
  ipLabel: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  ipInput: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    fontSize: 18,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
  },

  statusText: {
    fontSize: 17,
    color: '#fff',
    marginBottom: 30,
    fontWeight: '600',
    textShadowColor: '#000',
    textShadowRadius: 4,
  },

  recordButton: {
    backgroundColor: '#ff0033',
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff0033',
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 20,
  },
  recordingActive: { backgroundColor: '#ff0033', shadowColor: '#ff0033' },
  buttonDisabled: { backgroundColor: '#666', shadowOpacity: 0.3 },
  recordText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  processingContainer: { alignItems: 'center', marginBottom: 30 },
  processingText: { color: '#00ff88', fontSize: 20, marginTop: 16, fontWeight: 'bold' },

  resultCard: {
    backgroundColor: 'rgba(10,10,10,0.92)',
    padding: 32,
    borderRadius: 28,
    alignItems: 'center',
    width: '92%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#00ff88',
    shadowColor: '#00ff88',
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
  },
  checkIcon: { fontSize: 80, marginBottom: 10 },
  glosasText: { color: '#aaa', fontSize: 14, marginBottom: 4 },
  glosas: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  confianza: { color: '#00ff88', fontSize: 16, fontWeight: 'bold', marginBottom: 16 },
  fraseFinal: {
    color: '#00ff88',
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 44,
    textShadowColor: '#00ff88',
    textShadowRadius: 10,
  },

  newButton: {
    marginTop: 24,
    backgroundColor: '#0066ff',
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 30,
  },
  newText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
});