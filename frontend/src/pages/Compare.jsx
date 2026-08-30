/*
    Compare Page
    Author: Madzibandila Charmain
    Date: 21 August 2026
*/

import { useEffect, useRef, useState } from "react";

import "./Compare.css";

import {
    getOptions,
    getDefaultCorpus,
    uploadCorpus,
    tokenizeText
} from "../api/client";

import { useAppState } from "../context/AppStateContext";

function Compare() {

    const {
        compareLanguage,
        setCompareLanguage,
        compareTokenizerOne,
        setCompareTokenizerOne,
        compareTokenizerTwo,
        setCompareTokenizerTwo,
        compareSource,
        setCompareSource,
        compareSelectedFile,
        setCompareSelectedFile,
        compareFileName,
        setCompareFileName,
        compareMetrics,
        setCompareMetrics,
        compareInitialised,
        setCompareInitialised
    } = useAppState();

    /*
        Type Anything text is kept locally to Compare.

        This prevents the Compare text box from sharing
        its value with the Inspect text box.
    */
    const [inputText, setInputText] = useState("");

    const [showCustomize, setShowCustomize] = useState(false);

    /*
        Languages and tokenizers provided by the backend.
    */
    const [languages, setLanguages] = useState([]);
    const [tokenizers, setTokenizers] = useState([]);

    /*
        Tokenized corpus for each tokenizer.
    */
    const [tokenizerOneTokens, setTokenizerOneTokens] = useState([]);
    const [tokenizerTwoTokens, setTokenizerTwoTokens] = useState([]);

    /*
        Tokenized text entered by the user for each tokenizer.
    */
    const [typedTokenizerOneTokens, setTypedTokenizerOneTokens] = useState([]);
    const [typedTokenizerTwoTokens, setTypedTokenizerTwoTokens] = useState([]);

    /*
        Metrics for typed text for each tokenizer.
    */
    const [typedTokenizerOneMetrics, setTypedTokenizerOneMetrics] =
        useState({
            tokens: 0,
            fertility: 0,
            compression: 0,
            token_premium: 0
        });

    const [typedTokenizerTwoMetrics, setTypedTokenizerTwoMetrics] =
        useState({
            tokens: 0,
            fertility: 0,
            compression: 0,
            token_premium: 0
        });

    /*
        Metrics for each tokenizer.
    */
    const [tokenizerOneMetrics, setTokenizerOneMetrics] = useState({
        tokens: 0,
        fertility: 0,
        compression: 0,
        token_premium: 0
    });

    const [tokenizerTwoMetrics, setTokenizerTwoMetrics] = useState({
        tokens: 0,
        fertility: 0,
        compression: 0,
        token_premium: 0
    });

    /*
        Loading / status state.
    */
    const [loading, setLoading] = useState(false);
    const [selectionLoading, setSelectionLoading] = useState(false);
    const [selectionStatus, setSelectionStatus] = useState("");
    const [selectionType, setSelectionType] = useState("");
    const [error, setError] = useState("");

    /*
        File input reference.
    */
    const fileInputRef = useRef(null);

    const availableMetrics = [
        "Token Count",
        "Fertility",
        "Compression",
        "Token Premium"
    ];

    /*
        Load backend options when Compare opens.
    */
    useEffect(() => {

        async function initialiseCompare() {

            try {

                setLoading(true);
                setError("");

                const result = await getOptions();

                setLanguages(result.languages || []);
                setTokenizers(result.tokenizers || []);

                const defaultLanguage =
                    result.defaults?.language || "isiZulu";

                const defaultTokenizer =
                    result.defaults?.tokenizer ||
                    result.tokenizers?.[0] ||
                    "";

                /*
                    Initialise Compare selections only once.
                    The selections are stored in AppStateContext,
                    so navigating away from Compare does not reset them.
                */
                if (!compareInitialised) {

                    if (!compareLanguage) {
                        setCompareLanguage(defaultLanguage);
                    }

                    if (!compareTokenizerOne) {

                        setCompareTokenizerOne(
                            defaultTokenizer
                        );

                        /*
                            Use a different tokenizer for panel 2 when possible.
                        */
                        const secondTokenizer =
                            result.tokenizers?.find(
                                (item) =>
                                    item !== defaultTokenizer
                            ) || defaultTokenizer;

                        setCompareTokenizerTwo(
                            secondTokenizer
                        );
                    }

                    setCompareInitialised(true);
                }

            } catch (err) {

                setError(err.message);

            } finally {

                setLoading(false);

            }
        }

        initialiseCompare();

    }, [
        compareInitialised,
        compareLanguage,
        compareTokenizerOne,
        setCompareLanguage,
        setCompareTokenizerOne,
        setCompareTokenizerTwo,
        setCompareInitialised
    ]);

    /*
        Load the default corpus for both tokenizers.
    */
    useEffect(() => {

        if (
            !compareTokenizerOne ||
            !compareTokenizerTwo ||
            !compareLanguage
        ) {
            return;
        }

        loadDefaultCorpus(
            compareLanguage,
            compareTokenizerOne,
            compareTokenizerTwo
        );

    }, [
        compareLanguage,
        compareTokenizerOne,
        compareTokenizerTwo
    ]);

    /*
        Tokenizes text entered by the user using both
        comparison tokenizers.
        A short delay prevents a backend request from being
        sent for every individual keystroke.
    */
    useEffect(() => {

        if (
            !inputText.trim() ||
            !compareTokenizerOne ||
            !compareTokenizerTwo ||
            !compareLanguage
        ) {

            setTypedTokenizerOneTokens([]);
            setTypedTokenizerTwoTokens([]);

            setTypedTokenizerOneMetrics({
                tokens: 0,
                fertility: 0,
                compression: 0,
                token_premium: 0
            });

            setTypedTokenizerTwoMetrics({
                tokens: 0,
                fertility: 0,
                compression: 0,
                token_premium: 0
            });

            return;
        }

        const timeoutId = setTimeout(async () => {

            try {

                setError("");

                const [
                    resultOne,
                    resultTwo
                ] = await Promise.all([

                    tokenizeText(
                        inputText,
                        compareLanguage,
                        compareTokenizerOne
                    ),

                    tokenizeText(
                        inputText,
                        compareLanguage,
                        compareTokenizerTwo
                    )

                ]);

                setTypedTokenizerOneTokens(
                    formatTokenizedText(
                        resultOne.tokenized_text
                    )
                );

                setTypedTokenizerTwoTokens(
                    formatTokenizedText(
                        resultTwo.tokenized_text
                    )
                );

                /*
                    Token Premium for typed text is always zero.
                */
                const typedMetricsOne =
                    formatMetrics(resultOne);

                const typedMetricsTwo =
                    formatMetrics(resultTwo);

                setTypedTokenizerOneMetrics({
                    ...typedMetricsOne,
                    token_premium: 0
                });

                setTypedTokenizerTwoMetrics({
                    ...typedMetricsTwo,
                    token_premium: 0
                });

            } catch (err) {

                setError(err.message);

            }

        }, 400);

        return () => clearTimeout(timeoutId);

    }, [
        inputText,
        compareLanguage,
        compareTokenizerOne,
        compareTokenizerTwo
    ]);

    /*
        Toggle selected metrics.
    */
    function handleMetricChange(metric) {

        setCompareMetrics((currentMetrics) => {

            if (currentMetrics.includes(metric)) {

                return currentMetrics.filter(
                    (item) => item !== metric
                );

            }

            return [...currentMetrics, metric];

        });

    }

    /*
        Converts backend tokenized text into an array.
    */
    function formatTokenizedText(tokenizedText) {

        if (Array.isArray(tokenizedText)) {
            return tokenizedText.flat();
        }

        if (typeof tokenizedText === "string") {

            return tokenizedText
                .split(/\s+/)
                .filter(Boolean);

        }

        return [];

    }

    /*
        Render tokens using the same token-pill style as Inspect.
    */
    function renderTokens(tokens) {

        if (!tokens || tokens.length === 0) {

            return "Your tokenized text will appear here.";

        }

        const visibleTokens = tokens.slice(0, 1000);

        return (

            <>

                {visibleTokens.map((token, index) => {

                    const colourIndex = index % 8;

                    return (

                        <span
                            key={`${index}-${token}`}
                            className={`token-pill token-colour-${colourIndex}`}
                        >
                            {token}
                        </span>

                    );

                })}

                {tokens.length > 1000 && (

                    <span className="token-limit-message">

                        Showing the first 1,000 tokens of{" "}
                        {tokens.length.toLocaleString()}.

                    </span>

                )}

            </>

        );

    }

    /*
        Converts backend metrics into the Compare format.
    */
    function formatMetrics(result) {

        return {

            tokens:
                result?.metrics?.token_count ?? 0,

            fertility:
                result?.metrics?.fertility ?? 0,

            compression:
                result?.metrics?.compression ?? 0,

            token_premium:
                result?.metrics?.token_premium ?? 0

        };

    }

    /*
        Loads the default corpus through both tokenizers.
    */
    async function loadDefaultCorpus(
        selectedLanguage = compareLanguage,
        selectedTokenizerOne = compareTokenizerOne,
        selectedTokenizerTwo = compareTokenizerTwo
    ) {

        try {

            setLoading(true);
            setError("");

            const [
                resultOne,
                resultTwo
            ] = await Promise.all([

                getDefaultCorpus(
                    selectedLanguage,
                    selectedTokenizerOne
                ),

                getDefaultCorpus(
                    selectedLanguage,
                    selectedTokenizerTwo
                )

            ]);

            setTokenizerOneTokens(
                formatTokenizedText(
                    resultOne.tokenized_text
                )
            );

            setTokenizerTwoTokens(
                formatTokenizedText(
                    resultTwo.tokenized_text
                )
            );

            setTokenizerOneMetrics(
                formatMetrics(resultOne)
            );

            setTokenizerTwoMetrics(
                formatMetrics(resultTwo)
            );

            setCompareSource("default");
            setCompareSelectedFile(null);
            setCompareFileName("default");

        } catch (err) {

            setError(err.message);

        } finally {

            setLoading(false);

        }

    }

    /*
        Sends an uploaded corpus through both tokenizers.
    */
    async function processUploadedCorpus(
        file,
        selectedLanguage,
        selectedTokenizerOne,
        selectedTokenizerTwo
    ) {

        try {

            setLoading(true);
            setError("");

            const [
                resultOne,
                resultTwo
            ] = await Promise.all([

                uploadCorpus(
                    file,
                    selectedLanguage,
                    selectedTokenizerOne
                ),

                uploadCorpus(
                    file,
                    selectedLanguage,
                    selectedTokenizerTwo
                )

            ]);

            setCompareSource("upload");
            setCompareSelectedFile(file);
            setCompareFileName(file.name);

            setTokenizerOneTokens(
                formatTokenizedText(
                    resultOne.tokenized_text
                )
            );

            setTokenizerTwoTokens(
                formatTokenizedText(
                    resultTwo.tokenized_text
                )
            );

            setTokenizerOneMetrics(
                formatMetrics(resultOne)
            );

            setTokenizerTwoMetrics(
                formatMetrics(resultTwo)
            );

        } catch (err) {

            setError(err.message);

        } finally {

            setLoading(false);

        }

    }

    /*
        Handle corpus file selection.
    */
    async function handleFileChange(event) {

        const file = event.target.files[0];

        if (!file) {
            return;
        }

        await processUploadedCorpus(
            file,
            compareLanguage,
            compareTokenizerOne,
            compareTokenizerTwo
        );

    }

    /*
        Changing the language reloads the same corpus
        using both tokenizers.
    */
    async function handleLanguageChange(newLanguage) {

        if (selectionLoading) {
            return;
        }

        setCompareLanguage(newLanguage);
        setSelectionLoading(true);
        setSelectionType("language");
        setSelectionStatus("Loading language...");

        try {

            setError("");

            if (compareSource === "default") {

                await loadDefaultCorpus(
                    newLanguage,
                    compareTokenizerOne,
                    compareTokenizerTwo
                );

            } else if (compareSelectedFile) {

                await processUploadedCorpus(
                    compareSelectedFile,
                    newLanguage,
                    compareTokenizerOne,
                    compareTokenizerTwo
                );

            }

            setSelectionStatus("Language ready");

        } catch (err) {

            setError(err.message);
            setSelectionStatus("Language failed");

        } finally {

            setSelectionLoading(false);

        }

    }

    /*
        Change Tokenizer 1.
    */
    async function handleTokenizerOneChange(event) {

        if (selectionLoading) {
            return;
        }

        const newTokenizer = event.target.value;

        setCompareTokenizerOne(newTokenizer);
        setSelectionLoading(true);
        setSelectionType("tokenizer");
        setSelectionStatus("Loading tokenizer 1...");

        try {

            setError("");

            if (compareSource === "default") {

                const result =
                    await getDefaultCorpus(
                        compareLanguage,
                        newTokenizer
                    );

                setTokenizerOneTokens(
                    formatTokenizedText(
                        result.tokenized_text
                    )
                );

                setTokenizerOneMetrics(
                    formatMetrics(result)
                );

            } else if (compareSelectedFile) {

                const result =
                    await uploadCorpus(
                        compareSelectedFile,
                        compareLanguage,
                        newTokenizer
                    );

                setTokenizerOneTokens(
                    formatTokenizedText(
                        result.tokenized_text
                    )
                );

                setTokenizerOneMetrics(
                    formatMetrics(result)
                );

            }

            setSelectionStatus("Tokenizer 1 ready");

        } catch (err) {

            setError(err.message);
            setSelectionStatus("Tokenizer 1 failed");

        } finally {

            setSelectionLoading(false);

        }

    }

    /*
        Change Tokenizer 2.
    */
    async function handleTokenizerTwoChange(event) {

        if (selectionLoading) {
            return;
        }

        const newTokenizer = event.target.value;

        setCompareTokenizerTwo(newTokenizer);
        setSelectionLoading(true);
        setSelectionType("tokenizer");
        setSelectionStatus("Loading tokenizer 2...");

        try {

            setError("");

            if (compareSource === "default") {

                const result =
                    await getDefaultCorpus(
                        compareLanguage,
                        newTokenizer
                    );

                setTokenizerTwoTokens(
                    formatTokenizedText(
                        result.tokenized_text
                    )
                );

                setTokenizerTwoMetrics(
                    formatMetrics(result)
                );

            } else if (compareSelectedFile) {

                const result =
                    await uploadCorpus(
                        compareSelectedFile,
                        compareLanguage,
                        newTokenizer
                    );

                setTokenizerTwoTokens(
                    formatTokenizedText(
                        result.tokenized_text
                    )
                );

                setTokenizerTwoMetrics(
                    formatMetrics(result)
                );

            }

            setSelectionStatus("Tokenizer 2 ready");

        } catch (err) {

            setError(err.message);
            setSelectionStatus("Tokenizer 2 failed");

        } finally {

            setSelectionLoading(false);

        }

    }

    /*
        Return to the default corpus.
    */
    async function handleDefault() {

        if (selectionLoading) {
            return;
        }

        setSelectionLoading(true);
        setSelectionType("default");
        setSelectionStatus("Loading default corpus...");
        setError("");

        try {

            await loadDefaultCorpus(
                compareLanguage,
                compareTokenizerOne,
                compareTokenizerTwo
            );

            setCompareFileName("default");
            setCompareSelectedFile(null);
            setCompareSource("default");

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }

            setSelectionStatus("Default corpus ready");

        } catch (err) {

            setError(err.message);
            setSelectionStatus("Default corpus failed");

        } finally {

            setSelectionLoading(false);

        }

    }

    /*
        Displays metric value.
    */
    function getMetricValue(metric, tokenizerMetrics) {

        switch (metric) {

            case "Token Count":
                return tokenizerMetrics.tokens;

            case "Fertility":
                return Number(
                    tokenizerMetrics.fertility
                ).toFixed(2);

            case "Compression":
                return Number(
                    tokenizerMetrics.compression
                ).toFixed(2);

            case "Token Premium":
                return Number(
                    tokenizerMetrics.token_premium ?? 0
                ).toFixed(2);

            default:
                return "0";

        }

    }

    return (

        <div className="compare-page">

            {/* Compare Header */}

            <div className="compare-header">

                <p className="compare-eyebrow">
                    tokenizer face-off · see what changes
                </p>

                <h1>COMPARE</h1>

                <div className="compare-bottom-row">

                    <p className="compare-subtitle">
                        Put two tokenizers through the same test.
                        <br />
                        See exactly where they differ.
                    </p>

                    <button
                        className="customize-button"
                        onClick={() =>
                            setShowCustomize(!showCustomize)
                        }
                    >
                        {showCustomize ? "Close" : "Customize"}
                    </button>

                </div>

            </div>

            {/* Customize Panel */}

            {showCustomize && (

                <div className="customize-panel">

                    <div className="customize-section">

                        <h2>Corpus language</h2>

                        <div className="round-options">

                            {languages.map((item) => (

                                <button
                                    key={item}
                                    className={`round-option ${
                                        compareLanguage === item
                                            ? "selected"
                                            : ""
                                    }`}
                                    onClick={() =>
                                        handleLanguageChange(item)
                                    }
                                    disabled={selectionLoading}
                                >
                                    {item}
                                </button>

                            ))}

                        </div>

                    </div>

                    <div className="customize-section">

                        <h2>Metrics to compare</h2>

                        <div className="round-options">

                            {availableMetrics.map((metric) => (

                                <button
                                    key={metric}
                                    className={`round-option ${
                                        compareMetrics.includes(metric)
                                            ? "selected"
                                            : ""
                                    }`}
                                    onClick={() =>
                                        handleMetricChange(metric)
                                    }
                                >
                                    {metric}
                                </button>

                            ))}

                        </div>

                    </div>

                    <div className="selection-summary">

                        <span>{compareLanguage}</span>

                        <span>
                            {compareMetrics.length} metrics selected
                        </span>

                    </div>

                </div>

            )}

            {/* Error */}

            {error && (

                <div className="compare-error">
                    {error}
                </div>

            )}

            {/* Mzansi Explorer */}

            <section className="compare-corpus-box">

                <div className="compare-corpus-heading">
                    Mzansi Explorer • Corpus Tokenization
                </div>

                <p className="compare-corpus-label">
                    {compareFileName} • {compareLanguage}
                </p>

                <div className="compare-upload-container">

                    <input
                        type="file"
                        id="compare-corpus-upload"
                        ref={fileInputRef}
                        accept=".txt"
                        onChange={handleFileChange}
                        disabled={
                            selectionLoading || loading
                        }
                    />

                    <label
                        htmlFor="compare-corpus-upload"
                        className="compare-upload-button"
                    >
                        Upload your corpus(text)
                    </label>

                    {compareFileName !== "default" && (

                        <button
                            type="button"
                            className="compare-default-button"
                            onClick={handleDefault}
                            disabled={
                                selectionLoading || loading
                            }
                        >
                            Default
                        </button>

                    )}

                </div>

                {/* Status */}

                {selectionStatus && (

                    <div
                        className={`compare-selection-status ${
                            selectionLoading
                                ? "is-loading"
                                : "is-ready"
                        }`}
                    >

                        <span className="compare-status-dot"></span>

                        <span>
                            {selectionStatus}
                        </span>

                    </div>

                )}

                {/* Two Tokenizer Displays */}

                <div className="compare-tokenization-results">

                    {/* TOKENIZER 1 */}

                    <div className="compare-tokenization-panel">

                        <div className="compare-panel-heading">
                            Tokenizer 1
                        </div>

                        <select
                            className="compare-tokenizer-select"
                            value={compareTokenizerOne}
                            onChange={handleTokenizerOneChange}
                            disabled={
                                selectionLoading || loading
                            }
                        >

                            {tokenizers.map((item) => (

                                <option
                                    key={item}
                                    value={item}
                                >
                                    {item}
                                </option>

                            ))}

                        </select>

                        <div className="compare-tokenization-result">

                            <div className="compare-tokenization-text">

                                {loading &&
                                !tokenizerOneTokens.length
                                    ? "Loading tokenized corpus..."
                                    : renderTokens(
                                        tokenizerOneTokens
                                    )}

                            </div>

                        </div>

                        {compareMetrics.length > 0 && (

                            <div className="compare-tokenization-metrics">

                                {compareMetrics.map((metric) => (

                                    <div
                                        className="compare-metric-card"
                                        key={metric}
                                    >

                                        <span className="compare-metric-name">
                                            {metric}
                                        </span>

                                        <span className="compare-metric-value">

                                            {getMetricValue(
                                                metric,
                                                tokenizerOneMetrics
                                            )}

                                        </span>

                                    </div>

                                ))}

                            </div>

                        )}

                    </div>

                    {/* TOKENIZER 2 */}

                    <div className="compare-tokenization-panel">

                        <div className="compare-panel-heading">
                            Tokenizer 2
                        </div>

                        <select
                            className="compare-tokenizer-select"
                            value={compareTokenizerTwo}
                            onChange={handleTokenizerTwoChange}
                            disabled={
                                selectionLoading || loading
                            }
                        >

                            {tokenizers.map((item) => (

                                <option
                                    key={item}
                                    value={item}
                                >
                                    {item}
                                </option>

                            ))}

                        </select>

                        <div className="compare-tokenization-result">

                            <div className="compare-tokenization-text">

                                {loading &&
                                !tokenizerTwoTokens.length
                                    ? "Loading tokenized corpus..."
                                    : renderTokens(
                                        tokenizerTwoTokens
                                    )}

                            </div>

                        </div>

                        {compareMetrics.length > 0 && (

                            <div className="compare-tokenization-metrics">

                                {compareMetrics.map((metric) => (

                                    <div
                                        className="compare-metric-card"
                                        key={metric}
                                    >

                                        <span className="compare-metric-name">
                                            {metric}
                                        </span>

                                        <span className="compare-metric-value">

                                            {getMetricValue(
                                                metric,
                                                tokenizerTwoMetrics
                                            )}

                                        </span>

                                    </div>

                                ))}

                            </div>

                        )}

                    </div>

                </div>

            </section>

            {/* Type Anything */}

            <section className="compare-text-input-box">

                <div className="compare-text-input-heading">
                    Mzansi Explorer • Type Anything
                </div>

                {/* Text entered by the user */}

                <textarea
                    className="compare-text-input-area"
                    value={inputText}
                    onChange={(event) =>
                        setInputText(event.target.value)
                    }
                    placeholder="Type or paste your text here..."
                />

                {/* Two typed-text tokenizer displays */}

                <div className="compare-typed-results">

                    {/* TOKENIZER 1 */}

                    <div className="compare-typed-panel">

                        <div className="compare-typed-panel-heading">
                            {compareTokenizerOne || "Tokenizer 1"}
                        </div>

                        <div className="compare-typed-tokenization-result">

                            <div className="compare-typed-result-text">

                                {inputText.trim()
                                    ? renderTokens(
                                        typedTokenizerOneTokens
                                    )
                                    : "Your tokenized text will appear here."}

                            </div>

                        </div>

                        {/* Tokenizer 1 metrics */}

                        {compareMetrics.length > 0 && (

                            <div className="compare-typed-metrics">

                                {compareMetrics.map((metric) => (

                                    <div
                                        className="compare-typed-metric-card"
                                        key={metric}
                                    >

                                        <span className="compare-typed-metric-name">
                                            {metric}
                                        </span>

                                        <span className="compare-typed-metric-value">

                                            {getMetricValue(
                                                metric,
                                                typedTokenizerOneMetrics
                                            )}

                                        </span>

                                    </div>

                                ))}

                            </div>

                        )}

                    </div>

                    {/* TOKENIZER 2 */}

                    <div className="compare-typed-panel">

                        <div className="compare-typed-panel-heading">
                            {compareTokenizerTwo || "Tokenizer 2"}
                        </div>

                        <div className="compare-typed-tokenization-result">

                            <div className="compare-typed-result-text">

                                {inputText.trim()
                                    ? renderTokens(
                                        typedTokenizerTwoTokens
                                    )
                                    : "Your tokenized text will appear here."}

                            </div>

                        </div>

                        {/* Tokenizer 2 metrics */}

                        {compareMetrics.length > 0 && (

                            <div className="compare-typed-metrics">

                                {compareMetrics.map((metric) => (

                                    <div
                                        className="compare-typed-metric-card"
                                        key={metric}
                                    >

                                        <span className="compare-typed-metric-name">
                                            {metric}
                                        </span>

                                        <span className="compare-typed-metric-value">

                                            {getMetricValue(
                                                metric,
                                                typedTokenizerTwoMetrics
                                            )}

                                        </span>

                                    </div>

                                ))}

                            </div>

                        )}

                    </div>

                </div>

            </section>

        </div>

    );

}

export default Compare;