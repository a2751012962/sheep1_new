from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        nodes = data.get('nodes', [])
        
        # 找到第一个可点击的节点作为示例
        # TODO: 这里将来会替换为 AI 模型的预测逻辑
        for node in nodes:
            if node.get('canClick', False):
                return jsonify({
                    'node': {
                        'id': node['id'],
                        'type': node['type']
                    }
                })
        
        return jsonify({
            'error': 'No clickable nodes available'
        }), 404
        
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True) 