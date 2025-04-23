# 羊了个羊 AI 服务器

这是一个基于 Flask 的 AI 预测服务器，用于为羊了个羊游戏提供智能提示功能。

## 安装依赖

```bash
pip install -r requirements.txt
```

## 运行服务器

```bash
python app.py
```

服务器将在 http://localhost:5000 上运行。

## API 接口

### POST /predict

接收游戏当前状态，返回推荐点击的节点。

请求体示例:
```json
{
  "nodes": [
    {
      "id": 1,
      "type": "sheep",
      "canClick": true
    }
  ]
}
```

响应示例:
```json
{
  "node": {
    "id": 1,
    "type": "sheep"
  }
}
```

如果没有可点击的节点，将返回:
```json
{
  "error": "No clickable nodes available"
}
``` 