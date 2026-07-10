import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

//max file size set for 15 mb with a base64-encode
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

export type NoteSummaryData = {
  overview: string;
  keyTopics: { title: string; description: string }[];
  keyFormulas: { formula: string; explanation: string }[]; // empty array returned if no formulas to show
  workedExample: string[]; // one string per step; empty array if no examples to show
};

const SYSTEM_PROMPT = `You are a study assistant that creates detailed, exam-useful summaries of a university student's uploaded educational material (lecture slides, textbook excerpts, handwritten notes, or problem sheets).

Read the ENTIRE file carefully before answering. For a multi-page PDF, your summary must reflect content from all pages, not just the first few — do not stop analyzing early.

Fill in the JSON fields as follows:
- "overview": 2-4 sentences describing what the material covers overall and why it matters.
- "keyTopics": one entry per major concept, scaling with how much the document actually covers (roughly 5 entries for a short simple file, up to 10-12 for a long or dense one). "title" is a short 2-6 word label. "description" is a full 1-3 sentence explanation of what it is, how it works, or why it matters — never just repeat the title.
- "keyFormulas": ONLY include entries if the material contains formulas, equations, or precise technical definitions. Otherwise return an empty array. Write each formula in plain readable text (NOT LaTeX — no backslash commands, no $ signs). For example write "H = -Σ(Pi × log2(Pi))", not "\\sum" or "\\log_2". "explanation" briefly describes what each symbol means.
- "workedExample": ONLY include steps if the material contains a solved example, exercise, or problem the student is meant to work through. Otherwise return an empty array. Each array entry is one full step, in order, with enough detail that a student could apply the same method to a similar problem themselves.

Base everything ONLY on the content of the provided file. Never invent information. Prioritize genuinely covering the material in depth over staying short.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    overview: { type: 'STRING' },
    keyTopics: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          description: { type: 'STRING' },
        },
        required: ['title', 'description'],
      },
    },
    keyFormulas: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          formula: { type: 'STRING' },
          explanation: { type: 'STRING' },
        },
        required: ['formula', 'explanation'],
      },
    },
    workedExample: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
  },
  required: ['overview', 'keyTopics', 'keyFormulas', 'workedExample'],
};

export type SummarizeResult = {
  success: boolean;
  summaryData?: NoteSummaryData;
  error?: string;
};

// Compresses and resizes an image and returns base64 data directly 
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
        // Forces the AI model to output a valid JSON matching RESPONSE_SCHEMA, this is much easier when formatting the output
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        //reduce and limits the 'thinking' the AI model goes thru when giving output
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
      if (response.status === 503) {
        return {
          success: false,
          error: "Gemini's servers are temporarily overloaded. Please wait a moment and try again.",
        };
      }
      if (response.status === 400) {
        return { success: false, error: 'The file could not be processed by Gemini. Try a different file.' };
      }
      return { success: false, error: `Summarization failed (status ${response.status}). Please try again.` };
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const rawText = parts
      .map((p: any) => p?.text ?? '')
      .join('')
      .trim();
    const finishReason = candidate?.finishReason;

    if (finishReason === 'MAX_TOKENS') {
      //when JSON is incomplete due to cutoff, it is not shown
      return {
        success: false,
        error: 'The summary was cut off before finishing. Please try again.',
      };
    }

    if (!rawText) {
      return { success: false, error: 'Gemini returned an empty response. Please try again.' };
    }

    let summaryData: NoteSummaryData;
    try {
      summaryData = JSON.parse(rawText);
    } catch (parseError) {
      console.error('Failed to parse Gemini JSON response:', rawText);
      return { success: false, error: 'Gemini returned an unexpected format. Please try again.' };
    }

    // Basic shape validation so a malformed response never crashes the UI.
    if (!summaryData.overview || !Array.isArray(summaryData.keyTopics)) {
      return { success: false, error: 'Gemini returned an incomplete summary. Please try again.' };
    }
    if (!Array.isArray(summaryData.keyFormulas)) summaryData.keyFormulas = [];
    if (!Array.isArray(summaryData.workedExample)) summaryData.workedExample = [];

    return { success: true, summaryData };
  } catch (error: any) {
    console.error('summarizeNote error:', error);
    return { success: false, error: error.message || 'Something went wrong while summarizing.' };
  }
};

//converts structured summary data into a readable plain-text version
//usefulfor the "Share Summary" and "Download Summary" functions
export const formatSummaryForExport = (data: NoteSummaryData): string => {
  const lines: string[] = [];

  lines.push('Overview', data.overview, '');

  if (data.keyTopics.length > 0) {
    lines.push('Key Topics');
    data.keyTopics.forEach((t) => lines.push(`- ${t.title}: ${t.description}`));
    lines.push('');
  }

  if (data.keyFormulas.length > 0) {
    lines.push('Key Formulas & Definitions');
    data.keyFormulas.forEach((f) => lines.push(`- ${f.formula} — ${f.explanation}`));
    lines.push('');
  }

  if (data.workedExample.length > 0) {
    lines.push('Worked Example');
    data.workedExample.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
  }

  return lines.join('\n').trim();
};