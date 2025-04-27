// src/app/api/analyze/route.ts
import {
    FinishReason,
    // Import necessary types and classes from the new SDK
    GoogleGenAI,
    HarmBlockThreshold,
    HarmCategory,
} from "@google/genai"; // Changed import path
import { NextRequest, NextResponse } from "next/server";

// Define the expected structure for GENERAL analysis results (remains the same)
// RENAME if this route handles DIFFERENT analysis types
interface AnalysisResult {
    // Renamed for clarity if different from general
    snippet: string; // The exact text snippet identified
    category: string; // Type of feedback (e.g., Clarity, Conciseness, Engagement, Grammar, Tone)
    feedback: string; // The explanation or suggestion
}

// --- Reusable JSON Extractor ---
// (This function is SDK-independent and remains unchanged, adjust logs if needed)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function extractJson(text: string): AnalysisResult[] | null {
    console.log("Attempting to extract JSON from raw text (Analyze):", text); // Adjusted log context
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    let jsonString = "";
    if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1].trim();
        console.log(
            "Extracted content from markdown fences (Analyze):", // Adjusted log context
            jsonString
        );
    } else {
        console.log(
            "No JSON markdown fences detected (Analyze). Assuming raw text might be JSON." // Adjusted log context
        );
        jsonString = text.trim();
    }

    if (!jsonString) {
        console.error(
            "JSON string is empty after extraction/trimming (Analyze)." // Adjusted log context
        );
        return null;
    }

    // Attempt to clean trailing commas before closing braces/brackets
    jsonString = jsonString.replace(/,\s*([}\]])/g, "$1");

    try {
        console.log(
            "Attempting to parse cleaned JSON string (Analyze):", // Adjusted log context
            jsonString
        );
        const parsed = JSON.parse(jsonString);

        // Validate the structure (using renamed interface if applicable)
        if (
            Array.isArray(parsed) &&
            (parsed.length === 0 ||
                parsed.every(
                    (item) =>
                        item &&
                        typeof item.snippet === "string" &&
                        typeof item.category === "string" &&
                        typeof item.feedback === "string"
                ))
        ) {
            console.log(
                "Successfully parsed JSON and validated structure (Analyze)." // Adjusted log context
            );
            return parsed as AnalysisResult[];
        }
        console.warn(
            "Parsed data is not a valid AnalysisResult[] array (Analyze):", // Adjusted log context
            parsed
        );
        return null;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error parsing JSON string (Analyze): ${message}`); // Adjusted log context
        console.error("String that failed parsing (Analyze):", jsonString); // Adjusted log context
        return null;
    }
}
// --- End Reusable JSON Extractor ---

const MODEL_NAME = "models/gemini-2.5-flash-preview-04-17";
const API_KEY = process.env.GEMINI_API_KEY || "";

export async function POST(request: NextRequest) {
    if (!API_KEY) {
        console.error("API Key is missing.");
        return NextResponse.json(
            { error: "API key not configured" },
            { status: 500 }
        );
    }

    // Initialize the client using the new SDK
    const genAI = new GoogleGenAI({ apiKey: API_KEY });

    try {
        const { text } = await request.json();

        if (!text || typeof text !== "string" || text.trim().length === 0) {
            return NextResponse.json(
                { error: "Text input is required" },
                { status: 400 }
            );
        }

        // Define configuration options - flatten generationConfig and include safetySettings
        const config = {
            temperature: 0.5,
            topK: 1,
            topP: 1,
            safetySettings: [
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
            ],
            responseMimeType: "application/json",
        };

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

        const contents = [{ role: "user", parts: [{ text: prompt }] }];

        console.log("Sending request to Gemini (new SDK) for Analysis..."); // Adjusted log context

        // Call generateContent using the client's model access
        const result = await genAI.models.generateContent({
            model: MODEL_NAME,
            contents: contents,
            config: config,
        });

        // --- Reusable Error Handling ---
        const response = result;

        if (response.promptFeedback) {
            const promptFeedback = result?.promptFeedback;
            if (promptFeedback?.blockReason) {
                console.error(
                    `Prompt was blocked (Analyze): ${promptFeedback.blockReason}`, // Adjusted log context
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
                "Gemini response object was undefined or null (Analyze). Full result object:", // Adjusted log context
                result
            );
            return NextResponse.json(
                { error: "No response object from AI model" },
                { status: 500 }
            );
        }

        const candidate = response.candidates?.[0];
        const finishReason = candidate?.finishReason;
        const safetyRatings = candidate?.safetyRatings;

        if (finishReason === FinishReason.SAFETY) {
            console.error(
                "Gemini response generation was stopped due to SAFETY finish reason (Analyze)." // Adjusted log context
            );
            console.error("Safety Ratings (Analyze):", safetyRatings); // Adjusted log context
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
                `Gemini response finished with unexpected reason (Analyze): ${finishReason}` // Adjusted log context
            );
        }

        const responseText = response.text;

        if (!responseText) {
            console.error(
                "Gemini response text content is empty (Analyze). Finish Reason:", // Adjusted log context
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
            if (response.usageMetadata) {
                console.log(
                    "Usage Metadata (Analyze):", // Adjusted log context
                    response.usageMetadata
                );
            }
            return NextResponse.json({ error: errorMessage }, { status: 500 });
        }
        // --- End Reusable Error Handling ---

        // const analysisData = extractJson(responseText);
        const analysisData = JSON.parse(responseText);

        if (analysisData === null) {
            console.error(
                "Failed to parse valid JSON analysis from AI response (Analyze). Raw response:", // Adjusted log context
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

        console.log("Successfully parsed analysis data."); // Adjusted log context
        return NextResponse.json(analysisData);
    } catch (error: unknown) {
        console.error("Error in /api/analyze:", error); // Adjusted log context
        const message = error instanceof Error ? error.message : String(error);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorStatus = (error as any)?.status;

        if (
            message &&
            (message.includes("SAFETY") ||
                errorStatus === 400 ||
                message.includes("filtered") ||
                message.includes("blocked"))
        ) {
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
