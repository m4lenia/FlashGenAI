import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import mammoth from 'mammoth';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Support large file uploads (PDFs, images)
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Please configure your API key in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function callGeminiWithRetry(params: any, maxRetries = 2): Promise<any> {
  const ai = getGeminiClient();
  let lastError: any = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || err);
      const isTransient =
        errMsg.includes('503') ||
        errMsg.includes('429') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('high demand') ||
        errMsg.includes('Resource has been exhausted');
      if (isTransient && attempt < maxRetries) {
        console.warn(`Gemini temporary rate limit / 503, retrying in ${1.5 * (attempt + 1)}s...`);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    time: new Date().toISOString(),
  });
});

// Endpoint: Generate flashcards from multimodal files or raw text
app.post('/api/flashcards/generate', async (req: Request, res: Response) => {
  try {
    const {
      fileBase64,
      mimeType,
      fileName,
      rawText,
      count = 15,
      difficulty = 'medium',
      format = 'qa',
      focusTopic,
    } = req.body;

    if (!fileBase64 && (!rawText || rawText.trim().length === 0)) {
      return res.status(400).json({
        error: 'Please provide a file (PDF, DOCX, image, or text) or text content to generate flashcards.',
      });
    }

    const ai = getGeminiClient();
    const parts: any[] = [];

    // Format guidelines
    let formatInstructions = '';
    if (format === 'multiple_choice') {
      formatInstructions = 'Format each card as a Multiple-Choice Question where the "question" provides a clear scenario or inquiry, and the "answer" clearly states the correct choice with brief explanation.';
    } else if (format === 'fill_in_the_blank') {
      formatInstructions = 'Format each card as a Fill-in-the-Blank prompt with key terminology obscured as "______", and the "answer" provides the exact missing term/phrase.';
    } else {
      formatInstructions = 'Format each card as a direct, active-recall Question and concise, precise Answer pair.';
    }

    const difficultyPrompt =
      difficulty === 'mixed'
        ? 'Include a balanced mix of easy foundational concepts, intermediate application questions, and hard analytical cards.'
        : `Generate flashcards calibrated specifically to ${difficulty} difficulty level.`;

    const systemPrompt = `You are FlashGen AI, an expert educational design and spaced-repetition cognitive scientist.
Your job is to read the provided material thoroughly and produce exactly ${count} high-yield, engaging flashcards for study and long-term memory retention.

Requirements:
1. Target quantity: exactly ${count} flashcards.
2. Format style: ${formatInstructions}
3. Difficulty calibration: ${difficultyPrompt}
${focusTopic ? `4. Special topic focus: Pay extra attention to: "${focusTopic}".` : ''}
5. Avoid superficial trivia, vague questions, or duplicate concepts. Focus on core principles, definitions, cause-and-effect relationships, and key distinctions.
6. For each card, assign difficulty ("easy", "medium", or "hard"), write a crisp 1-2 sentence explanation reinforcing the logic, and tag with 1-3 relevant concept tags.`;

    // Process file data
    let processedText = rawText || '';

    // Handle DOCX via mammoth if applicable
    if (fileBase64 && mimeType && (mimeType.includes('wordprocessingml') || fileName?.endsWith('.docx'))) {
      try {
        const buffer = Buffer.from(fileBase64, 'base64');
        const mammothResult = await mammoth.extractRawText({ buffer });
        processedText = (processedText ? processedText + '\n\n' : '') + mammothResult.value;
      } catch (err: any) {
        console.warn('DOCX extraction warning, passing raw base64 or text:', err?.message);
      }
    }

    // Handle PDF, Images, or native supported MIME types directly to Gemini multimodal
    if (fileBase64 && mimeType) {
      if (
        mimeType.startsWith('image/') ||
        mimeType === 'application/pdf' ||
        mimeType === 'text/plain' ||
        mimeType === 'text/markdown' ||
        mimeType === 'text/csv'
      ) {
        parts.push({
          inlineData: {
            mimeType,
            data: fileBase64,
          },
        });
      }
    }

    // Add text part
    const promptText = `Please analyze the provided document/notes and generate ${count} comprehensive flashcards following all instructions.
${processedText ? `\nExtracted Content / Additional Notes:\n"""\n${processedText.slice(0, 80000)}\n"""` : ''}`;

    parts.push({ text: promptText });

    const response = await callGeminiWithRetry({
      model: 'gemini-3.8-flash',
      contents: parts,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          description: `Array of ${count} high-yield flashcard items`,
          items: {
            type: Type.OBJECT,
            properties: {
              question: {
                type: Type.STRING,
                description: 'The front of the flashcard: prompt, active recall question, or fill-in-the-blank text.',
              },
              answer: {
                type: Type.STRING,
                description: 'The back of the flashcard: crisp, authoritative answer.',
              },
              difficulty: {
                type: Type.STRING,
                description: 'Difficulty level: "easy", "medium", or "hard".',
              },
              explanation: {
                type: Type.STRING,
                description: 'Short 1-2 sentence context or mnemonic explaining why this answer is correct.',
              },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '1 to 3 concise tags categorizing the topic.',
              },
            },
            required: ['question', 'answer', 'difficulty'],
          },
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Gemini returned an empty response. Please try again with clearer content.');
    }

    let flashcards = [];
    try {
      flashcards = JSON.parse(responseText.trim());
    } catch (parseErr) {
      // Clean possible markdown code fences if any
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      flashcards = JSON.parse(cleaned);
    }

    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      throw new Error('Failed to parse generated flashcards into a valid list.');
    }

    return res.json({
      success: true,
      count: flashcards.length,
      flashcards,
    });
  } catch (error: any) {
    console.error('Flashcard generation error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate flashcards. Please check your document and try again.',
    });
  }
});

// Endpoint: Generate 3 plausible distractors (wrong answers) for Quiz Mode
app.post('/api/flashcards/distractors', async (req: Request, res: Response) => {
  try {
    const { question, answer, topicContext } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ error: 'Question and answer are required.' });
    }

    const ai = getGeminiClient();

    const response = await callGeminiWithRetry({
      model: 'gemini-3.8-flash',
      contents: `Question: "${question}"
Correct Answer: "${answer}"
${topicContext ? `Topic Context: "${topicContext}"` : ''}

Generate 3 plausible, realistic but incorrect answer options (distractors) for a multiple-choice quiz question.
The distractors must:
1. Match the style, length, and technical depth of the correct answer.
2. Represent common student misconceptions or closely related but distinct concepts.
3. Be completely incorrect in the context of this specific question.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            distractors: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Exactly 3 plausible incorrect answer choices.',
            },
            hint: {
              type: Type.STRING,
              description: 'A subtle hint that steers the learner toward the correct reasoning.',
            },
          },
          required: ['distractors'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    return res.json({
      success: true,
      distractors: Array.isArray(parsed.distractors) ? parsed.distractors.slice(0, 3) : [],
      hint: parsed.hint || '',
    });
  } catch (error: any) {
    console.error('Distractor generation error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate quiz distractors.',
    });
  }
});

// Endpoint: Regenerate single card
app.post('/api/flashcards/regenerate-card', async (req: Request, res: Response) => {
  try {
    const { originalQuestion, originalAnswer, instructions, topic } = req.body;
    const ai = getGeminiClient();

    const response = await callGeminiWithRetry({
      model: 'gemini-3.8-flash',
      contents: `Original Card:
Question: ${originalQuestion}
Answer: ${originalAnswer}
${topic ? `Deck Topic: ${topic}` : ''}
${instructions ? `User Request: ${instructions}` : 'Provide a clearer, more engaging formulation or deeper conceptual angle on this topic.'}

Generate an improved, high-quality replacement flashcard.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            answer: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            explanation: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['question', 'answer', 'difficulty'],
        },
      },
    });

    const card = JSON.parse(response.text?.trim() || '{}');
    return res.json({ success: true, card });
  } catch (error: any) {
    console.error('Card regeneration error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to regenerate card.',
    });
  }
});

// Endpoint: Generate comprehensive Topic Test
app.post('/api/tests/generate', async (req: Request, res: Response) => {
  try {
    const {
      topic = 'General Study Topic',
      cardsContext = [],
      count = 10,
      difficulty = 'standard',
      fileBase64,
      mimeType,
      rawText,
    } = req.body;

    const ai = getGeminiClient();
    const parts: any[] = [];

    // Multimodal attachments if provided
    if (fileBase64 && mimeType) {
      if (
        mimeType.startsWith('image/') ||
        mimeType === 'application/pdf' ||
        mimeType === 'text/plain' ||
        mimeType === 'text/markdown'
      ) {
        parts.push({
          inlineData: {
            mimeType,
            data: fileBase64,
          },
        });
      }
    }

    const cardsSummary = Array.isArray(cardsContext) && cardsContext.length > 0
      ? cardsContext
          .slice(0, 40)
          .map((c: any, i: number) => `Item ${i + 1}: Q: ${c.question} | A: ${c.answer}`)
          .join('\n')
      : '';

    const difficultyInstruction =
      difficulty === 'challenging'
        ? 'Make questions advanced, emphasizing clinical/practical edge-cases, quantitative relationships, and multi-step deduction.'
        : difficulty === 'comprehensive'
        ? 'Cover the entire breadth of the topic from foundational principles to complex analytical scenarios.'
        : 'Ensure a balanced test matching standard college or certification level exams.';

    const systemPrompt = `You are a university exam director and cognitive assessment specialist.
Generate a rigorous, high-quality, professional Topic Test on: "${topic}".
Total questions: exactly ${count}.
Exam calibration: ${difficultyInstruction}

Requirements:
1. Every question must feature exactly 4 distinct, plausible answer choices (A, B, C, D).
2. Distractors must reflect authentic misconceptions, not obvious jokes.
3. Provide an in-depth pedagogical explanation explaining why the correct answer is valid and what principle applies.
4. Categorize each question into a specific "subtopic" (e.g., "Enzyme Kinetics", "Transformer Attention", "Renal Clearance") so the learner receives an accurate diagnostic mastery breakdown.
5. Provide a realistic recommended time limit in minutes (roughly 1.5 minutes per question).`;

    const promptText = `Generate a ${count}-question Topic Test on "${topic}".
${cardsSummary ? `\nReference Material from Deck:\n"""\n${cardsSummary}\n"""\n` : ''}
${rawText ? `\nAdditional Source Notes:\n"""\n${rawText.slice(0, 40000)}\n"""\n` : ''}`;

    parts.push({ text: promptText });

    const response = await callGeminiWithRetry({
      model: 'gemini-3.8-flash',
      contents: parts,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            testTitle: { type: Type.STRING },
            topic: { type: Type.STRING },
            timeLimitMinutes: { type: Type.INTEGER },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Exactly 4 distinct choices.',
                  },
                  correctIndex: {
                    type: Type.INTEGER,
                    description: 'Index of correct answer (0, 1, 2, or 3).',
                  },
                  explanation: { type: Type.STRING },
                  subtopic: { type: Type.STRING },
                  difficulty: { type: Type.STRING },
                },
                required: ['question', 'options', 'correctIndex', 'explanation', 'subtopic'],
              },
            },
          },
          required: ['testTitle', 'topic', 'questions'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    const questions = (parsed.questions || []).map((q: any, idx: number) => ({
      id: `tq-${Date.now()}-${idx}`,
      question: q.question,
      options: Array.isArray(q.options) ? q.options.slice(0, 4) : [],
      correctIndex: typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3 ? q.correctIndex : 0,
      explanation: q.explanation || '',
      subtopic: q.subtopic || 'General Concepts',
      difficulty: q.difficulty || 'medium',
    }));

    return res.json({
      success: true,
      test: {
        id: `test-${Date.now()}`,
        testTitle: parsed.testTitle || `${topic} Assessment Test`,
        topic: parsed.topic || topic,
        timeLimitMinutes: parsed.timeLimitMinutes || Math.max(5, Math.round(count * 1.5)),
        questions,
      },
    });
  } catch (error: any) {
    console.error('Topic test generation error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate topic test. Please try again.',
    });
  }
});

// Endpoint: Generate targeted corrective flashcards from missed test questions
app.post('/api/tests/generate-missed-flashcards', async (req: Request, res: Response) => {
  try {
    const { missedQuestions, topic } = req.body;

    if (!Array.isArray(missedQuestions) || missedQuestions.length === 0) {
      return res.status(400).json({ error: 'No missed questions provided.' });
    }

    const ai = getGeminiClient();
    const missedList = missedQuestions
      .map(
        (m: any, i: number) =>
          `Question ${i + 1}: ${m.question}\nCorrect Answer: ${m.correctAnswer}\nConcept/Subtopic: ${m.subtopic || ''}\nExplanation: ${m.explanation || ''}`
      )
      .join('\n\n');

    const response = await callGeminiWithRetry({
      model: 'gemini-3.8-flash',
      contents: `The student recently completed a test on "${topic}" and got the following questions incorrect:\n\n${missedList}\n\nGenerate targeted, high-yield spaced repetition flashcards specifically formulated to correct these misconceptions and reinforce the principles they missed. Formulate clear, active-recall Q&A pairs with explanations.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answer: { type: Type.STRING },
              difficulty: { type: Type.STRING },
              explanation: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['question', 'answer', 'difficulty'],
          },
        },
      },
    });

    const cards = JSON.parse(response.text?.trim() || '[]');
    return res.json({ success: true, flashcards: cards });
  } catch (error: any) {
    console.error('Missed flashcards generation error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate corrective flashcards.',
    });
  }
});

// ==========================================
// Turbo AI style Study Pages Endpoints
// ==========================================

// Endpoint: Generate comprehensive Turbo AI Study Page
app.post('/api/studypages/generate', async (req: Request, res: Response) => {
  try {
    const {
      topic = 'Comprehensive Study Topic',
      rawText,
      fileBase64,
      mimeType,
      fileName,
      level = 'undergraduate',
      subject = 'General Knowledge',
    } = req.body;

    if (!topic && !rawText && !fileBase64) {
      return res.status(400).json({ error: 'Please provide a topic, document, or notes to generate a study page.' });
    }

    const ai = getGeminiClient();
    const parts: any[] = [];

    // Multimodal attachments
    if (fileBase64 && mimeType) {
      if (
        mimeType.startsWith('image/') ||
        mimeType === 'application/pdf' ||
        mimeType === 'text/plain' ||
        mimeType === 'text/markdown'
      ) {
        parts.push({
          inlineData: {
            mimeType,
            data: fileBase64,
          },
        });
      }
    }

    // Handle docx if applicable
    let processedText = rawText || '';
    if (fileBase64 && mimeType && (mimeType.includes('wordprocessingml') || fileName?.endsWith('.docx'))) {
      try {
        const buffer = Buffer.from(fileBase64, 'base64');
        const mammothResult = await mammoth.extractRawText({ buffer });
        processedText = (processedText ? processedText + '\n\n' : '') + mammothResult.value;
      } catch (err: any) {
        console.warn('DOCX extraction warning for study page:', err?.message);
      }
    }

    const systemPrompt = `You are an elite academic professor, cognitive scientist, and lead author at Turbo AI (turbolearn.ai).
Your mission is to generate a comprehensive, beautifully structured "Study Page" (interactive study notebook) on the given topic/material.

A great Turbo AI Study Page has:
1. An authoritative, engaging title.
2. An Executive Summary (2-3 concise paragraphs summarizing the core concepts).
3. 4-5 High-Yield Key Takeaways (bulleted principles that frequently appear on exams).
4. 3 to 5 deeply structured core sections. Each section must have:
   - A clear numbered title (e.g. "1. Foundational Mechanisms")
   - Rich, clear markdown content (headings, active explanations, numbered steps, bold key terms)
   - 1 or 2 high-yield Callout boxes:
     * "concept": Crucial conceptual definition or distinction
     * "formula": Mathematical equations, chemical reactions, or code syntax
     * "warning": Common misconceptions or traps students fall into
     * "mnemonic": Memorable acronym, rhyme, or memory hook
5. Accurate subject categorization and 3-5 tags.
Level calibration: ${level}.`;

    const promptText = `Generate a master Turbo AI Study Page for:
Topic / Subject: "${topic}" (Field: ${subject})
${processedText ? `\nSource Material / Notes:\n"""\n${processedText.slice(0, 70000)}\n"""\n` : ''}

Deliver a top-tier, publication-quality study guide with clear markdown sections and high-yield callouts.`;

    parts.push({ text: promptText });

    const response = await callGeminiWithRetry({
      model: 'gemini-3.8-flash',
      contents: parts,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            topic: { type: Type.STRING },
            subject: { type: Type.STRING },
            summary: { type: Type.STRING },
            keyTakeaways: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  content: { type: Type.STRING },
                  callouts: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        type: {
                          type: Type.STRING,
                          description: 'One of: concept, warning, formula, mnemonic',
                        },
                        title: { type: Type.STRING },
                        content: { type: Type.STRING },
                      },
                      required: ['type', 'title', 'content'],
                    },
                  },
                },
                required: ['title', 'content'],
              },
            },
          },
          required: ['title', 'topic', 'subject', 'summary', 'keyTakeaways', 'sections'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    const sections = (parsed.sections || []).map((sec: any, idx: number) => ({
      id: `sec-${Date.now()}-${idx}`,
      title: sec.title || `Section ${idx + 1}`,
      content: sec.content || '',
      callouts: Array.isArray(sec.callouts) ? sec.callouts : [],
      isCompleted: false,
    }));

    const colors = ['indigo', 'emerald', 'sky', 'violet', 'amber', 'rose'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const studyPage = {
      id: `sp-${Date.now()}`,
      title: parsed.title || topic,
      topic: parsed.topic || topic,
      subject: parsed.subject || subject,
      summary: parsed.summary || 'Summary unavailable.',
      keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [],
      sections,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [subject],
      color: randomColor,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return res.json({ success: true, studyPage });
  } catch (error: any) {
    console.error('Study page generation error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to generate study page. Please try again.',
    });
  }
});

// Endpoint: AI Add to Notes (Turbo AI Additions: Mnemonics, Comparison Tables, Practice Problems, Custom)
app.post('/api/studypages/expand', async (req: Request, res: Response) => {
  try {
    const { studyPage, actionType, userPrompt } = req.body;

    if (!studyPage) {
      return res.status(400).json({ error: 'Study page context is required.' });
    }

    const ai = getGeminiClient();

    let taskInstruction = '';
    let expectedTitle = '';

    switch (actionType) {
      case 'add_mnemonic':
        taskInstruction = 'Generate 2-3 catchy, unforgettable mnemonic devices (acronyms, visual peg words, or clever rhymes) for the hardest concepts in this study page. Include explanations of how each mnemonic maps to the concept.';
        expectedTitle = 'Memory Hooks & Mnemonics';
        break;
      case 'add_table':
        taskInstruction = 'Construct a high-yield comparison markdown table contrasting the 2-4 most commonly confused mechanisms, terms, or theories in this topic. Highlight key differences, roles, and exam distinctions.';
        expectedTitle = 'Key Concepts Comparison Table';
        break;
      case 'add_problems':
        taskInstruction = 'Create 2 realistic exam-style practice problems with detailed step-by-step reasoning and final solutions.';
        expectedTitle = 'Exam Practice Problems & Step-by-Step Solutions';
        break;
      case 'add_case_study':
        taskInstruction = 'Provide a realistic real-world application, industry case study, or clinical vignette illustrating how this theory works in practice.';
        expectedTitle = 'Real-World Case Study';
        break;
      case 'custom':
      default:
        taskInstruction = `Expand the notes according to this request: "${userPrompt || 'Add helpful in-depth context.'}". Provide rich markdown notes and actionable insights.`;
        expectedTitle = userPrompt ? userPrompt.slice(0, 40) : 'Additional In-Depth Notes';
        break;
    }

    const pageContext = `Title: ${studyPage.title}
Topic: ${studyPage.topic}
Summary: ${studyPage.summary}
Existing Sections:
${(studyPage.sections || []).map((s: any) => `- ${s.title}: ${s.content.slice(0, 200)}...`).join('\n')}`;

    const response = await callGeminiWithRetry({
      model: 'gemini-3.8-flash',
      contents: `You are the Turbo AI Study Copilot.
The user is studying this page:
"""
${pageContext}
"""

User Request: ${taskInstruction}

Generate a new, standalone study section that will be cleanly appended to their notebook.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: {
              type: Type.STRING,
              description: 'Formatted markdown content with clear explanations and tables if applicable.',
            },
            callouts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: 'concept, warning, formula, or mnemonic' },
                  title: { type: Type.STRING },
                  content: { type: Type.STRING },
                },
                required: ['type', 'title', 'content'],
              },
            },
          },
          required: ['title', 'content'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    const newSection = {
      id: `sec-${Date.now()}`,
      title: parsed.title || expectedTitle,
      content: parsed.content || 'Content generated.',
      callouts: Array.isArray(parsed.callouts) ? parsed.callouts : [],
      isCompleted: false,
    };

    return res.json({ success: true, section: newSection });
  } catch (error: any) {
    console.error('Study page expand error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to expand study page notes.',
    });
  }
});

// Endpoint: Turbo AI Study Copilot Chat
app.post('/api/studypages/copilot', async (req: Request, res: Response) => {
  try {
    const { studyPage, question, history = [] } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required.' });
    }

    const ai = getGeminiClient();

    const sectionsSummary = (studyPage?.sections || [])
      .map((s: any) => `### ${s.title}\n${s.content}`)
      .join('\n\n');

    const systemInstruction = `You are the Turbo AI In-Context Study Copilot.
You are assisting a student who is actively reviewing this study page:
Title: "${studyPage?.title || 'Study Guide'}"
Topic: "${studyPage?.topic || 'General'}"
Summary: ${studyPage?.summary || ''}

Page Content:
${sectionsSummary.slice(0, 35000)}

Your goals:
1. Answer the student's question clearly, concisely, and with high pedagogical warmth.
2. Use formatting (bullet points, bold key terms, mini code or math equations) to make complex logic crystal clear.
3. If they ask for simple terms, use vivid real-world analogies.
4. If relevant, suggest a concrete study action (e.g., adding a new note section or making flashcards).`;

    const chatContents: any[] = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        chatContents.push({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        });
      }
    }
    chatContents.push({
      role: 'user',
      parts: [{ text: question }],
    });

    const response = await callGeminiWithRetry({
      model: 'gemini-3.8-flash',
      contents: chatContents,
      config: {
        systemInstruction,
      },
    });

    const answer = response.text || 'I could not generate an answer at this time.';

    return res.json({
      success: true,
      answer,
    });
  } catch (error: any) {
    console.error('Study copilot chat error:', error);
    return res.status(500).json({
      error: error?.message || 'Study Copilot error.',
    });
  }
});

// Endpoint: Convert Study Page to Flashcard Deck
app.post('/api/studypages/convert-to-cards', async (req: Request, res: Response) => {
  try {
    const { studyPageTitle, content, count = 10 } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required to generate flashcards.' });
    }

    const ai = getGeminiClient();

    const response = await callGeminiWithRetry({
      model: 'gemini-3.8-flash',
      contents: `Study Page Title: "${studyPageTitle}"
Content:
"""
${content.slice(0, 45000)}
"""

Extract exactly ${count} high-yield, active recall flashcards directly from this study page.
Formulate precise questions, authoritative answers, difficulty ratings, and short reinforcing explanations.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answer: { type: Type.STRING },
              difficulty: { type: Type.STRING },
              explanation: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['question', 'answer', 'difficulty'],
          },
        },
      },
    });

    const cards = JSON.parse(response.text?.trim() || '[]');
    return res.json({ success: true, flashcards: cards });
  } catch (error: any) {
    console.error('Study page cards conversion error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to convert study page to flashcards.',
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FlashGen AI server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
