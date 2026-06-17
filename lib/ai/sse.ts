// Parser SSE minimale: dato il body di una Response in streaming, produce gli
// oggetti JSON dei campi `data:`. Si ferma a [DONE] (convenzione OpenAI/DeepSeek).
// Anthropic usa righe `event:`/`data:`; qui leggiamo solo i `data:` (basta).

export async function* sseJson(res: Response): AsyncGenerator<any> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      // gli eventi SSE sono separati da una riga vuota
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx).trimEnd();
        buf = buf.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          yield JSON.parse(data);
        } catch {
          /* riga parziale o non-JSON: ignora */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
