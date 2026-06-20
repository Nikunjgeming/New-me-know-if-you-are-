from flask import Flask, request, jsonify
import hmac
import hashlib
import json
import logging

app = Flask(__name__)

# Configuration
WEBHOOK_SECRET = "your_webhook_secret_here"  # Get from QuickNum
API_KEY = "695d3308c261443fc6e2084f4d0599baa323d8f1"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/webhook', methods=['POST'])
def webhook():
    """Handle SMS webhook notifications"""
    body = request.get_data(as_text=True)
    sig = request.headers.get('X-NGS-Signature', '')
    
    # Verify signature
    expected = "sha256=" + hmac.new(
        WEBHOOK_SECRET.encode(),
        body.encode(),
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(expected, sig):
        return jsonify({'error': 'Invalid signature'}), 401
    
    try:
        data = json.loads(body)
        if data.get('event') == 'sms.received':
            sms_data = data.get('data', {})
            logger.info(f"SMS received: {sms_data}")
            
            # You can send notification here
            # Example: Send to Telegram, Email, etc.
            
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return jsonify({'error': 'Processing failed'}), 500
    
    return jsonify({'status': 'success'}), 200

@app.route('/')
def home():
    return jsonify({
        'status': 'running',
        'service': 'QuickSMS Webhook'
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)