import { NoteSummaryData } from './geminiService';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export type QuizResult = {
  success: boolean;
  questions?: string[];
  error?: string;
};

const SYSTEM_PROMPT = `You are a study assistant that creates short revision quizzes for a university student, based ONLY on a summary of their notes.

Write exactly 15 simple, exam-style questions if the summary has enough distinct content to support that many without repeating the same fact; otherwise write as many as the content genuinely supports, down to a minimum of 10. Keep each question short and direct, like a quick revision quiz — not a complex exam.

Rules:
- IMPORTANT: You must fully finish the list before stopping. Do not stop partway through — keep every question SHORT (under 15 words each) specifically so the full set fits comfortably. Never leave the array incomplete.
- Base every question ONLY on the content given in the summary below. Never invent facts that are not present in it.
- If the summary includes formulas or a worked example, include a few small numeric/calculation questions that apply the same formula or method using simple numbers.
- Do NOT include answers, answer choices, or space for answering — return ONLY the question text itself.
- Do NOT number the questions yourself (no "1.", "Q1", etc.) — return them as a plain array of strings, one question per entry. Numbering is added by the app.
- Vary the question style naturally (what/why/how/when/define/calculate) but keep the wording simple, like a short revision check rather than a formal exam question.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
  },
  required: ['questions'],
};

//stored "summary" is either a JSON string matching NoteSummaryData (new notes) or legacy plain text (old notes)
//converts either into a plain txt version for quiz prompt
const summaryToPlainText = (summaryText: string): string => {
  try {
    const parsed = JSON.parse(summaryText);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.keyTopics)) {
      const data = parsed as NoteSummaryData;
      const lines: string[] = [];

      lines.push(`Overview: ${data.overview}`);

      if (data.keyTopics?.length) {
        lines.push('Key Topics:');
        data.keyTopics.forEach((t) => lines.push(`- ${t.title}: ${t.description}`));
      }

      if (data.keyFormulas?.length) {
        lines.push('Key Formulas & Definitions:');
        data.keyFormulas.forEach((f) => lines.push(`- ${f.formula} (${f.explanation})`));
      }

      if (data.workedExample?.length) {
        lines.push('Worked Example:');
        data.workedExample.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
      }

      return lines.join('\n');
    }
  } catch {
    //not JSON — it's legacy plain text, use it as-is below.
  }
  return summaryText;
};

export const generateQuiz = async (summaryText: string, title: string): Promise<QuizResult> => {
  try {
    if (!GEMINI_API_KEY) {
      return {
        success: false,
        error: 'Gemini API key is missing. Add EXPO_PUBLIC_GEMINI_API_KEY to your .env file and restart the app.',
      };
    }

    if (!summaryText || !summaryText.trim()) {
      return { success: false, error: 'This note has no summary yet. Summarize it first, then generate a quiz.' };
    }

    const plainSummary = summaryToPlainText(summaryText);

    const body = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Notes title: "${title}"\n\nSummary:\n${plainSummary}\n\nGenerate the quiz now.`,
            },
          ],
        },
      ],
      generationConfig: {
        //sets a max token output
        //limits 'thinking' done by AI model
        //ensures all 15 questions are generated without stopping in 13 or 14 questions as before
        maxOutputTokens: 4096,
        temperature: 0.4,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        thinkingConfig: {
          thinkingBudget: 256,
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
      console.error('Gemini quiz API error:', response.status, errText);

      if (response.status === 429) {
        return { success: false, error: 'Free tier rate limit reached. Wait a minute and try again.' };
      }
      if (response.status === 503) {
        return {
          success: false,
          error: "Gemini's servers are temporarily overloaded. Please wait a moment and try again.",
        };
      }
      if (response.status === 400) {
        return { success: false, error: 'The summary could not be processed by Gemini. Try resummarizing the note.' };
      }
      return { success: false, error: `Quiz generation failed (status ${response.status}). Please try again.` };
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
      return { success: false, error: 'The quiz was cut off before finishing. Please try again.' };
    }

    if (!rawText) {
      return { success: false, error: 'Gemini returned an empty response. Please try again.' };
    }

    let parsed: { questions?: string[] };
    try {
      parsed = JSON.parse(rawText);
    } catch (parseError) {
      console.error('Failed to parse Gemini quiz JSON response:', rawText);
      return { success: false, error: 'Gemini returned an unexpected format. Please try again.' };
    }

    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return { success: false, error: 'Gemini did not return any questions. Please try again.' };
    }

    //ensures the generated questions are between 10 to 15 and remove empty strings
    const questions = parsed.questions
      .map((q) => (typeof q === 'string' ? q.trim() : ''))
      .filter(Boolean)
      .slice(0, 15);

    if (questions.length === 0) {
      return { success: false, error: 'Gemini did not return any usable questions. Please try again.' };
    }

    return { success: true, questions };
  } catch (error: any) {
    console.error('generateQuiz error:', error);
    return { success: false, error: error.message || 'Something went wrong while generating the quiz.' };
  }
};