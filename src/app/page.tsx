// src/app/page.tsx
"use client";

import { Popover, Transition } from "@headlessui/react";
import { Fragment, useCallback, useMemo, useState } from "react";

// --- Interfaces (Keep as before) ---
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

// Helper function to escape regex special characters (keep)
function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Helper for Orwell rule descriptions (keep)
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

    // --- NEW: State for Active Analysis View ---
    const [activeAnalysisView, setActiveAnalysisView] =
        useState<AnalysisView>("orwell"); // Default to Orwell view
    // --- End Active View State ---

    // Resolve/Unresolve Handlers (Keep as before)
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

    // --- Analysis Handlers (Update to set active view) ---
    const handleOrwellAnalyze = useCallback(async () => {
        if (!inputText.trim()) {
            setOrwellError("Please paste some text to analyze.");
            setOrwellAnalysis(null);
            setGeneralAnalysis(null);
            setGeneralError(null);
            setResolvedIds(new Set());
            return;
        }
        setIsOrwellLoading(true);
        setOrwellError(null);
        setOrwellAnalysis(null);
        setResolvedIds(new Set());
        // Optionally clear general analysis too
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
                    // <-- FIX: Removed unused 'e'
                    errorData = {
                        error: `HTTP error ${response.status}: ${response.statusText}`,
                    };
                }
                throw new Error(
                    errorData?.error || `HTTP error ${response.status}`
                );
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawData: Omit<OrwellAnalysisResult, "id">[] | any = // Type more defensively
                await response.json();
            if (!Array.isArray(rawData)) {
                // Validate structure
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
            // <-- FIX: Replaced 'any' with 'unknown'
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
            setOrwellAnalysis(null);
            setOrwellError(null);
            setResolvedIds(new Set());
            return;
        }
        setIsGeneralLoading(true);
        setGeneralError(null);
        setGeneralAnalysis(null);
        setResolvedIds(new Set());
        // Optionally clear Orwell analysis too
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
                    // <-- FIX: Removed unused 'e'
                    errorData = {
                        error: `HTTP error ${response.status}: ${response.statusText}`,
                    };
                }
                throw new Error(
                    errorData?.error || `HTTP error ${response.status}`
                );
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawData: Omit<GeneralAnalysisResult, "id">[] | any = // Type more defensively
                await response.json();
            if (!Array.isArray(rawData)) {
                // Validate structure
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
            // <-- FIX: Replaced 'any' with 'unknown'
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

    // --- Render Highlighted Text Function (UPDATED Popover.Panel styles) ---
    const renderHighlightedText = useCallback(
        (
            textToRender: string,
            analysisData:
                | (OrwellAnalysisResult | GeneralAnalysisResult)[]
                | null,
            currentResolvedIds: Set<string>,
            onResolve: (id: string) => void,
            onUnresolve: (id: string) => void,
            getHighlightClass: (
                item: OrwellAnalysisResult | GeneralAnalysisResult
            ) => string,
            renderPopoverContentFn: (
                item: OrwellAnalysisResult | GeneralAnalysisResult,
                isResolved: boolean,
                resolveHandler: (id: string) => void,
                unresolveHandler: (id: string) => void
            ) => React.ReactNode
        ) => {
            if (!analysisData || !textToRender || analysisData.length === 0) {
                return <span>{textToRender}</span>;
            }
            const uniqueSnippets = [
                ...new Set(analysisData.map((a) => a.snippet)),
            ];
            uniqueSnippets.sort((a, b) => b.length - a.length);
            if (uniqueSnippets.length === 0) return <span>{textToRender}</span>;
            const regex = new RegExp(
                `(${uniqueSnippets.map(escapeRegex).join("|")})`,
                "gi"
            );
            // FIX: Changed 'let' to 'const' as 'parts' reference is not reassigned
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
                    parts.push({ ...suggestionData, snippet: matchedText });
                } else {
                    parts.push(matchedText);
                }
                lastIndex = regex.lastIndex;
            }
            if (lastIndex < textToRender.length) {
                parts.push(textToRender.substring(lastIndex));
            }
            const resolvedClass =
                "border border-dashed border-gray-400 mx-px rounded-md cursor-pointer text-gray-600 hover:border-gray-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-500"; // Removed px-1 for resolved

            return parts.map((part, index) => {
                if (typeof part === "object" && part !== null && "id" in part) {
                    const itemData = part as
                        | OrwellAnalysisResult
                        | GeneralAnalysisResult;
                    const isResolved = currentResolvedIds.has(itemData.id);
                    const buttonClass = isResolved
                        ? resolvedClass
                        : `${getHighlightClass(
                              itemData
                          )} px-1 mx-px rounded-md transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-opacity-75 cursor-pointer`;

                    return (
                        <Popover
                            key={`${itemData.id}-${index}`}
                            className="relative inline-block"
                        >
                            {/* FIX: Prefixed unused variables with '_' */}
                            {({ open: _open, close: _close }) => (
                                <>
                                    <Popover.Button
                                        as="span"
                                        className={buttonClass}
                                    >
                                        {" "}
                                        {itemData.snippet}{" "}
                                    </Popover.Button>
                                    <Transition
                                        as={Fragment}
                                        enter="transition ease-out duration-200"
                                        enterFrom="opacity-0 translate-y-1"
                                        enterTo="opacity-100 translate-y-0"
                                        leave="transition ease-in duration-150"
                                        leaveFrom="opacity-100 translate-y-0"
                                        leaveTo="opacity-0 translate-y-1"
                                    >
                                        {/* --- POPOVER PANEL STYLES UPDATED --- */}
                                        <Popover.Panel className="absolute z-20 w-80 max-w-md px-4 mt-2 transform -translate-x-1/2 left-1/2 sm:px-0 lg:max-w-lg">
                                            <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
                                                {/* --- INNER PADDING REDUCED --- */}
                                                <div className="relative bg-white p-3">
                                                    {renderPopoverContentFn(
                                                        itemData,
                                                        isResolved,
                                                        (id) => {
                                                            onResolve(
                                                                id
                                                            ); /* close(); */
                                                        },
                                                        (id) => {
                                                            onUnresolve(
                                                                id
                                                            ); /* close(); */
                                                        }
                                                    )}
                                                </div>
                                            </div>
                                        </Popover.Panel>
                                        {/* --- END POPOVER PANEL STYLE UPDATES --- */}
                                    </Transition>
                                </>
                            )}
                        </Popover>
                    );
                } else if (typeof part === "string") {
                    return <span key={`text-${index}`}>{part}</span>;
                }
                return null;
            });
        },
        // FIX: Removed unnecessary dependencies
        []
    );

    // --- Memoized Orwell Output (UPDATED content spacing) ---
    const renderedOrwellOutput = useMemo(() => {
        if (!inputText && !orwellAnalysis) {
            return null;
        } // Handled by conditional render later
        if (!orwellAnalysis) return null; // Handled by conditional render later
        if (orwellAnalysis.length === 0) {
            return (
                <p className="text-green-700 bg-green-50 border border-green-200 rounded-md p-4 text-center font-medium mt-4">
                    {/* FIX: Escaped apostrophe */}
                    Excellent! No violations of Orwell's rules 1-5 detected.{" "}
                </p>
            );
        }

        const getHighlightClass = (
            item: OrwellAnalysisResult | GeneralAnalysisResult
        ): string => {
            const data = item as OrwellAnalysisResult;
            let className = "bg-yellow-200 hover:bg-yellow-300 text-yellow-900";
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
        const renderPopoverContent = (
            item: OrwellAnalysisResult | GeneralAnalysisResult,
            isResolved: boolean,
            resolveHandler: (id: string) => void,
            unresolveHandler: (id: string) => void
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
                    {/* --- SPACING REDUCED --- */}
                    <p
                        className={`text-sm font-semibold mb-1 ${
                            // Kept mb-1
                            ruleColorClasses[data.rule] || "text-gray-800"
                        }`}
                    >
                        Rule {data.rule}: {ruleDescriptions[data.rule] || ""}{" "}
                    </p>
                    <p className="text-sm text-gray-900 mb-2">
                        {data.suggestion}{" "}
                    </p>
                    <div className="mt-2 pt-2 border-t border-gray-200 flex justify-end">
                        {" "}
                        {/* Reduced mt-3 pt-3 to mt-2 pt-2 */}{" "}
                        {isResolved ? (
                            <button
                                onClick={() => unresolveHandler(data.id)}
                                className="text-xs font-medium text-yellow-600 hover:text-yellow-800 focus:outline-none focus:underline"
                            >
                                {" "}
                                Mark as Unresolved{" "}
                            </button>
                        ) : (
                            <button
                                onClick={() => resolveHandler(data.id)}
                                className="text-xs font-medium text-green-600 hover:text-green-800 focus:outline-none focus:underline"
                            >
                                {" "}
                                Mark as Resolved{" "}
                            </button>
                        )}{" "}
                    </div>
                    {/* --- END SPACING REDUCTION --- */}
                </>
            );
        };

        return renderHighlightedText(
            inputText,
            orwellAnalysis,
            resolvedIds,
            handleResolve,
            handleUnresolve,
            getHighlightClass,
            renderPopoverContent
        );
    }, [
        inputText,
        orwellAnalysis,
        renderHighlightedText,
        resolvedIds,
        handleResolve,
        handleUnresolve,
    ]);

    // --- Memoized General Output (UPDATED content spacing) ---
    const renderedGeneralOutput = useMemo(() => {
        if (!inputText && !generalAnalysis) {
            return null;
        } // Handled by conditional render later
        if (!generalAnalysis) return null; // Handled by conditional render later
        if (generalAnalysis.length === 0) {
            return (
                <p className="text-sky-700 bg-sky-50 border border-sky-200 rounded-md p-4 text-center font-medium mt-4">
                    {" "}
                    Good work! No specific improvement suggestions found in this
                    pass.{" "}
                </p>
            );
        }

        // FIX: Removed unused 'item' parameter
        const getHighlightClass = (): string => {
            return "bg-purple-200 hover:bg-purple-300 text-purple-900";
        };
        const renderPopoverContent = (
            item: OrwellAnalysisResult | GeneralAnalysisResult,
            isResolved: boolean,
            resolveHandler: (id: string) => void,
            unresolveHandler: (id: string) => void
        ): React.ReactNode => {
            const data = item as GeneralAnalysisResult;
            return (
                <>
                    {/* --- SPACING REDUCED --- */}
                    <p className="text-sm font-semibold mb-1 text-purple-700">
                        Category: {data.category}{" "}
                    </p>
                    <p className="text-sm text-gray-900 mb-2">
                        {data.feedback}{" "}
                    </p>
                    <div className="mt-2 pt-2 border-t border-gray-200 flex justify-end">
                        {" "}
                        {/* Reduced mt-3 pt-3 to mt-2 pt-2 */}{" "}
                        {isResolved ? (
                            <button
                                onClick={() => unresolveHandler(data.id)}
                                className="text-xs font-medium text-yellow-600 hover:text-yellow-800 focus:outline-none focus:underline"
                            >
                                {" "}
                                Mark as Unresolved{" "}
                            </button>
                        ) : (
                            <button
                                onClick={() => resolveHandler(data.id)}
                                className="text-xs font-medium text-green-600 hover:text-green-800 focus:outline-none focus:underline"
                            >
                                {" "}
                                Mark as Resolved{" "}
                            </button>
                        )}{" "}
                    </div>
                    {/* --- END SPACING REDUCTION --- */}
                </>
            );
        };

        return renderHighlightedText(
            inputText,
            generalAnalysis,
            resolvedIds,
            handleResolve,
            handleUnresolve,
            getHighlightClass,
            renderPopoverContent
        );
    }, [
        inputText,
        generalAnalysis,
        renderHighlightedText,
        resolvedIds,
        handleResolve,
        handleUnresolve,
    ]);

    // --- Loading/Error Components (Keep as before) ---
    const LoadingSpinner = ({ color = "text-white" }: { color?: string }) => (
        <svg
            className={`animate-spin -ml-1 mr-3 h-5 w-5 ${color}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
        >
            {" "}
            <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
            ></circle>{" "}
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>{" "}
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
                {" "}
                <p className="font-semibold flex items-center">
                    {" "}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2 text-red-600"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        {" "}
                        <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                        />{" "}
                    </svg>{" "}
                    {title}{" "}
                </p>{" "}
                <p className="mt-1 ml-7 text-sm">{message}</p>{" "}
            </div>
        );
    };

    // --- JSX Structure (Keep as before) ---
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <header className="text-center mb-10 w-full max-w-4xl">
                <h1 className="text-4xl font-bold text-gray-800 mb-2 tracking-tight">
                    {" "}
                    Writing Feedback Assistant{" "}
                </h1>
                <p className="text-lg text-gray-600">
                    {" "}
                    {/* FIX: Escaped apostrophe */}
                    Refine your text with Orwell's rules and general feedback.{" "}
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
                        {" "}
                        Paste your text here:{" "}
                    </label>
                    <textarea
                        id="text-input"
                        rows={10} // Slightly reduced rows
                        className="w-full p-4 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out text-gray-900 placeholder:text-gray-400 text-base leading-relaxed"
                        placeholder="Enter text here..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
                    {" "}
                    {/* Reduced mb */}
                    <button
                        onClick={handleOrwellAnalyze}
                        disabled={isOrwellLoading || isGeneralLoading}
                        className={`px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white flex items-center justify-center group ${
                            isOrwellLoading
                                ? "bg-gray-400 cursor-not-allowed"
                                : isGeneralLoading
                                ? "bg-indigo-300 cursor-not-allowed"
                                : "bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        } transition duration-150 ease-in-out`}
                    >
                        {" "}
                        {isOrwellLoading && <LoadingSpinner />}{" "}
                        {isOrwellLoading
                            ? "Analyzing Orwell..."
                            : "Analyze Orwell Rules"}{" "}
                    </button>
                    <button
                        onClick={handleGeneralAnalyze}
                        disabled={isGeneralLoading || isOrwellLoading}
                        className={`px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white flex items-center justify-center group ${
                            isGeneralLoading
                                ? "bg-gray-400 cursor-not-allowed"
                                : isOrwellLoading
                                ? "bg-purple-300 cursor-not-allowed"
                                : "bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                        } transition duration-150 ease-in-out`}
                    >
                        {" "}
                        {isGeneralLoading && <LoadingSpinner />}{" "}
                        {isGeneralLoading
                            ? "Analyzing Style..."
                            : "Analyze General Feedback"}{" "}
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
                                {/* Optional: Show count if data exists */}
                                {orwellAnalysis &&
                                    orwellAnalysis.length > 0 &&
                                    ` (${orwellAnalysis.length})`}
                            </button>
                            <button
                                onClick={() => setActiveAnalysisView("general")}
                                className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm focus:outline-none ${
                                    activeAnalysisView === "general"
                                        ? "border-purple-500 text-purple-600" // Purple accent for general tab
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                            >
                                General Writing Feedback
                                {/* Optional: Show count if data exists */}
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
                                        <div className="prose prose-indigo max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap text-base">
                                            {renderedOrwellOutput}
                                            {/* Initial state message if no analysis run yet */}
                                            {inputText &&
                                                orwellAnalysis === null && (
                                                    <p className="text-gray-500 italic text-center mt-4">
                                                        {/* FIX: Escaped quotes */}
                                                        Click "Analyze Orwell
                                                        Rules" to see
                                                        suggestions.
                                                    </p>
                                                )}
                                            {!inputText && (
                                                <p className="text-gray-500 italic text-center mt-4">
                                                    {/* FIX: Escaped quotes */}
                                                    Enter text and click
                                                    "Analyze Orwell Rules".
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
                                            {/* Initial state message if no analysis run yet */}
                                            {inputText &&
                                                generalAnalysis === null && (
                                                    <p className="text-gray-500 italic text-center mt-4">
                                                        {/* FIX: Escaped quotes */}
                                                        Click "Analyze General
                                                        Feedback" to see
                                                        suggestions.
                                                    </p>
                                                )}
                                            {!inputText && (
                                                <p className="text-gray-500 italic text-center mt-4">
                                                    {/* FIX: Escaped quotes */}
                                                    Enter text and click
                                                    "Analyze General Feedback".
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
                    {/* FIX: Escaped apostrophe */}
                    Orwell's Rules Reference:
                </h3>
                <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm">
                    <li>
                        Never use a metaphor, simile, or other figure of speech
                        which you are used to seeing in print.
                    </li>{" "}
                    <li>Never use a long word where a short one will do.</li>{" "}
                    <li>
                        If it is possible to cut a word out, always cut it out.
                    </li>{" "}
                    <li>Never use the passive where you can use the active.</li>{" "}
                    <li>
                        Never use a foreign phrase, a scientific word, or a
                        jargon word if you can think of an everyday English
                        equivalent.
                    </li>{" "}
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
                    href="https://deepmind.google/technologies/gemini/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline"
                >
                    {" "}
                    Google Gemini{" "}
                </a>
                .
            </footer>
        </div>
    );
}
