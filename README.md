# LSC: traductor de Lengua de Señas Colombiana a texto

Sistema que reconoce señas de la Lengua de Señas Colombiana (LSC) a partir de video, las convierte en una secuencia de glosas y las transforma en una frase natural en español. La app móvil graba la seña, el backend la clasifica y la respuesta se lee en voz alta.

## Cómo funciona

```
App móvil (Expo)  ──video base64──▶  API FastAPI (AWS)
                                        │
                                        ├─ MediaPipe: keypoints de manos y pose (30 frames)
                                        ├─ LSTM bidireccional (PyTorch): clasifica la glosa
                                        └─ Gemini: ordena las glosas en una frase en español
```

- **Reconocimiento:** LSTM bidireccional de 2 capas sobre keypoints de MediaPipe (manos y pose), con 41 glosas.
- **Postproceso:** las glosas se convierten en una frase gramaticalmente correcta con Gemini 2.5 Flash.
- **App:** React Native con Expo (cámara, envío del video y síntesis de voz con `expo-speech`).

## Estructura

| Carpeta | Contenido |
|---|---|
| `Preprosesamiento y Entrenamiento/` | Notebooks de extracción de keypoints y entrenamiento del modelo |
| `AWS/` | API FastAPI, modelo entrenado (`lsc_lstm_best.pth`) y utilidades de MediaPipe |
| `Proyecto LSC/` | App móvil en Expo / React Native |

## Cómo ejecutarlo

### API

```bash
cd AWS
pip install -r requirements.txt
export GEMINI_API_KEY="tu_clave"    # Windows PowerShell: $env:GEMINI_API_KEY="tu_clave"
uvicorn app:app --host 0.0.0.0 --port 8000
```

Endpoints: `POST /predict` (video en base64) y `POST /predict_file` (archivo de video).

### App móvil

```bash
cd "Proyecto LSC"
npm install
npx expo start
```

La app pide la IP y el puerto del servidor donde corre la API.

## Tecnologías

Python, PyTorch, MediaPipe, FastAPI, Gemini API, AWS, React Native, Expo, TypeScript.

## Seguridad

Las claves y llaves (`GEMINI_API_KEY`, archivos `.pem`) no se versionan: se leen de variables de entorno y están en `.gitignore`.
