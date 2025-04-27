// src/app/api/analyze-general/route.ts
import {
    FinishReason,
    // Import necessary types and classes from the new SDK
    GoogleGenAI,
    HarmBlockThreshold,
    HarmCategory,
} from "@google/genai"; // Changed import path
import { NextRequest, NextResponse } from "next/server";

// Define the expected structure for GENERAL analysis results (remains the same)
interface GeneralAnalysisResult {
    snippet: string; // The exact text snippet identified
    category: string; // Type of feedback (e.g., Clarity, Conciseness, Engagement, Grammar, Tone)
    feedback: string; // The explanation or suggestion
}

// --- Reusable JSON Extractor ---
// (This function is SDK-independent and remains unchanged)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error parsing JSON string (General): ${message}`);
        console.error("String that failed parsing (General):", jsonString);
        return null;
    }
}
// --- End Reusable JSON Extractor ---

// Use a model compatible with the new SDK/features if desired, or keep existing
// The migration guide often shows newer models like 'gemini-2.0-flash'
// Stick with the original unless there's a specific reason to upgrade model family
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

        // Note: We don't get a separate 'model' object first in the new pattern.
        // We pass the model name directly to the generateContent call.

        // Define configuration options - flatten generationConfig and include safetySettings
        const config = {
            // Flattened generation config parameters
            temperature: 0.5,
            topK: 1,
            topP: 1,
            // maxOutputTokens: undefined, // Let model decide unless needed

            // Safety settings nested within config
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

            // If needed for JSON mode (not used in this specific prompt, but example):
            responseMimeType: "application/json",
            // responseSchema: GeneralAnalysisResult, // Or a more specific schema type
        };

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

        // Define contents (remains the same structure)
        const contents = [{ role: "user", parts: [{ text: prompt }] }];

        console.log(
            "Sending request to Gemini (new SDK) for General Analysis..."
        );

        // Call generateContent using the client's model access
        // Pass model, contents, and config
        const result = await genAI.models.generateContent({
            model: MODEL_NAME,
            contents: contents,
            config: config,
        });

        // --- Reusable Error Handling (adapted for potentially slightly different response structure if needed) ---
        // Assuming the core structure of response, candidates, promptFeedback remains similar enough
        const response = result; // Access the response object directly

        if (response.promptFeedback) {
            const promptFeedback = result?.promptFeedback; // Access promptFeedback potentially directly on result
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

        const candidate = response.candidates?.[0];
        // Access finishReason and safetyRatings from the candidate
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

        const responseText = response.text;

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
            // UsageMetadata might be nested differently, check SDK docs if needed
            if (response.usageMetadata) {
                console.log(
                    "Usage Metadata (General):",
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
        console.error("Error in /api/analyze-general:", error);
        const message = error instanceof Error ? error.message : String(error);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorStatus = (error as any)?.status; // Keep checking for status code if available

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
