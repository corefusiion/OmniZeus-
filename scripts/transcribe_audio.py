import base64
import json
import os
import urllib.request

def transcribe():
    audio_path = r'c:\Users\t034183\Desktop\OmniZeus\Audioideia.ogg'
    if not os.path.exists(audio_path):
        print("Audio file not found:", audio_path)
        return

    with open(audio_path, 'rb') as f:
        audio_bytes = f.read()

    b64_audio = base64.b64encode(audio_bytes).decode('utf-8')

    api_key = os.environ.get('OPENROUTER_API_KEY', '')
    if not api_key:
        env_file = r'c:\Users\t034183\Desktop\OmniZeus\.env.local'
        if os.path.exists(env_file):
            with open(env_file, 'r', encoding='utf-8') as ef:
                for line in ef:
                    if line.startswith('OPENROUTER_API_KEY='):
                        api_key = line.strip().split('=', 1)[1].strip('"\'')

    url = 'https://openrouter.ai/api/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }

    # Gemini 2.5 Flash audio transcription inline
    payload = {
        'model': 'google/gemini-2.5-flash',
        'messages': [
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'text', 
                        'text': 'Transcreva na íntegra em português todo o conteúdo em áudio do funcionário/gestor. Em seguida, analise detalhadamente as melhorias e novas funcionalidades solicitadas no áudio para o sistema OmniZeus.'
                    },
                    {
                        'type': 'inline_data',
                        'inline_data': {
                            'mime_type': 'audio/ogg',
                            'data': b64_audio
                        }
                    }
                ]
            }
        ]
    }

    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers)
        with urllib.request.urlopen(req) as resp:
            res_data = json.loads(resp.read().decode('utf-8'))
            print("=== TRANSCRIÇÃO E ANÁLISE DO ÁUDIO ===")
            content = res_data['choices'][0]['message']['content']
            print(content)
            with open(r'c:\Users\t034183\Desktop\OmniZeus\transcricao_audioideia.txt', 'w', encoding='utf-8') as out:
                out.write(content)
    except Exception as e:
        print("API Error:", e)

if __name__ == '__main__':
    transcribe()
