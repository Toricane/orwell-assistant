// src/app/api/analyze/route.ts
import {
    FinishReason,
    GenerateContentRequest,
    GoogleGenerativeAI,
    HarmBlockThreshold,
    HarmCategory,
} from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

// Define the expected structure for analysis results
interface AnalysisResult {
    snippet: string; // The exact text snippet identified
    rule: number; // The rule number (1-5)
    suggestion: string; // The explanation or suggestion
}

const MODEL_NAME = "models/gemini-1.5-flash-latest"; // Explicitly use the requested model
const API_KEY = process.env.GEMINI_API_KEY || "";

// --- Helper Function to Extract JSON ---
// (Keep the robust extractJson function from the previous step)
function extractJson(text: string): AnalysisResult[] | null {
    console.log("Attempting to extract JSON from raw text:", text); // Log raw input
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    let jsonString = "";
    if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1].trim();
        console.log("Extracted content from markdown fences:", jsonString);
    } else {
        console.log(
            "No JSON markdown fences detected. Assuming raw text might be JSON."
        );
        jsonString = text.trim();
    }
    if (!jsonString) {
        console.error("JSON string is empty after extraction/trimming.");
        return null;
    }
    jsonString = jsonString.replace(/,\s*([}\]])/g, "$1");
    try {
        console.log("Attempting to parse cleaned JSON string:", jsonString);
        const parsed = JSON.parse(jsonString);
        if (
            Array.isArray(parsed) &&
            (parsed.length === 0 ||
                parsed.every(
                    (item) =>
                        item &&
                        typeof item.snippet === "string" &&
                        typeof item.rule === "number" &&
                        typeof item.suggestion === "string"
                ))
        ) {
            console.log("Successfully parsed JSON and validated structure.");
            return parsed as AnalysisResult[];
        }
        console.warn(
            "Parsed data is not a valid AnalysisResult[] array:",
            parsed
        );
        return null;
    } catch (error: unknown) {
        // <-- FIX: Replaced 'any' with 'unknown'
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error parsing JSON string: ${message}`);
        console.error("String that failed parsing:", jsonString);
        return null;
    }
}
// --- End Helper Function ---

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

        // --- Updated Generation Config ---
        // Removed maxOutputTokens to prevent premature truncation
        const generationConfig = {
            temperature: 0.3, // Keep lower temperature for focused output
            topK: 1,
            topP: 1,
            // maxOutputTokens: 4096, // REMOVED THIS LINE
        };
        // --- End Updated Generation Config ---

        // Safety settings remain disabled for now, as per previous step
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

        const orwellRules = `
George Orwell's 6 Rules for Writing:
1. Never use a metaphor, simile, or other figure of speech which you are used to seeing in print. (Avoid clichés)
2. Never use a long word where a short one will do. (Prefer simplicity)
3. If it is possible to cut a word out, always cut it out. (Be concise)
4. Never use the passive where you can use the active. (Use active voice)
5. Never use a foreign phrase, a scientific word, or a jargon word if you can think of an everyday English equivalent. (Use plain English)
6. Break any of these rules sooner than say anything outright barbarous. (Clarity and meaning over rigid rules - This is a meta-rule for the writer, focus analysis on rules 1-5).
`;

        const prompt = `
You are an AI writing assistant specialized in George Orwell's writing rules.
Analyze the following text based STRICTLY on Orwell's rules 1 through 5.
${orwellRules}

Rigorously and exhaustively identify specific words, phrases, or sentences in the text that violate rules 1-5. For each violation you find:
1.  Identify the *exact* snippet from the original text.
2.  State which rule number (1-5) is violated.
3.  Provide a brief, constructive suggestion or explanation for the violation.

IMPORTANT: Respond ONLY with a valid JSON array containing objects. Each object MUST have the following keys: "snippet", "rule", "suggestion".
Example format:
[
  { "snippet": "utilize", "rule": 2, "suggestion": "Prefer 'use'." },
  { "snippet": "at the end of the day", "rule": 1, "suggestion": "Clichéd phrase. Rephrase for originality." },
  { "snippet": "The ball was thrown by John.", "rule": 4, "suggestion": "Use active voice: 'John threw the ball.'" },
  { "snippet": "a plethora of", "rule": 3, "suggestion": "Can likely be shortened to 'many' or be cut." },
  { "snippet": "vis-à-vis", "rule": 5, "suggestion": "Prefer 'regarding' or 'compared to'." }
]

If no violations are found according to rules 1-5, return an empty JSON array: [].
Do not add any introductory text, explanations, or markdown formatting outside the JSON array itself.

Analyze this text:
--- START TEXT ---
${text}
--- END TEXT ---

JSON Response:
`;

        const req: GenerateContentRequest = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig, // Use the updated config without maxOutputTokens
            safetySettings,
        };

        console.log(
            "Sending request to Gemini (no explicit maxOutputTokens)..."
        );
        const result = await model.generateContent(req);

        // --- Keep the enhanced error checking from the previous step ---
        if (!result.response) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const promptFeedback = result?.promptFeedback;
            if (promptFeedback?.blockReason) {
                console.error(
                    `Prompt was blocked: ${promptFeedback.blockReason}`,
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
                "Gemini response object was undefined or null. Full result object:",
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
                "Gemini response generation was stopped due to SAFETY finish reason."
            );
            console.error("Safety Ratings:", safetyRatings);
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
            // Note: We *might* still see MAX_TOKENS if the model's *internal* limit is hit, but it's less likely now.
            console.warn(
                `Gemini response finished with unexpected reason: ${finishReason}`
            );
        }

        const responseText = result.response.text();

        if (!responseText) {
            console.error(
                "Gemini response text content is empty. Finish Reason:",
                finishReason,
                "Safety Ratings:",
                safetyRatings
            );
            let errorMessage = "Empty response text from AI model.";
            if (finishReason && finishReason !== FinishReason.STOP) {
                errorMessage += ` (Finish Reason: ${finishReason})`;
            }
            // Add the MAX_TOKENS specific message back, just in case the *internal* limit is hit.
            if (finishReason === FinishReason.MAX_TOKENS) {
                errorMessage +=
                    " (The response may have been truncated due to the model's internal length limits.)";
            }
            if (result.response.usageMetadata) {
                console.log("Usage Metadata:", result.response.usageMetadata);
            }
            return NextResponse.json({ error: errorMessage }, { status: 500 });
        }

        const analysisData = extractJson(responseText);

        if (analysisData === null) {
            return NextResponse.json(
                {
                    error: "Failed to parse valid JSON analysis from AI response.",
                    rawResponse: responseText,
                },
                { status: 500 }
            );
        }

        console.log("Successfully parsed analysis data.");
        return NextResponse.json(analysisData);
    } catch (error: unknown) {
        // <-- FIX: Replaced 'any' with 'unknown'
        console.error("Error in /api/analyze:", error);
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
