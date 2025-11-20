# mediapipe_utils.py - CORREGIDO
import cv2
import mediapipe as mp
import numpy as np
import tempfile
import os

mp_hands = mp.solutions.hands
mp_pose = mp.solutions.pose

hands = mp_hands.Hands(static_image_mode=False, max_num_hands=2,
                       min_detection_confidence=0.5, min_tracking_confidence=0.5)
pose = mp_pose.Pose(static_image_mode=False,
                    min_detection_confidence=0.5, min_tracking_confidence=0.5)

def video_to_keypoints_sequence(video_bytes, num_frames=30):
    """
    Convierte bytes de video a secuencia de keypoints.
    
    Args:
        video_bytes: bytes del video MP4
        num_frames: número de frames a extraer (default 30)
    
    Returns:
        numpy array de shape (num_frames, 225) o None si falla
    """
    # ✅ Guarda temporalmente el video en disco
    temp_file = None
    try:
        # Crea archivo temporal
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
        temp_file.write(video_bytes)
        temp_file.close()
        
        print(f"📹 Video guardado temporalmente: {temp_file.name}")
        
        # Abre el video con OpenCV
        cap = cv2.VideoCapture(temp_file.name)
        
        if not cap.isOpened():
            print("❌ Error: No se pudo abrir el video")
            return None

        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        print(f"📊 Video: {total} frames, {fps} FPS")
        
        if total < 1:
            print("❌ Error: Video sin frames")
            cap.release()
            return None

        # Selecciona frames uniformemente distribuidos
        indices = np.linspace(0, max(total-1, 0), num_frames, dtype=int)
        seq = []

        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            
            if not ret:
                print(f"⚠️ No se pudo leer frame {idx}")
                continue
                
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Procesa con MediaPipe
            h_res = hands.process(rgb)
            p_res = pose.process(rgb)

            # Vector de pose (33 landmarks × 3 coords = 99 valores)
            pose_vec = np.zeros(99)
            if p_res.pose_landmarks:
                for i, lm in enumerate(p_res.pose_landmarks.landmark):
                    pose_vec[i*3:i*3+3] = [lm.x, lm.y, lm.z]

            # Vector de manos (2 manos × 21 landmarks × 3 coords = 126 valores)
            hand_vec = np.zeros(126)
            if h_res.multi_hand_landmarks:
                for hi, hand in enumerate(h_res.multi_hand_landmarks[:2]):
                    for i, lm in enumerate(hand.landmark):
                        offset = hi * 63 + i * 3
                        hand_vec[offset:offset+3] = [lm.x, lm.y, lm.z]

            # Concatena: 99 + 126 = 225 valores por frame
            seq.append(np.concatenate([pose_vec, hand_vec]))

        cap.release()
        
        print(f"✅ Extraídos {len(seq)} frames")
        
        # Verifica que tengamos exactamente num_frames
        if len(seq) != num_frames:
            print(f"⚠️ Se esperaban {num_frames} frames, se obtuvieron {len(seq)}")
            # Rellena con ceros si faltan frames
            while len(seq) < num_frames:
                seq.append(np.zeros(225))
        
        result = np.array(seq)
        print(f"📦 Shape final: {result.shape}")
        
        return result
        
    except Exception as e:
        print(f"❌ Error procesando video: {e}")
        import traceback
        traceback.print_exc()
        return None
        
    finally:
        # Limpia archivo temporal
        if temp_file and os.path.exists(temp_file.name):
            try:
                os.unlink(temp_file.name)
                print(f"🗑️ Archivo temporal eliminado: {temp_file.name}")
            except Exception as e:
                print(f"⚠️ No se pudo eliminar temporal: {e}")