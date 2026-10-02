import { z } from 'zod';

export interface GeminiDependencies {
  key?: string;
  model?: string;
  fetcher?: typeof fetch;
}

export function requestGemini(
  deps: GeminiDependencies,
  instructions: string,
  input: unknown,
  schema: z.ZodType,
  maxOutputTokens: number,
  timeoutMs: number,
): Promise<Response> {
  const model = deps.model?.trim() || 'gemini-3.5-flash-lite';
  return (deps.fetcher ?? fetch)(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': deps.key ?? '', 'Content-Type': 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
        generationConfig: {
          maxOutputTokens,
          responseFormat: {
            text: {
              mimeType: 'APPLICATION_JSON',
              schema: z.toJSONSchema(schema, { target: 'draft-7' }),
            },
          },
        },
      }),
    },
  );
}

const responseSchema = z.object({
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
  candidates: z
    .array(
      z.object({
        finishReason: z.string(),
        content: z
          .object({
            parts: z.array(
              z.object({ text: z.string().optional(), thought: z.boolean().optional() }),
            ),
          })
          .optional(),
      }),
    )
    .optional(),
});

export function geminiText(data: unknown): string {
  const response = responseSchema.parse(data);
  const candidate = response.candidates?.[0];
  if (response.promptFeedback?.blockReason || candidate?.finishReason !== 'STOP')
    throw new Error('Gemini did not complete the response.');
  const text = candidate.content?.parts
    .filter((part) => !part.thought)
    .map((part) => part.text ?? '')
    .join('');
  if (!text?.trim()) throw new Error('Gemini returned no text.');
  return text;
}
