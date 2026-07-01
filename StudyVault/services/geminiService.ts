import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';


const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// Free-tier eligible, fast, and supports native PDF + image understanding.
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Safety cap: inline requests to Gemini have a practical size ceiling once
// base64-encoded. Keep raw files under ~15MB to stay safely under it.
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

const SYSTEM_PROMPT = `You are a study assistant that summarizes a university student's uploaded notes.
Rules:
- Base the summary ONLY on the content of the provided file. Never invent information.
- Keep the whole response under 250 words.
- Use exactly this structure:
  1. One short overview sentence.
  2. A blank line, then the line "**Key Topics:**"
  3. 4-7 bullet points, each starting with "• ", covering the most important concepts.
- Do not add any text before the overview sentence or after the last bullet.
- If the file is a handwritten or photographed note, first read the visible text carefully before summarizing.`;

export type SummarizeResult = {
  success: boolean;
  summary?: string;
  error?: string;
};

const mimeTypeForNote = (noteType: 'document' | 'image', fallbackUri: string): string => {
  if (noteType === 'document') return 'application/pdf';
  const ext = fallbackUri.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
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
        maxOutputTokens: 700,
        temperature: 0.3,
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
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      const finishReason = data?.candidates?.[0]?.finishReason;
      if (finishReason === 'MAX_TOKENS') {
        return { success: false, error: 'The response was cut off. Try again or use a shorter document.' };
      }
      return { success: false, error: 'Gemini returned an empty response. Please try again.' };
    }

    return { success: true, summary: text.trim() };
  } catch (error: any) {
    console.error('summarizeNote error:', error);
    return { success: false, error: error.message || 'Something went wrong while summarizing.' };
  }
};
