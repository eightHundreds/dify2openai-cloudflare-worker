# dify2openai-cloudflare-worker

本项目是一个将 Dify API 代理为 OpenAI API 兼容接口的 Cloudflare Worker。

> 灵感来源于 [fatwang2/dify2openai](https://github.com/fatwang2/dify2openai), Github Copilot当苦力

## 快速部署

### 方法一：使用模板部署（推荐）

1. 点击下方按钮直接使用模板创建新的仓库并部署：

[![Deploy with Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/eightHundreds/dify2openai-cloudflare-worker)

2. 或者直接访问：`https://deploy.workers.cloudflare.com/?url=https://github.com/eightHundreds/dify2openai-cloudflare-worker`
### 方法二：手动部署
如果您不想使用一键部署，可以手动部署：
拷贝 `worker.js` 文件到您的 Cloudflare Worker 项目中。


### 部署后配置

部署完成后，您需要配置环境变量：

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

### 如何配置环境变量

1. **通过 Cloudflare Dashboard**：
   - 登录 Cloudflare Dashboard
   - 进入 Workers & Pages > 选择你的 Worker
   - 点击 Settings > Environment Variables
   - 添加上述环境变量

2. **通过 Wrangler CLI**：
   ```bash
   wrangler secret put DIFY_API_URL
   wrangler secret put BOT_TYPE
   wrangler secret put INPUT_VARIABLE
   wrangler secret put OUTPUT_VARIABLE
   ```

## 部署

### 方式一：一键部署（推荐）

点击上方的 "Deploy to Cloudflare Workers" 按钮即可快速部署。

**注意**：部署成功后，您需要在 Cloudflare Dashboard 中配置以下环境变量：
- `DIFY_API_URL`：您的 Dify API 地址
- `BOT_TYPE`：Bot 类型（Chat、Completion 或 Workflow）
- `INPUT_VARIABLE`：输入变量名（仅 Workflow/Completion 模式需要）
- `OUTPUT_VARIABLE`：输出变量名（仅 Workflow/Completion 模式需要）

### 方式二：手动部署

1. 克隆本仓库
2. 安装 Wrangler CLI：`npm install -g wrangler`
3. 登录 Cloudflare：`wrangler auth login`
4. 配置环境变量：
   ```bash
   wrangler secret put DIFY_API_URL
   wrangler secret put BOT_TYPE
   # 根据需要配置其他变量
   ```
5. 部署：`wrangler deploy`

### 方式三：从源码部署

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

## 故障排除

### 一键部署失败

如果点击一键部署按钮时出现"无法获取存储库内容"的错误，请尝试以下解决方案：

1. **检查仓库权限**：确保仓库是公开的（public）
2. **使用 Fork 方式**：
   - Fork 本仓库到您的账户
   - 使用您自己的仓库链接进行部署
3. **手动部署**：按照下面的手动部署步骤进行
4. **清除浏览器缓存**：有时浏览器缓存会导致问题
5. **稍后重试**：GitHub 或 Cloudflare 服务偶尔可能不可用

### 常见问题

- **502 错误**：检查环境变量是否正确配置
- **认证失败**：确保 Dify API Key 正确设置
- **CORS 错误**：本项目已处理 CORS，如仍有问题请检查请求头

## 注意事项

- 需要在 Cloudflare Worker 环境变量中正确配置 Dify API Key。
- 支持流式（stream=true）和非流式响应。
- 仅支持部分 OpenAI API 路径（如 /v1/models, /v1/chat/completions）。

## License

MIT