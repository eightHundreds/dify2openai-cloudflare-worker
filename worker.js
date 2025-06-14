// 环境变量配置 - 需要在 Cloudflare Worker 的环境变量中设置
// DIFY_API_URL, BOT_TYPE, INPUT_VARIABLE, OUTPUT_VARIABLE, MODELS_NAME
const DIFY_API_URL = 'https://api.dify.ai/v1'
const BOT_TYPE = 'Chat'
const INPUT_VARIABLE = ''
const OUTPUT_VARIABLE = ''

function generateId() {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 29; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization",
  "Access-Control-Max-Age": "86400",
};

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // 处理 CORS 预检请求
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // 检查必需的环境变量
  if (!DIFY_API_URL) {
    return new Response("DIFY API URL is required.", { status: 500 });
  }

  const botType = BOT_TYPE || 'Workflow';
  const inputVariable = INPUT_VARIABLE || '';
  const outputVariable = OUTPUT_VARIABLE || '';

  let apiPath;
  switch (botType) {
    case 'Chat':
      apiPath = '/chat-messages';
      break;
    case 'Completion':
      apiPath = '/completion-messages';
      break;
    case 'Workflow':
      apiPath = '/workflows/run';
      break;
    default:
      return new Response('Invalid bot type in the environment variable.', { status: 500 });
  }

  // 根路径
  if (path === '/' && method === 'GET') {
    const html = `
      <html>
        <head>
          <title>DIFY2OPENAI</title>
        </head>
        <body>
          <h1>Dify2OpenAI</h1>
          <p>Congratulations! Your project has been successfully deployed.</p>
        </body>
      </html>
    `;
    return new Response(html, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' }
    });
  }

  // 模型列表接口
  if (path === '/v1/models' && method === 'GET') {
    const models = {
      "object": "list",
      "data": [
        {
          "id": "dify",
          "object": "model",
          "owned_by": "dify",
          "permission": null,
        }
      ]
    };
    return new Response(JSON.stringify(models), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // 聊天完成接口
  if (path === '/v1/chat/completions' && method === 'POST') {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({
        code: 401,
        errmsg: "Unauthorized.",
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return new Response(JSON.stringify({
        code: 401,
        errmsg: "Unauthorized.",
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      const data = await request.json();
      const messages = data.messages;
      let queryString;

      if (botType === 'Chat') {
        const lastMessage = messages[messages.length - 1];
        queryString = `here is our talk history:\n'''\n${messages
          .slice(0, -1)
          .map((message) => `${message.role}: ${message.content}`)
          .join('\n')}\n'''\n\nhere is my question:\n${lastMessage.content}`;
      } else if (botType === 'Completion' || botType === 'Workflow') {
        queryString = messages[messages.length - 1].content;
      }

      const stream = data.stream !== undefined ? data.stream : false;
      let requestBody;

      if (inputVariable) {
        requestBody = {
          inputs: { [inputVariable]: queryString },
          response_mode: "streaming",
          conversation_id: "",
          user: "apiuser",
          auto_generate_name: false
        };
      } else {
        requestBody = {
          "inputs": {},
          query: queryString,
          response_mode: "streaming",
          conversation_id: "",
          user: "apiuser",
          auto_generate_name: false
        };
      }

      const resp = await fetch(DIFY_API_URL + apiPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (stream) {
        return handleStreamResponse(resp, data);
      } else {
        return await handleNonStreamResponse(resp, data, outputVariable);
      }

    } catch (error) {
      console.error("Error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // 404 处理
  return new Response("Not Found", {
    status: 404,
    headers: corsHeaders
  });
}

function handleStreamResponse(resp, data) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  
  let isFirstChunk = true;
  let isResponseEnded = false;
  let buffer = "";

  const processStream = async () => {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let lines = buffer.split("\n");

        for (let i = 0; i < lines.length - 1; i++) {
          let line = lines[i].trim();

          if (!line.startsWith("data:")) continue;
          line = line.slice(5).trim();
          let chunkObj;

          try {
            if (line.startsWith("{")) {
              chunkObj = JSON.parse(line);
            } else {
              continue;
            }
          } catch (error) {
            console.error("Error parsing chunk:", error);
            continue;
          }

          if (chunkObj.event === "message" || chunkObj.event === "agent_message" || chunkObj.event === "text_chunk") {
            let chunkContent;
            if (chunkObj.event === "text_chunk") {
              chunkContent = chunkObj.data.text;
            } else {
              chunkContent = chunkObj.answer;
            }

            if (isFirstChunk) {
              chunkContent = chunkContent.trimStart();
              isFirstChunk = false;
            }

            if (chunkContent !== "" && !isResponseEnded) {
              const chunkId = `chatcmpl-${Date.now()}`;
              const chunkCreated = chunkObj.created_at;

              const chunk = "data: " + JSON.stringify({
                id: chunkId,
                object: "chat.completion.chunk",
                created: chunkCreated,
                model: data.model,
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: chunkContent,
                    },
                    finish_reason: null,
                  },
                ],
              }) + "\n\n";

              await writer.write(new TextEncoder().encode(chunk));
            }
          } else if (chunkObj.event === "workflow_finished" || chunkObj.event === "message_end") {
            if (!isResponseEnded) {
              const chunkId = `chatcmpl-${Date.now()}`;
              const chunkCreated = chunkObj.created_at;

              const chunk = "data: " + JSON.stringify({
                id: chunkId,
                object: "chat.completion.chunk",
                created: chunkCreated,
                model: data.model,
                choices: [
                  {
                    index: 0,
                    delta: {},
                    finish_reason: "stop",
                  },
                ],
              }) + "\n\n";

              await writer.write(new TextEncoder().encode(chunk));
              await writer.write(new TextEncoder().encode("data: [DONE]\n\n"));
              isResponseEnded = true;
              await writer.close();
              return;
            }
          } else if (chunkObj.event === "error") {
            console.error(`Error: ${chunkObj.code}, ${chunkObj.message}`);
            if (!isResponseEnded) {
              await writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ error: chunkObj.message })}\n\n`));
              await writer.write(new TextEncoder().encode("data: [DONE]\n\n"));
              isResponseEnded = true;
              await writer.close();
              return;
            }
          }
        }

        buffer = lines[lines.length - 1];
      }
    } catch (error) {
      console.error("Stream processing error:", error);
      if (!isResponseEnded) {
        await writer.write(new TextEncoder().encode("data: [DONE]\n\n"));
        await writer.close();
      }
    }
  };

  processStream();

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

async function handleNonStreamResponse(resp, data, outputVariable) {
  let result = "";
  let usageData = "";
  let hasError = false;
  let messageEnded = false;
  let buffer = "";
  let skipWorkflowFinished = false;

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let lines = buffer.split("\n");

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line === "") continue;
        let chunkObj;

        try {
          const cleanedLine = line.replace(/^data: /, "").trim();
          if (cleanedLine.startsWith("{") && cleanedLine.endsWith("}")) {
            chunkObj = JSON.parse(cleanedLine);
          } else {
            continue;
          }
        } catch (error) {
          console.error("Error parsing JSON:", error);
          continue;
        }
        console.log(chunkObj)
        if (chunkObj.event === "message" || chunkObj.event === "agent_message") {
          result += chunkObj.answer;
          skipWorkflowFinished = true;
        } else if (chunkObj.event === "message_end") {
          messageEnded = true;
          usageData = {
            prompt_tokens: chunkObj.metadata.usage.prompt_tokens || 100,
            completion_tokens: chunkObj.metadata.usage.completion_tokens || 10,
            total_tokens: chunkObj.metadata.usage.total_tokens || 110,
          };
        } else if (chunkObj.event === "workflow_finished" && !skipWorkflowFinished) {
          messageEnded = true;
          const outputs = chunkObj.data.outputs;
          if (outputVariable) {
            result = outputs[outputVariable];
          } else {
            result = outputs;
          }
          result = String(result);
          usageData = {
            prompt_tokens: chunkObj.metadata?.usage?.prompt_tokens || 100,
            completion_tokens: chunkObj.metadata?.usage?.completion_tokens || 10,
            total_tokens: chunkObj.data.total_tokens || 110,
          };
        } else if (chunkObj.event === "error") {
          console.error(`Error: ${chunkObj.code}, ${chunkObj.message}`);
          hasError = true;
          break;
        }
      }

      buffer = lines[lines.length - 1];
    }

    if (hasError) {
      return new Response(JSON.stringify({ error: "An error occurred while processing the request." }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else if (messageEnded) {
      const formattedResponse = {
        id: `chatcmpl-${generateId()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: data.model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: result.trim(),
            },
            logprobs: null,
            finish_reason: "stop",
          },
        ],
        usage: usageData,
        system_fingerprint: "fp_2f57f81c11",
      };

      return new Response(JSON.stringify(formattedResponse, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ error: "Unexpected end of stream." }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error("Error processing response:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    return await handleRequest(request, env);
  },
};
