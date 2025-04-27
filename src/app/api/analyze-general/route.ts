// src/app/api/analyze-general/route.ts
import {
    FinishReason,
    GenerateContentRequest,
    GoogleGenerativeAI,
    HarmBlockThreshold,
    HarmCategory,
} from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

// Define the expected structure for GENERAL analysis results
interface GeneralAnalysisResult {
    snippet: string; // The exact text snippet identified
    category: string; // Type of feedback (e.g., Clarity, Conciseness, Engagement, Grammar, Tone)
    feedback: string; // The explanation or suggestion
}

// --- Reusable JSON Extractor ---
// (Same robust function as in the analyze route)
function extractJson(text: string): GeneralAnalysisResult[] | null {
    console.log("Attempting to extract JSON from raw text (General):", text);
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    let jsonString = "";
    if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1].trim();
        console.log(
            "Extracted content from markdown fences (General):",
            jsonString
        );
    } else {
        console.log(
            "No JSON markdown fences detected (General). Assuming raw text might be JSON."
        );
        jsonString = text.trim();
    }

    if (!jsonString) {
        console.error(
            "JSON string is empty after extraction/trimming (General)."
        );
        return null;
    }

    // Attempt to clean trailing commas before closing braces/brackets
    jsonString = jsonString.replace(/,\s*([}\]])/g, "$1");

    try {
        console.log(
            "Attempting to parse cleaned JSON string (General):",
            jsonString
        );
        const parsed = JSON.parse(jsonString);

        // Validate the structure
        if (
            Array.isArray(parsed) &&
            (parsed.length === 0 ||
                parsed.every(
                    (item) =>
                        item &&
                        typeof item.snippet === "string" &&
                        typeof item.category === "string" && // Check for 'category'
                        typeof item.feedback === "string" // Check for 'feedback'
                ))
        ) {
            console.log(
                "Successfully parsed JSON and validated structure (General)."
            );
            return parsed as GeneralAnalysisResult[];
        }
        console.warn(
            "Parsed data is not a valid GeneralAnalysisResult[] array (General):",
            parsed
        );
        return null;
    } catch (error: unknown) {
        // <-- FIX: Replaced 'any' with 'unknown'
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error parsing JSON string (General): ${message}`);
        console.error("String that failed parsing (General):", jsonString);
        return null;
    }
}
// --- End Reusable JSON Extractor ---

const MODEL_NAME = "models/gemini-1.5-flash-latest"; // Or your preferred model like 'models/gemini-1.5-pro-latest'
const API_KEY = process.env.GEMINI_API_KEY || "";

export async function POST(request: NextRequest) {
    if (!API_KEY) {
        console.error("API Key is missing.");
        return NextResponse.json(
            { error: "API key not configured" },
            { status: 500 }
        );
    }

    try {
        const { text } = await request.json();

        if (!text || typeof text !== "string" || text.trim().length === 0) {
            return NextResponse.json(
                { error: "Text input is required" },
                { status: 400 }
            );
        }

        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        const generationConfig = {
            temperature: 0.5, // Slightly higher temp for more varied feedback
            topK: 1,
            topP: 1,
            // No maxOutputTokens - let the model decide or hit internal limits
        };

        // Keep safety settings consistent (or adjust if needed for general feedback)
        const safetySettings = [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
        ];

        // --- Prompt for General Analysis ---
        const prompt = `
You are an AI writing assistant providing general feedback.
Analyze the following text for overall writing quality. Focus on areas like:
*   **Clarity:** Is the meaning clear and unambiguous?
*   **Conciseness:** Are there unnecessary words or phrases?
*   **Engagement:** Is the writing interesting and holding the reader's attention?
*   **Tone:** Is the tone appropriate for the likely context? Is it consistent?
*   **Grammar & Spelling:** Are there grammatical errors or typos?
*   **Flow & Structure:** Does the text transition smoothly between ideas?

For each significant point of feedback (positive or negative, but focus on areas for improvement):
1.  Identify the *exact* relevant snippet (word, phrase, or sentence) from the original text.
2.  Provide a short category label for the feedback (e.g., "Clarity", "Conciseness", "Engagement", "Tone", "Grammar", "Flow", "Suggestion").
3.  Write a brief, constructive feedback message explaining the point or suggesting an improvement.

IMPORTANT: Respond ONLY with a valid JSON array containing objects. Each object MUST have the following keys: "snippet", "category", "feedback".
Example format:
[
  { "snippet": "exceedingly difficult", "category": "Conciseness", "feedback": "Consider using 'very difficult' or just 'difficult'." },
  { "snippet": "The report was completed by the team.", "category": "Clarity", "feedback": "Passive voice. Consider active: 'The team completed the report.'" },
  { "snippet": "basically", "category": "Conciseness", "feedback": "Filler word. Can often be removed without losing meaning." },
  { "snippet": "utilize", "category": "Tone", "feedback": "'Use' is often more direct and less formal." },
  { "snippet": "Its important to check its spelling.", "category": "Grammar", "feedback": "Should be 'It's important to check its spelling.' ('It's' means 'it is')." }
]

If the text is generally well-written and you find no specific areas for improvement, return an empty JSON array: [].
Do not add any introductory text, explanations, or markdown formatting outside the JSON array itself.

Analyze this text:
--- START TEXT ---
${text}
--- END TEXT ---

JSON Response:
`;
        // --- End Prompt ---

        const req: GenerateContentRequest = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig,
            safetySettings,
        };

        console.log("Sending request to Gemini for General Analysis...");
        const result = await model.generateContent(req);

        // --- Reusable Error Handling ---
        if (!result.response) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const promptFeedback = result?.promptFeedback;
            if (promptFeedback?.blockReason) {
                console.error(
                    `Prompt was blocked (General): ${promptFeedback.blockReason}`,
                    promptFeedback.safetyRatings
                );
                return NextResponse.json(
                    {
                        error: `Input text blocked by safety filters: ${promptFeedback.blockReason}. Please revise your input.`,
                        details: promptFeedback.safetyRatings,
                    },
                    { status: 400 }
                );
            }
            console.error(
                "Gemini response object was undefined or null (General). Full result object:",
                result
            );
            return NextResponse.json(
                { error: "No response object from AI model" },
                { status: 500 }
            );
        }

        const candidate = result.response.candidates?.[0];
        const finishReason = candidate?.finishReason;
        const safetyRatings = candidate?.safetyRatings;

        if (finishReason === FinishReason.SAFETY) {
            console.error(
                "Gemini response generation was stopped due to SAFETY finish reason (General)."
            );
            console.error("Safety Ratings (General):", safetyRatings);
            return NextResponse.json(
                {
                    error: "Analysis response blocked by safety filters.",
                    details: safetyRatings,
                },
                { status: 400 }
            );
        }
        if (
            finishReason &&
            finishReason !== FinishReason.STOP &&
            finishReason !== FinishReason.MAX_TOKENS
        ) {
            console.warn(
                `Gemini response finished with unexpected reason (General): ${finishReason}`
            );
        }

        const responseText = result.response.text();

        if (!responseText) {
            console.error(
                "Gemini response text content is empty (General). Finish Reason:",
                finishReason,
                "Safety Ratings:",
                safetyRatings
            );
            let errorMessage = "Empty response text from AI model.";
            if (finishReason && finishReason !== FinishReason.STOP) {
                errorMessage += ` (Finish Reason: ${finishReason})`;
            }
            if (finishReason === FinishReason.MAX_TOKENS) {
                errorMessage +=
                    " (The response may have been truncated due to the model's internal length limits.)";
            }
            if (result.response.usageMetadata) {
                console.log(
                    "Usage Metadata (General):",
                    result.response.usageMetadata
                );
            }
            return NextResponse.json({ error: errorMessage }, { status: 500 });
        }
        // --- End Reusable Error Handling ---

        const analysisData = extractJson(responseText);

        if (analysisData === null) {
            console.error(
                "Failed to parse valid JSON analysis from AI response (General). Raw response:",
                responseText
            );
            return NextResponse.json(
                {
                    error: "Failed to parse valid JSON analysis from AI response.",
                    rawResponse: responseText,
                },
                { status: 500 }
            );
        }

        console.log("Successfully parsed general analysis data.");
        return NextResponse.json(analysisData);
    } catch (error: unknown) {
        // <-- FIX: Replaced 'any' with 'unknown'
        console.error("Error in /api/analyze-general:", error);
        const message = error instanceof Error ? error.message : String(error);
        // Attempt to check for safety-related properties if the error object might have them
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorStatus = (error as any)?.status;

        if (message && (message.includes("SAFETY") || errorStatus === 400)) {
            return NextResponse.json(
                {
                    error: "Request failed, potentially due to safety filters or invalid input.",
                    details: message,
                },
                { status: 400 }
            );
        }
        return NextResponse.json(
            {
                error: "An unexpected error occurred on the server.",
                details: message,
            },
            { status: 500 }
        );
    }
}
