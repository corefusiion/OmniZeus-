import speech_recognition as sr
import os

def transcribe_wav():
    wav_path = r'c:\Users\t034183\Desktop\OmniZeus\Audioideia.wav'
    r = sr.Recognizer()
    
    with sr.AudioFile(wav_path) as source:
        audio = r.record(source)
        
    try:
        text = r.recognize_google(audio, language='pt-BR')
        print("=== TRANSCRIÇÃO DE ÁUDIO (GOOGLE SPEECH) ===")
        print(text)
        with open(r'c:\Users\t034183\Desktop\OmniZeus\transcricao_audioideia.txt', 'w', encoding='utf-8') as out:
            out.write(text)
    except Exception as e:
        print("Speech Recognition Error:", e)

if __name__ == '__main__':
    transcribe_wav()
