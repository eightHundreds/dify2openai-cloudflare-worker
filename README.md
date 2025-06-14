# dify2openai-cloudflare-worker

本项目是一个将 Dify API 代理为 OpenAI API 兼容接口的 Cloudflare Worker。

## 快速部署

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/eightHundreds/dify2openai-cloudflare-worker)

点击上方按钮即可一键部署到 Cloudflare Workers。

## Dify 配置说明

1. 在Dify上创建一个ChatFlow
2. 选好你的模型
3. 其他配置不要动


## 环境变量配置

在 Cloudflare Worker 的环境变量中设置以下变量：

- `DIFY_API_URL`：Dify API 地址（如：https://api.dify.ai/v1）
- `BOT_TYPE`：Bot 类型（可选值：Chat、Completion、Workflow，默认 Chat）
- `INPUT_VARIABLE`：输入变量名（Workflow/Completion 模式下必填）
- `OUTPUT_VARIABLE`：输出变量名（Workflow/Completion 模式下必填）

## 部署

### 方式一：一键部署（推荐）

点击上方的 "Deploy to Cloudflare Workers" 按钮即可快速部署。

### 方式二：手动部署

1. 将 `worker.js` 上传到 Cloudflare Worker。
2. 配置上述环境变量。
3. 发布 Worker。

## API 说明

### 获取模型列表

```
GET /v1/models
```

返回示例：

```json
{
  "object": "list",
  "data": [
    {
      "id": "dify",
      "object": "model",
      "owned_by": "dify",
      "permission": null
    }
  ]
}
```

### 聊天接口（兼容 OpenAI）

```
POST /v1/chat/completions
Authorization: Bearer <你的 Dify API Key>
Content-Type: application/json
```

请求体示例：

```json
{
  "model": "dify",
  "messages": [
    {"role": "user", "content": "你好"}
  ],
  "stream": false
}
```

返回体与 OpenAI API 兼容。

### 主页

访问 `/` 路径可查看部署成功页面。

## 注意事项

- 需要在 Cloudflare Worker 环境变量中正确配置 Dify API Key。
- 支持流式（stream=true）和非流式响应。
- 仅支持部分 OpenAI API 路径（如 /v1/models, /v1/chat/completions）。

## License

MIT# dify2openai-cloudflare-worker