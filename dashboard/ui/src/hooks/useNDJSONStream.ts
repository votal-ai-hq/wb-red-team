import { useState, useCallback, useRef } from "react";

export function useNDJSONStream<T>() {
  const [data, setData] = useState<T[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (response: Response) => {
    setData([]);
    setError(null);
    setIsStreaming(true);

    if (!response.ok) {
      setError(`Error ${response.status}`);
      setIsStreaming(false);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      setError("No response body");
      setIsStreaming(false);
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed) as T;
            setData((prev) => [...prev, parsed]);
          } catch {
            // skip malformed lines
          }
        }
      }

      // process remaining buffer
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim()) as T;
          setData((prev) => [...prev, parsed]);
        } catch {
          // skip
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { data, isStreaming, error, start, abort };
}
