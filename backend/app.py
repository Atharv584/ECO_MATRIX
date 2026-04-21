from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import requests as http_requests
from dxf_processor import process_dxf

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = '/tmp/uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

OLLAMA_BASE_URL = 'http://localhost:11434'

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if file:
        filepath = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(filepath)
        
        # Decompress if file was gzipped by frontend to bypass vercel limits
        if filepath.endswith('.gz'):
            import gzip
            import shutil
            uncompressed_filepath = filepath[:-3]
            try:
                with gzip.open(filepath, 'rb') as f_in:
                    with open(uncompressed_filepath, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
                os.remove(filepath)
                filepath = uncompressed_filepath
            except Exception as e:
                return jsonify({"error": f"Failed to decompress file: {str(e)}"}), 400

        data = process_dxf(filepath)
        if "error" in data:
             return jsonify(data), 500
        return jsonify(data)


@app.route('/api/ollama/status', methods=['GET'])
def ollama_status():
    """Check if Ollama is running."""
    try:
        res = http_requests.get(f'{OLLAMA_BASE_URL}/api/tags', timeout=5)
        return jsonify({"running": res.ok})
    except Exception:
        return jsonify({"running": False})


@app.route('/api/ollama/models', methods=['GET'])
def ollama_models():
    """List available Ollama models."""
    try:
        res = http_requests.get(f'{OLLAMA_BASE_URL}/api/tags', timeout=5)
        if not res.ok:
            return jsonify({"models": [], "error": "Ollama not responding"}), 500
        data = res.json()
        models = [m['name'] for m in data.get('models', [])]
        return jsonify({"models": models})
    except http_requests.exceptions.ConnectionError:
        return jsonify({"models": [], "error": "Cannot connect to Ollama. Run: ollama serve"}), 500
    except Exception as e:
        return jsonify({"models": [], "error": str(e)}), 500


@app.route('/api/chat', methods=['POST'])
def chat():
    """Chat endpoint — supports Gemini, Groq, and Ollama."""
    body = request.get_json()
    if not body:
        return jsonify({"error": "No JSON body"}), 400

    user_message = body.get('message', '')
    context_data = body.get('context', {})
    history = body.get('history', [])
    provider = body.get('provider', 'groq')  # 'groq', 'gemini', or 'ollama'
    model_name = body.get('model', 'llama-3.3-70b-versatile')
    api_key = body.get('apiKey', '')

    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    system_context = _build_system_context(context_data)

    if provider == 'ollama':
        return _chat_ollama(user_message, history, system_context, model_name)
    elif provider == 'groq':
        return _chat_groq(user_message, history, system_context, model_name, api_key)
    else:
        return _chat_gemini(user_message, history, system_context, model_name, api_key)


def _chat_groq(user_message, history, system_context, model_name, api_key):
    """Send chat to Groq API (OpenAI-compatible)."""
    if not api_key:
        return jsonify({"error": "No Groq API key provided."}), 400

    try:
        messages = [{"role": "system", "content": system_context}]
        for msg in history:
            role = "assistant" if msg['role'] == 'model' else msg['role']
            messages.append({"role": role, "content": msg['text']})
        messages.append({"role": "user", "content": user_message})

        res = http_requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json={
                "model": model_name,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 4096,
            },
            timeout=60
        )

        if not res.ok:
            err_data = res.json().get('error', {})
            return jsonify({"error": f"Groq error: {err_data.get('message', res.text)}"}), res.status_code

        reply = res.json()['choices'][0]['message']['content']
        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _chat_gemini(user_message, history, system_context, model_name, api_key):
    """Send chat to Gemini API with auto-retry on rate limit."""
    import time, re

    if not api_key:
        return jsonify({"error": "No Gemini API key provided."}), 400

    from google import genai

    client = genai.Client(api_key=api_key)

    contents = []
    for msg in history:
        contents.append(genai.types.Content(
            role=msg['role'],
            parts=[genai.types.Part(text=msg['text'])]
        ))
    contents.append(genai.types.Content(
        role='user',
        parts=[genai.types.Part(text=user_message)]
    ))

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=genai.types.GenerateContentConfig(
                    system_instruction=system_context,
                    temperature=0.7,
                    max_output_tokens=4096,
                )
            )
            return jsonify({"reply": response.text})

        except Exception as e:
            err_str = str(e)
            if '429' in err_str and attempt < max_retries - 1:
                # Parse retry delay from error
                match = re.search(r'retry in (\d+\.?\d*)', err_str, re.IGNORECASE)
                wait = float(match.group(1)) if match else 30
                wait = min(wait + 2, 60)  # cap at 60s, add 2s buffer
                print(f"[Gemini] Rate limited. Waiting {wait:.0f}s then retrying (attempt {attempt+2}/{max_retries})...")
                time.sleep(wait)
            else:
                return jsonify({"error": err_str}), 500

    return jsonify({"error": "Rate limit exceeded after retries. Please wait a minute and try again."}), 429


def _chat_ollama(user_message, history, system_context, model_name):
    """Send chat to local Ollama."""
    try:
        messages = [{"role": "system", "content": system_context}]
        for msg in history:
            role = "assistant" if msg['role'] == 'model' else msg['role']
            messages.append({"role": role, "content": msg['text']})
        messages.append({"role": "user", "content": user_message})

        res = http_requests.post(
            f'{OLLAMA_BASE_URL}/api/chat',
            json={"model": model_name, "messages": messages, "stream": False,
                  "options": {"temperature": 0.7, "num_predict": 4096}},
            timeout=120
        )
        if not res.ok:
            return jsonify({"error": f"Ollama error: {res.text}"}), 500

        reply = res.json().get('message', {}).get('content', 'No response.')
        return jsonify({"reply": reply})

    except http_requests.exceptions.ConnectionError:
        return jsonify({"error": "Cannot connect to Ollama. Run: ollama serve"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _build_system_context(context_data):
    ctx = """You are a sustainability expert and structural engineering consultant for an RCC (Reinforced Cement Concrete) building project. You analyze Bill of Quantities (BOQ) and carbon emission data to provide:

1. Sustainability reports — summarizing environmental impact
2. Suggestions for reducing carbon footprint — alternative materials, grades, techniques
3. End-of-Life (EOL) recommendations — best disposal/recycling strategies
4. Cost-benefit analysis of greener alternatives
5. Compliance with green building standards (GRIHA, IGBC, LEED)

Be specific, data-driven, and actionable. Use markdown formatting with headings, bullet points, and tables.

"""
    if context_data:
        ctx += "\n--- PROJECT DATA ---\n"
        if context_data.get('concrete'):
            ctx += "\n## Concrete Elements:\n"
            for item in context_data['concrete']:
                ctx += f"- {item.get('element', 'N/A')}: Volume={item.get('volume', 0):.2f} m³, "
                ctx += f"Mass={item.get('mass', 0):.2f} tonnes, Grade={item.get('grade', 'N/A')}, "
                ctx += f"EOL={item.get('eol', 'N/A')}, Factor={item.get('carbonFactor', 0)} kg CO₂e/t, "
                ctx += f"CO₂e={item.get('co2', 0):.4f} tonnes\n"
        if context_data.get('steel'):
            ctx += "\n## Steel Reinforcement:\n"
            for item in context_data['steel']:
                ctx += f"- {item.get('element', 'N/A')}: Steel%={item.get('steelPercent', 0)}%, "
                ctx += f"Mass={item.get('mass', 0):.2f} tonnes, Grade={item.get('grade', 'N/A')}, "
                ctx += f"EOL={item.get('eol', 'N/A')}, Factor={item.get('carbonFactor', 0)} kg CO₂e/t, "
                ctx += f"CO₂e={item.get('co2', 0):.4f} tonnes\n"
        if context_data.get('totals'):
            t = context_data['totals']
            ctx += f"\n## Totals:\n- Concrete CO₂e: {t.get('concreteCO2', 0):.4f} t\n"
            ctx += f"- Steel CO₂e: {t.get('steelCO2', 0):.4f} t\n"
            ctx += f"- Grand Total: {t.get('grandTotal', 0):.4f} t\n"
        ctx += "\n--- END PROJECT DATA ---\n"
    return ctx


if __name__ == '__main__':
    app.run(debug=True, port=5000)
