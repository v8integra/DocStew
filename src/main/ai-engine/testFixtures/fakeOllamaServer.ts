import * as http from "http";

/** Points ollamaClient's requests at a local fake server instead of the real
 * Ollama by monkey-patching global fetch — ollamaClient's base URL is a fixed
 * constant, so this is the simplest way to test it without a real network
 * dependency or restructuring the module just for testability. */
export function withFakeOllamaServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  fn: () => Promise<void>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const realFetch = global.fetch;
      global.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const rewritten = url.replace("http://127.0.0.1:11434", `http://127.0.0.1:${port}`);
        return realFetch(rewritten, init);
      }) as typeof fetch;

      fn()
        .then(resolve, reject)
        .finally(() => {
          global.fetch = realFetch;
          server.close();
        });
    });
  });
}

/** A fake /api/chat handler that always returns the given reply. */
export function fakeChatHandler(reply: string) {
  return (_req: http.IncomingMessage, res: http.ServerResponse) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ message: { role: "assistant", content: reply } }));
  };
}
