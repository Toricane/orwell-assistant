// src/app/page.tsx
"use client";

import {
    Popover,
    PopoverButton,
    PopoverPanel,
    Transition,
} from "@headlessui/react";
import { Fragment, useCallback, useMemo, useState } from "react";

// --- Interfaces ---
interface OrwellAnalysisResult {
    snippet: string;
    rule: number;
    suggestion: string;
    id: string;
}

interface GeneralAnalysisResult {
    snippet: string;
    category: string;
    feedback: string;
    id: string;
}
// --- End Interfaces ---

type AnalysisView = "orwell" | "general"; // Type for the active view state

// Helper function to escape regex special characters
function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Helper for Orwell rule descriptions
const ruleDescriptions: { [key: number]: string } = {
    1: "Avoid Clichés",
    2: "Prefer Short Words",
    3: "Cut Needless Words",
    4: "Use Active Voice",
    5: "Use Plain English",
};

export default function Home() {
    const [inputText, setInputText] = useState<string>("");

    // Orwell Analysis State
    const [orwellAnalysis, setOrwellAnalysis] = useState<
        OrwellAnalysisResult[] | null
    >(null);
    const [isOrwellLoading, setIsOrwellLoading] = useState<boolean>(false);
    const [orwellError, setOrwellError] = useState<string | null>(null);

    // General Analysis State
    const [generalAnalysis, setGeneralAnalysis] = useState<
        GeneralAnalysisResult[] | null
    >(null);
    const [isGeneralLoading, setIsGeneralLoading] = useState<boolean>(false);
    const [generalError, setGeneralError] = useState<string | null>(null);

    // Resolved Feedback State
    const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

    // State for Active Analysis View
    const [activeAnalysisView, setActiveAnalysisView] =
        useState<AnalysisView>("orwell"); // Default to Orwell view

    // Resolve/Unresolve Handlers
    const handleResolve = useCallback((id: string) => {
        setResolvedIds((prev) => {
            const newSet = new Set(prev);
            newSet.add(id);
            return newSet;
        });
    }, []);
    const handleUnresolve = useCallback((id: string) => {
        setResolvedIds((prev) => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
        });
    }, []);

    // Analysis Handlers
    const handleOrwellAnalyze = useCallback(async () => {
        if (!inputText.trim()) {
            setOrwellError("Please paste some text to analyze.");
            setOrwellAnalysis(null);
            setGeneralAnalysis(null); // Clear other analysis
            setGeneralError(null);
            setResolvedIds(new Set());
            return;
        }
        setIsOrwellLoading(true);
        setOrwellError(null);
        setOrwellAnalysis(null);
        setResolvedIds(new Set());
        // Optionally clear general analysis too if desired, but setting the view handles display
        // setGeneralAnalysis(null); setGeneralError(null);

        try {
            const response = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: inputText }),
            });
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch {
                    errorData = {
                        error: `HTTP error ${response.status}: ${response.statusText}`,
                    };
                }
                throw new Error(
                    errorData?.error || `HTTP error ${response.status}`
                );
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawData: Omit<OrwellAnalysisResult, "id">[] | any =
                await response.json();
            if (!Array.isArray(rawData)) {
                console.error("Received non-array data:", rawData);
                throw new Error("Invalid Orwell analysis format received.");
            }
            const analysisWithIds: OrwellAnalysisResult[] = rawData.map(
                (item, index) => ({
                    ...item,
                    id: `orwell-${index}-${Date.now()}`,
                })
            );
            setOrwellAnalysis(analysisWithIds);
            setActiveAnalysisView("orwell"); // Switch view to Orwell results
        } catch (err: unknown) {
            console.error("Orwell Analysis failed:", err);
            const message =
                err instanceof Error
                    ? err.message
                    : "An unknown error occurred";
            setOrwellError(message || "Failed to get Orwell analysis.");
            setOrwellAnalysis(null);
        } finally {
            setIsOrwellLoading(false);
        }
    }, [inputText]);

    const handleGeneralAnalyze = useCallback(async () => {
        if (!inputText.trim()) {
            setGeneralError("Please paste some text to analyze.");
            setGeneralAnalysis(null);
            setOrwellAnalysis(null); // Clear other analysis
            setOrwellError(null);
            setResolvedIds(new Set());
            return;
        }
        setIsGeneralLoading(true);
        setGeneralError(null);
        setGeneralAnalysis(null);
        setResolvedIds(new Set());
        // Optionally clear Orwell analysis too if desired
        // setOrwellAnalysis(null); setOrwellError(null);

        try {
            const response = await fetch("/api/analyze-general", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: inputText }),
            });
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch {
                    errorData = {
                        error: `HTTP error ${response.status}: ${response.statusText}`,
                    };
                }
                throw new Error(
                    errorData?.error || `HTTP error ${response.status}`
                );
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawData: Omit<GeneralAnalysisResult, "id">[] | any =
                await response.json();
            if (!Array.isArray(rawData)) {
                console.error("Received non-array data:", rawData);
                throw new Error("Invalid General analysis format received.");
            }
            const analysisWithIds: GeneralAnalysisResult[] = rawData.map(
                (item, index) => ({
                    ...item,
                    id: `general-${index}-${Date.now()}`,
                })
            );
            setGeneralAnalysis(analysisWithIds);
            setActiveAnalysisView("general"); // Switch view to General results
        } catch (err: unknown) {
            console.error("General Analysis failed:", err);
            const message =
                err instanceof Error
                    ? err.message
                    : "An unknown error occurred";
            setGeneralError(message || "Failed to get general analysis.");
            setGeneralAnalysis(null);
        } finally {
            setIsGeneralLoading(false);
        }
    }, [inputText]);
    // --- End Analysis Handlers ---

    // --- Render Highlighted Text Function (UPDATED FOR POPOVER FIX) ---
    const renderHighlightedText = useCallback(
        (
            textToRender: string,
            analysisData:
                | (OrwellAnalysisResult | GeneralAnalysisResult)[]
                | null,
            currentResolvedIds: Set<string>,
            onResolve: (id: string) => void, // Original handlers
            onUnresolve: (id: string) => void, // Original handlers
            getHighlightClass: (
                item: OrwellAnalysisResult | GeneralAnalysisResult
            ) => string,
            // Updated signature: handlers now expect the close function to be passed in
            renderPopoverContentFn: (
                item: OrwellAnalysisResult | GeneralAnalysisResult,
                isResolved: boolean,
                resolveHandlerWithClose: (id: string) => void, // Renamed for clarity
                unresolveHandlerWithClose: (id: string) => void // Renamed for clarity
            ) => React.ReactNode
        ) => {
            if (!analysisData || !textToRender || analysisData.length === 0) {
                // Use a key for list rendering consistency
                return <span key="full-text-empty">{textToRender}</span>;
            }
            const uniqueSnippets = [
                ...new Set(analysisData.map((a) => a.snippet)),
            ];
            uniqueSnippets.sort((a, b) => b.length - a.length);
            if (uniqueSnippets.length === 0)
                return <span key="full-text-no-snippets">{textToRender}</span>;

            const regex = new RegExp(
                `(${uniqueSnippets.map(escapeRegex).join("|")})`,
                "gi"
            );
            const parts: (
                | string
                | OrwellAnalysisResult
                | GeneralAnalysisResult
            )[] = [];
            let lastIndex = 0;
            let match;

            while ((match = regex.exec(textToRender)) !== null) {
                if (match.index > lastIndex) {
                    parts.push(textToRender.substring(lastIndex, match.index));
                }
                const matchedText = match[0];
                const suggestionData = analysisData.find(
                    (a) => a.snippet.toLowerCase() === matchedText.toLowerCase()
                );
                if (suggestionData) {
                    // Preserve original text casing if possible, otherwise use analysis casing
                    const displaySnippet =
                        suggestionData.snippet.toLowerCase() ===
                        matchedText.toLowerCase()
                            ? matchedText
                            : suggestionData.snippet;
                    parts.push({ ...suggestionData, snippet: displaySnippet });
                } else {
                    // Fallback if somehow a match doesn't correspond to analysis data (shouldn't happen)
                    parts.push(matchedText);
                }
                lastIndex = regex.lastIndex;
            }
            if (lastIndex < textToRender.length) {
                parts.push(textToRender.substring(lastIndex));
            }

            // Base styles to make a <button> look like inline text and behave correctly
            const baseButtonResetStyles =
                "appearance-none align-baseline inline font-inherit text-inherit bg-transparent p-0 m-0 border-none focus:outline-none focus-visible:ring-0 focus-visible:outline-none";

            // Define resolved styles (applied to inner span)
            const resolvedClassInner =
                "border border-dashed border-gray-400 text-gray-600 group-hover:border-gray-600";
            const resolvedClassButton = "cursor-pointer group"; // Group needed for hover effect on inner span

            return parts.map((part, index) => {
                if (typeof part === "object" && part !== null && "id" in part) {
                    const itemData = part as
                        | OrwellAnalysisResult
                        | GeneralAnalysisResult;
                    const isResolved = currentResolvedIds.has(itemData.id);

                    let buttonContainerClass = "";
                    let innerSpanClass = "";

                    if (isResolved) {
                        // Resolved: Button is simple group, inner span gets dashed border
                        buttonContainerClass = `${baseButtonResetStyles} ${resolvedClassButton}`;
                        innerSpanClass = `${resolvedClassInner} rounded-md mx-px`; // Add back mx-px here
                    } else {
                        // Not Resolved: Button is base reset + cursor, inner span gets highlight/focus styles
                        buttonContainerClass = `${baseButtonResetStyles} cursor-pointer`;
                        innerSpanClass = `${getHighlightClass(
                            itemData
                        )} px-1 mx-px rounded-md transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500 focus-visible:ring-opacity-75`; // Added focus-visible:ring-offset-1
                    }

                    return (
                        <Popover
                            key={`${itemData.id}-${index}`}
                            className="relative inline-block align-baseline" // align-baseline helps keep button inline with text
                        >
                            {(
                                { open, close } // Destructure 'open' and 'close'
                            ) => (
                                <>
                                    {/* Use default button, apply reset styles */}
                                    <PopoverButton
                                        className={buttonContainerClass}
                                    >
                                        {/* Inner span holds the text and visual styles */}
                                        <span className={innerSpanClass}>
                                            {itemData.snippet}
                                        </span>
                                    </PopoverButton>
                                    <Transition
                                        as={Fragment}
                                        show={open} // Control visibility with 'open' state
                                        enter="transition ease-out duration-200"
                                        enterFrom="opacity-0 translate-y-1"
                                        enterTo="opacity-100 translate-y-0"
                                        leave="transition ease-in duration-150"
                                        leaveFrom="opacity-100 translate-y-0"
                                        leaveTo="opacity-0 translate-y-1"
                                    >
                                        {/* Static rendering can sometimes help with complex focus/transition management */}
                                        <PopoverPanel
                                            static
                                            className="absolute z-20 w-80 max-w-md px-4 mt-2 transform -translate-x-1/2 left-1/2 sm:px-0 lg:max-w-lg"
                                        >
                                            <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
                                                <div className="relative bg-white p-3">
                                                    {/* Pass handlers that NOW incorporate the 'close' function */}
                                                    {renderPopoverContentFn(
                                                        itemData,
                                                        isResolved,
                                                        // Handler for resolving: calls original + close
                                                        (id) => {
                                                            onResolve(id);
                                                            close();
                                                        },
                                                        // Handler for unresolving: calls original + close
                                                        (id) => {
                                                            onUnresolve(id);
                                                            close();
                                                        }
                                                    )}
                                                </div>
                                            </div>
                                        </PopoverPanel>
                                    </Transition>
                                </>
                            )}
                        </Popover>
                    );
                } else if (typeof part === "string") {
                    // Wrap text parts in span with key for stability
                    return <span key={`text-${index}`}>{part}</span>;
                }
                return null; // Should not happen
            });
        },
        // Dependencies: Original resolve/unresolve handlers are stable via useCallback([])
        [handleResolve, handleUnresolve]
    );

    // --- Memoized Orwell Output (UPDATED TO PASS HANDLERS WITH CLOSE) ---
    const renderedOrwellOutput = useMemo(() => {
        if (!inputText && !orwellAnalysis) return null;
        if (!orwellAnalysis) return null;
        if (orwellAnalysis.length === 0) {
            return (
                <p className="text-green-700 bg-green-50 border border-green-200 rounded-md p-4 text-center font-medium mt-4">
                    Excellent! No violations of Orwell&apos;s rules 1-5
                    detected.
                </p>
            );
        }

        const getHighlightClass = (
            item: OrwellAnalysisResult | GeneralAnalysisResult
        ): string => {
            const data = item as OrwellAnalysisResult;
            let className = "bg-yellow-200 hover:bg-yellow-300 text-yellow-900"; // Rule 3 Default
            if (data.rule === 1)
                className = "bg-blue-200 hover:bg-blue-300 text-blue-900";
            if (data.rule === 2)
                className = "bg-red-200 hover:bg-red-300 text-red-900";
            if (data.rule === 4)
                className = "bg-green-200 hover:bg-green-300 text-green-900";
            if (data.rule === 5)
                className = "bg-orange-200 hover:bg-orange-300 text-orange-900";
            return className;
        };

        // This function defines the content INSIDE the popover panel
        const renderPopoverContent = (
            item: OrwellAnalysisResult | GeneralAnalysisResult,
            isResolved: boolean,
            // These handlers are the ones created inside renderHighlightedText, they already include close()
            resolveHandlerWithClose: (id: string) => void,
            unresolveHandlerWithClose: (id: string) => void
        ): React.ReactNode => {
            const data = item as OrwellAnalysisResult;
            const ruleColorClasses: { [key: number]: string } = {
                1: "text-blue-700",
                2: "text-red-700",
                3: "text-yellow-800",
                4: "text-green-700",
                5: "text-orange-700",
            };
            return (
                <>
                    <p
                        className={`text-sm font-semibold mb-1 ${
                            ruleColorClasses[data.rule] || "text-gray-800"
                        }`}
                    >
                        Rule {data.rule}: {ruleDescriptions[data.rule] || ""}
                    </p>
                    <p className="text-sm text-gray-900 mb-2">
                        {data.suggestion}
                    </p>
                    <div className="mt-2 pt-2 border-t border-gray-200 flex justify-end">
                        {isResolved ? (
                            <button
                                // Call the handler which will unresolve AND close
                                onClick={(e) => {
                                    e.preventDefault();
                                    unresolveHandlerWithClose(data.id);
                                }}
                                className="text-xs font-medium text-yellow-600 hover:text-yellow-800 focus:outline-none focus:underline"
                            >
                                Mark as Unresolved
                            </button>
                        ) : (
                            <button
                                // Call the handler which will resolve AND close
                                onClick={(e) => {
                                    e.preventDefault();
                                    resolveHandlerWithClose(data.id);
                                }}
                                className="text-xs font-medium text-green-600 hover:text-green-800 focus:outline-none focus:underline"
                            >
                                Mark as Resolved
                            </button>
                        )}
                    </div>
                </>
            );
        };

        // Pass the original handlers (handleResolve, handleUnresolve) to renderHighlightedText
        // renderHighlightedText will wrap them with the close() call internally
        return renderHighlightedText(
            inputText,
            orwellAnalysis,
            resolvedIds,
            handleResolve, // Original handler
            handleUnresolve, // Original handler
            getHighlightClass,
            renderPopoverContent // The function defined above
        );
    }, [
        inputText,
        orwellAnalysis,
        renderHighlightedText, // Stable due to useCallback([])
        resolvedIds,
        handleResolve, // Stable due to useCallback([])
        handleUnresolve, // Stable due to useCallback([])
    ]);

    // --- Memoized General Output (UPDATED TO PASS HANDLERS WITH CLOSE) ---
    const renderedGeneralOutput = useMemo(() => {
        if (!inputText && !generalAnalysis) return null;
        if (!generalAnalysis) return null;
        if (generalAnalysis.length === 0) {
            return (
                <p className="text-sky-700 bg-sky-50 border border-sky-200 rounded-md p-4 text-center font-medium mt-4">
                    Good work! No specific improvement suggestions found in this
                    pass.
                </p>
            );
        }

        // General highlight class (consistent purple)
        const getHighlightClass = (): string => {
            return "bg-purple-200 hover:bg-purple-300 text-purple-900";
        };

        const renderPopoverContent = (
            item: OrwellAnalysisResult | GeneralAnalysisResult,
            isResolved: boolean,
            // These handlers already include close()
            resolveHandlerWithClose: (id: string) => void,
            unresolveHandlerWithClose: (id: string) => void
        ): React.ReactNode => {
            const data = item as GeneralAnalysisResult;
            return (
                <>
                    <p className="text-sm font-semibold mb-1 text-purple-700">
                        Category: {data.category}
                    </p>
                    <p className="text-sm text-gray-900 mb-2">
                        {data.feedback}
                    </p>
                    <div className="mt-2 pt-2 border-t border-gray-200 flex justify-end">
                        {isResolved ? (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    unresolveHandlerWithClose(data.id);
                                }}
                                className="text-xs font-medium text-yellow-600 hover:text-yellow-800 focus:outline-none focus:underline"
                            >
                                Mark as Unresolved
                            </button>
                        ) : (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    resolveHandlerWithClose(data.id);
                                }}
                                className="text-xs font-medium text-green-600 hover:text-green-800 focus:outline-none focus:underline"
                            >
                                Mark as Resolved
                            </button>
                        )}
                    </div>
                </>
            );
        };

        // Pass original handlers to renderHighlightedText
        return renderHighlightedText(
            inputText,
            generalAnalysis,
            resolvedIds,
            handleResolve, // Original handler
            handleUnresolve, // Original handler
            getHighlightClass, // General highlight class
            renderPopoverContent // Popover content function
        );
    }, [
        inputText,
        generalAnalysis,
        renderHighlightedText, // Stable
        resolvedIds,
        handleResolve, // Stable
        handleUnresolve, // Stable
    ]);

    // --- Loading/Error Components (Keep as before) ---
    const LoadingSpinner = ({ color = "text-white" }: { color?: string }) => (
        <svg
            className={`animate-spin -ml-1 mr-3 h-5 w-5 ${color}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
        >
            <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
            ></circle>
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
        </svg>
    );
    const ErrorMessage = ({
        title,
        message,
    }: {
        title: string;
        message: string | null;
    }) => {
        if (!message) return null;
        return (
            <div className="my-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-sm">
                <p className="font-semibold flex items-center">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2 text-red-600"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                        />
                    </svg>
                    {title}
                </p>
                <p className="mt-1 ml-7 text-sm">{message}</p>
            </div>
        );
    };

    // --- JSX Structure (Keep as before, but Analysis Output uses updated render logic) ---
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <header className="text-center mb-10 w-full max-w-4xl">
                <h1 className="text-4xl font-bold text-gray-800 mb-2 tracking-tight">
                    Writing Feedback Assistant
                </h1>
                <p className="text-lg text-gray-600">
                    Refine your text with Orwell&apos;s rules and general
                    feedback.
                </p>
            </header>
            {/* Main Content Card */}
            <div className="w-full max-w-4xl bg-white shadow-xl rounded-lg p-6 md:p-8 border border-gray-200">
                {/* Input Area */}
                <div className="mb-6">
                    <label
                        htmlFor="text-input"
                        className="block text-sm font-medium text-gray-700 mb-1"
                    >
                        Paste your text here:
                    </label>
                    <textarea
                        id="text-input"
                        rows={10}
                        className="w-full p-4 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out text-gray-900 placeholder:text-gray-400 text-base leading-relaxed"
                        placeholder="Enter text here..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
                    <button
                        onClick={handleOrwellAnalyze}
                        disabled={isOrwellLoading || isGeneralLoading}
                        className={`px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white flex items-center justify-center group ${
                            isOrwellLoading
                                ? "bg-gray-400 cursor-not-allowed"
                                : isGeneralLoading
                                ? "bg-indigo-300 cursor-not-allowed" // Dim if other is loading
                                : "bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        } transition duration-150 ease-in-out`}
                    >
                        {isOrwellLoading && <LoadingSpinner />}
                        {isOrwellLoading
                            ? "Analyzing Orwell..."
                            : "Analyze Orwell Rules"}
                    </button>
                    <button
                        onClick={handleGeneralAnalyze}
                        disabled={isGeneralLoading || isOrwellLoading}
                        className={`px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white flex items-center justify-center group ${
                            isGeneralLoading
                                ? "bg-gray-400 cursor-not-allowed"
                                : isOrwellLoading
                                ? "bg-purple-300 cursor-not-allowed" // Dim if other is loading
                                : "bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                        } transition duration-150 ease-in-out`}
                    >
                        {isGeneralLoading && <LoadingSpinner />}
                        {isGeneralLoading
                            ? "Analyzing Style..."
                            : "Analyze General Feedback"}
                    </button>
                </div>

                {/* Display Errors (Displayed above tabs) */}
                <ErrorMessage
                    title="Orwell Analysis Error:"
                    message={orwellError}
                />
                <ErrorMessage
                    title="General Feedback Error:"
                    message={generalError}
                />

                {/* --- Analysis Output Area with Tabs --- */}
                <div className="mt-6 border-t border-gray-200 pt-6">
                    {/* Tab Navigation */}
                    <div className="mb-4 border-b border-gray-200">
                        <nav
                            className="-mb-px flex space-x-6"
                            aria-label="Tabs"
                        >
                            <button
                                onClick={() => setActiveAnalysisView("orwell")}
                                className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm focus:outline-none ${
                                    activeAnalysisView === "orwell"
                                        ? "border-indigo-500 text-indigo-600"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                            >
                                Orwell Rules Analysis
                                {orwellAnalysis &&
                                    orwellAnalysis.length > 0 &&
                                    ` (${orwellAnalysis.length})`}
                            </button>
                            <button
                                onClick={() => setActiveAnalysisView("general")}
                                className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm focus:outline-none ${
                                    activeAnalysisView === "general"
                                        ? "border-purple-500 text-purple-600"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                            >
                                General Writing Feedback
                                {generalAnalysis &&
                                    generalAnalysis.length > 0 &&
                                    ` (${generalAnalysis.length})`}
                            </button>
                        </nav>
                    </div>

                    {/* Tab Content */}
                    <div className="analysis-output">
                        {/* Orwell View Content */}
                        {activeAnalysisView === "orwell" && (
                            <>
                                {isOrwellLoading && (
                                    <div className="flex justify-center items-center p-6 text-gray-500">
                                        <LoadingSpinner color="text-indigo-600" />
                                        <span>Loading Orwell analysis...</span>
                                    </div>
                                )}
                                {!isOrwellLoading &&
                                    !orwellError && ( // Only show content if not loading and no error
                                        // Use prose for styling, whitespace-pre-wrap for line breaks
                                        <div className="prose prose-indigo max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap text-base">
                                            {renderedOrwellOutput}
                                            {/* Initial state message */}
                                            {inputText &&
                                                orwellAnalysis === null &&
                                                !orwellError && (
                                                    <p className="text-gray-500 italic text-center mt-4">
                                                        Click &quot;Analyze
                                                        Orwell Rules&quot; to
                                                        see suggestions.
                                                    </p>
                                                )}
                                            {!inputText && (
                                                <p className="text-gray-500 italic text-center mt-4">
                                                    Enter text and click
                                                    &quot;Analyze Orwell
                                                    Rules&quot;.
                                                </p>
                                            )}
                                        </div>
                                    )}
                            </>
                        )}

                        {/* General View Content */}
                        {activeAnalysisView === "general" && (
                            <>
                                {isGeneralLoading && (
                                    <div className="flex justify-center items-center p-6 text-gray-500">
                                        <LoadingSpinner color="text-purple-600" />
                                        <span>Loading general feedback...</span>
                                    </div>
                                )}
                                {!isGeneralLoading &&
                                    !generalError && ( // Only show content if not loading and no error
                                        <div className="prose prose-purple max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap text-base">
                                            {renderedGeneralOutput}
                                            {/* Initial state message */}
                                            {inputText &&
                                                generalAnalysis === null &&
                                                !generalError && (
                                                    <p className="text-gray-500 italic text-center mt-4">
                                                        Click &quot;Analyze
                                                        General Feedback&quot;
                                                        to see suggestions.
                                                    </p>
                                                )}
                                            {!inputText && (
                                                <p className="text-gray-500 italic text-center mt-4">
                                                    Enter text and click
                                                    &quot;Analyze General
                                                    Feedback&quot;.
                                                </p>
                                            )}
                                        </div>
                                    )}
                            </>
                        )}
                    </div>
                </div>
                {/* --- End Analysis Output Area with Tabs --- */}
            </div>{" "}
            {/* End White Card */}
            {/* Rules Reference */}
            <div className="w-full max-w-4xl mt-8 p-4 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                <h3 className="font-semibold mb-2">
                    Orwell&apos;s Rules Reference:
                </h3>
                <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm">
                    <li>
                        Never use a metaphor, simile, or other figure of speech
                        which you are used to seeing in print.
                    </li>
                    <li>Never use a long word where a short one will do.</li>
                    <li>
                        If it is possible to cut a word out, always cut it out.
                    </li>
                    <li>Never use the passive where you can use the active.</li>
                    <li>
                        Never use a foreign phrase, a scientific word, or a
                        jargon word if you can think of an everyday English
                        equivalent.
                    </li>
                    <li>
                        Break any of these rules sooner than say anything
                        outright barbarous.
                    </li>
                </ol>
            </div>
            {/* Footer */}
            <footer className="text-center mt-12 text-gray-500 text-sm">
                Powered by{" "}
                <a
                    href="https://deepmind.google/technologies/gemini/" // Example link
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline"
                >
                    Google Gemini
                </a>
                .
            </footer>
        </div>
    );
}
