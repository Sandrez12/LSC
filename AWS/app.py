# app.py
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
import torch.nn as nn
import json
import numpy as np
import base64
import google.generativeai as genai
from mediapipe_utils import video_to_keypoints_sequence

# ========================= CONFIG =========================
genai.configure(api_key="AIzaSyCGVF4Wo9LTsG4z_TDogq640MdNVmlItP4")
gemini = genai.GenerativeModel("gemini-2.5-flash")

with open("label_map.json") as f:
    idx2glosa = {int(k): v for k, v in json.load(f).items()}

# Modelo LSTM
class SignLSTM(nn.Module):
    def __init__(self, input_size=225, hidden_size=128, num_classes=len(idx2glosa)):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers=2,
                            batch_first=True, dropout=0.3, bidirectional=True)
        self.dropout = nn.Dropout(0.5)
        self.fc = nn.Linear(hidden_size*2, num_classes)
    def forward(self, x):
        out, _ = self.lstm(x)
        return self.fc(self.dropout(out[:, -1, :]))

model = SignLSTM()
model.load_state_dict(torch.load("lsc_lstm_best.pth", map_location="cpu"))
model.eval()

# ========================= FASTAPI =========================
app = FastAPI(title="LSC → Texto (Secuencia + Gemini 2.5 Flash)")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ✅ Modelo para recibir base64
class VideoRequest(BaseModel):
    file: str  # Acepta base64 con o sin prefijo data:video/mp4;base64,

def predict_sequence(keypoints_seq):
    with torch.no_grad():
        tensor = torch.FloatTensor(keypoints_seq).unsqueeze(0)
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1)
        topk = torch.topk(probs, k=3, dim=1)
        indices = topk.indices[0].cpu().numpy()
        confidences = topk.values[0].cpu().numpy()
        return [(idx2glosa[idx], float(conf)) for idx, conf in zip(indices, confidences)]

def gemini_postprocess(glosas):
    prompt = f"""Convierte esta secuencia de glosas en Lengua de Señas Colombiana (LSC) a una frase natural y correcta en español.
Solo responde la frase final, sin explicaciones ni glosas.

Ejemplos:
HOLA YO IR CASA → Hola, yo voy a casa.
BUENAS-NOCHES TÚ DORMIR YA → Buenas noches, ya te vas a dormir.

Glosas detectadas: {' '.join(glosas)}
Frase natural:"""
    resp = gemini.generate_content(prompt, generation_config={"temperature": 0.2})
    return resp.text.strip().strip('"').strip()

@app.get("/")
async def root():
    return {"message": "LSC → Texto con Gemini 2.5 Flash listo!"}

# ✅ Endpoint que acepta JSON con base64
@app.post("/predict")
async def predict(request: VideoRequest):
    try:
        print("=" * 60)
        print("📥 Nueva solicitud recibida")
        
        # Decodifica base64
        base64_str = request.file
        print(f"📊 Longitud base64: {len(base64_str)} caracteres")
        
        # Elimina el prefijo si existe
        if base64_str.startswith('data:'):
            base64_str = base64_str.split(',', 1)[1]
            print("✂️ Prefijo data: eliminado")
        
        video_bytes = base64.b64decode(base64_str)
        print(f"✅ Video decodificado: {len(video_bytes)} bytes")
        
        # Procesa el video
        print("🔄 Procesando video con MediaPipe...")
        seq = video_to_keypoints_sequence(video_bytes, num_frames=30)
        
        if seq is None:
            print("❌ Error: video_to_keypoints_sequence retornó None")
            return {
                "error": "No se pudo procesar el video. Verifica que sea un MP4 válido con señas visibles.",
                "success": False
            }

        print(f"✅ Secuencia extraída: shape {seq.shape}")
        
        # Detectar glosas
        print("🔄 Prediciendo glosas con LSTM...")
        top3 = predict_sequence(seq)
        glosas = [g for g, c in top3]
        print(f"✅ Glosas detectadas: {glosas}")
        print(f"📊 Confianzas: {[round(c, 3) for _, c in top3]}")

        # Gemini convierte a frase natural
        print("🔄 Generando frase natural con Gemini...")
        frase = gemini_postprocess(glosas)
        print(f"✅ Frase final: {frase}")
        print("=" * 60)

        return {
            "glosas_detectadas": glosas,
            "confianzas": [round(c, 3) for _, c in top3],
            "frase_natural": frase,
            "success": True
        }
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return {
            "error": f"Error del servidor: {str(e)}",
            "success": False
        }

# ✅ Mantén el endpoint original para compatibilidad
@app.post("/predict_file")
async def predict_file(file: UploadFile = File(...)):
    video_bytes = await file.read()
    seq = video_to_keypoints_sequence(video_bytes, num_frames=30)
    
    if seq is None:
        return {"error": "No se pudo procesar el video", "success": False}

    top3 = predict_sequence(seq)
    glosas = [g for g, c in top3]
    frase = gemini_postprocess(glosas)

    return {
        "glosas_detectadas": glosas,
        "confianzas": [round(c, 3) for _, c in top3],
        "frase_natural": frase,
        "success": True
    }