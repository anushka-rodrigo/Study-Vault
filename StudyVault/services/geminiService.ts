// services/geminiService.ts
//
// Handles AI summarization of notes (PDFs and images) using the Gemini API.
//
// WHY THIS APPROACH:
// Expo Go cannot run native PDF-text-extraction or OCR libraries (they need a
// custom dev build, which is what caused the earlier failed attempt). Gemini
// 2.5 Flash can natively read PDF and image files directly — you send the raw
// file as "inline_data" and it extracts + understands the content in the same
// call that generates the summary. No separate extraction step, no native
// modules, works fine in Expo Go.
//
// TOKEN-SAVING (important on the free tier):
// - Images are resized/compressed before upload (smaller image = fewer tokens).
// - maxOutputTokens is capped so responses stay short.
// - Only one API call is made per summarize action.

import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

// Reads the key from your .env file. Must be prefixed with EXPO_PUBLIC_ or
// Expo will not expose it to app code. See the integration guide.
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// Free-tier eligible, fast, and supports native PDF + image understanding.
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Safety cap: inline requests to Gemini have a practical size ceiling once
// base64-encoded. Keep raw files under ~15MB to stay safely under it.
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

const SYSTEM_PROMPT = `You are a study assistant that creates detailed, exam-useful summaries of a university student's uploaded educational material (lecture slides, textbook excerpts, handwritten notes, or problem sheets).

Read the ENTIRE file carefully before answering. For a multi-page PDF, your summary must reflect content from all pages, not just the first few — do not stop analyzing early.

Structure your response using exactly these sections, in this order, and SKIP a section entirely if it does not apply to this particular file:

**Overview:**
2-4 sentences describing what the material covers and why it matters.

**Key Topics:**
One bullet per major concept, scaling with how much the document actually covers (roughly 5 bullets for a short simple file, up to 10-12 for a long or dense one). Each bullet must be a full explanation, not just a name:
• **Topic name:** 1-3 sentence explanation of what it is, how it works, or why it matters.

**Key Formulas & Definitions:** (include ONLY if the material contains formulas, equations, or precise technical definitions)
One bullet per formula/definition, written in plain readable text (NOT LaTeX — no backslash commands, no $ signs). For example write "H = -Σ(Pi × log2(Pi))" not "\\sum" or "\\log_2". After the formula, briefly explain what each symbol means.

**Worked Example:** (include ONLY if the material contains a solved example, exercise, or problem the student is meant to solve)
Walk through the solution method step by step, numbered "1.", "2.", "3." etc, each on its own line, with enough detail that the student could apply the same method to a similar problem themselves.

Formatting rules — the app parses this automatically, follow exactly:
- Section headers must appear exactly as shown above, wrapped in double asterisks, e.g. **Key Topics:**
- Bullet lines must start with "• " (the bullet character, then a space). Never use "-" or a single "*" as a bullet marker.
- Never use single asterisks anywhere in the text. Never use LaTeX or markdown math syntax.
- Do not add any text before "**Overview:**" or after the last section (no closing remarks, no disclaimers, no note about connecting to a service).

Prioritize genuinely covering the material in depth over staying short — a longer, thorough summary is better than a vague short one. Never stop partway through a sentence, bullet, or numbered step; always finish what you start.`;

export type SummarizeResult = {
  success: boolean;
  summary?: string;
  error?: string;
};

// Compresses + resizes an image and returns base64 data directly (no extra file read needed).
const prepareImageBase64 = async (uri: string): Promise<{ base64: string; mimeType: string }> => {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  if (!manipulated.base64) {
    throw new Error('Failed to process image for summarization.');
  }

  return { base64: manipulated.base64, mimeType: 'image/jpeg' };
};

// Reads a PDF straight off disk as base64.
const preparePdfBase64 = async (uri: string): Promise<{ base64: string; mimeType: string }> => {
  const fileInfo = await FileSystem.getInfoAsync(uri);
  if (!fileInfo.exists) {
    throw new Error('Local file not found on device.');
  }
  if (fileInfo.size && fileInfo.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('This PDF is too large to summarize (max ~15MB on the free tier). Try a smaller file.');
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { base64, mimeType: 'application/pdf' };
};

export const summarizeNote = async (
  fileUri: string,
  noteType: 'document' | 'image',
  title: string
): Promise<SummarizeResult> => {
  try {
    if (!GEMINI_API_KEY) {
      return {
        success: false,
        error: 'Gemini API key is missing. Add EXPO_PUBLIC_GEMINI_API_KEY to your .env file and restart the app.',
      };
    }

    if (!fileUri) {
      return { success: false, error: 'No file is attached to this note.' };
    }

    const { base64, mimeType } =
      noteType === 'document' ? await preparePdfBase64(fileUri) : await prepareImageBase64(fileUri);

    const body = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [
            { text: `Summarize this note titled "${title}".` },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.3,
        // Gemini 2.5 models think internally before answering, and those
        // hidden reasoning tokens are deducted from maxOutputTokens. Fully
        // disabling thinking (budget 0) was tried but Gemini can still spend
        // a large chunk of budget reasoning through dense/multi-page PDFs,
        // starving the visible answer. Instead: give it a bounded thinking
        // allowance (so it can't run away) and a generous overall ceiling
        // so plenty is always left for the actual summary text.
        thinkingConfig: {
          thinkingBudget: 1024,
        },
      },
    };

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', response.status, errText);

      if (response.status === 429) {
        return {
          success: false,
          error: 'Free tier rate limit reached. Wait a minute and try again.',
        };
      }
      if (response.status === 400) {
        return { success: false, error: 'The file could not be processed by Gemini. Try a different file.' };
      }
      return { success: false, error: `Summarization failed (status ${response.status}).` };
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const text = parts
      .map((p: any) => p?.text ?? '')
      .join('')
      .trim();
    const finishReason = candidate?.finishReason;

    if (finishReason === 'MAX_TOKENS') {
      // Text may be partially present but incomplete — never show a cut-off summary.
      return {
        success: false,
        error: 'The summary was cut off before finishing. Please try again.',
      };
    }

    if (!text) {
      return { success: false, error: 'Gemini returned an empty response. Please try again.' };
    }

    return { success: true, summary: text };
  } catch (error: any) {
    console.error('summarizeNote error:', error);
    return { success: false, error: error.message || 'Something went wrong while summarizing.' };
  }
};