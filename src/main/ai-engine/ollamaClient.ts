const OLLAMA_BASE_URL = "http://127.0.0.1:11434";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaModel {
  name: string;
  size: number;
}

/** Thrown when Ollama itself can't be reached (not running / not installed) —
 * distinct from a request that reached Ollama but failed for some other reason. */
export class OllamaUnavailableError extends Error {}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_BASE_URL}${path}`, init);
  } catch {
    throw new OllamaUnavailableError(`Could not reach Ollama at ${OLLAMA_BASE_URL} — is it running?`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama request to ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

function postJson(path: string, body: unknown): Promise<unknown> {
  return request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listModels(): Promise<OllamaModel[]> {
  const data = (await request("/api/tags")) as { models?: Array<{ name: string; size: number }> };
  return (data.models ?? []).map((m) => ({ name: m.name, size: m.size }));
}

export async function chat(model: string, messages: ChatMessage[]): Promise<string> {
  const data = (await postJson("/api/chat", { model, messages, stream: false })) as {
    message: { content: string };
  };
  return data.message.content;
}

export async function embed(model: string, text: string): Promise<Float32Array> {
  const data = (await postJson("/api/embeddings", { model, prompt: text })) as { embedding: number[] };
  return Float32Array.from(data.embedding);
}
