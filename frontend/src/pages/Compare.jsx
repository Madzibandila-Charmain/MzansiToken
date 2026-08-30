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
    uploadCorpus
} from "../api/client";

function Compare() {

    const [showCustomize, setShowCustomize] = useState(false);

    const [language, setLanguage] = useState("isiZulu");

    /* Tokenizers used by the two comparison panels. */
    const [tokenizerOne, setTokenizerOne] = useState("");
    const [tokenizerTwo, setTokenizerTwo] = useState("");

    /* Languages and tokenizers provided by the backend. */
    const [languages, setLanguages] = useState([]);
    const [tokenizers, setTokenizers] = useState([]);

    /* Corpus state. */
    const [source, setSource] = useState("default");
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileName, setFileName] = useState("default");

    /* Tokenized corpus for each tokenizer. */
    const [tokenizerOneTokens, setTokenizerOneTokens] = useState([]);
    const [tokenizerTwoTokens, setTokenizerTwoTokens] = useState([]);

    /* Metrics for each tokenizer. */
    const [tokenizerOneMetrics, setTokenizerOneMetrics] = useState({
        tokens: 0,
        fertility: 0,
        compression: 0,
        token_premium: null
    });

    const [tokenizerTwoMetrics, setTokenizerTwoMetrics] = useState({
        tokens: 0,
        fertility: 0,
        compression: 0,
        token_premium: null
    });

    /* Loading / status state. */
    const [loading, setLoading] = useState(false);
    const [selectionLoading, setSelectionLoading] = useState(false);
    const [selectionStatus, setSelectionStatus] = useState("");
    const [selectionType, setSelectionType] = useState("");
    const [error, setError] = useState("");

    /* File input reference. */
    const fileInputRef = useRef(null);

    /* Metrics selected through Customize. */
    const [metrics, setMetrics] = useState([
        "Token Count",
        "Fertility",
        "Compression",
        "Token Premium"
    ]);

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
                    result.defaults?.language || "English";

                const defaultTokenizer =
                    result.defaults?.tokenizer ||
                    result.tokenizers?.[0] ||
                    "";

                setLanguage(defaultLanguage);
                setTokenizerOne(defaultTokenizer);

                /* Use a different tokenizer for panel 2 when possible. */
                const secondTokenizer =
                    result.tokenizers?.find(
                        (item) => item !== defaultTokenizer
                    ) || defaultTokenizer;

                setTokenizerTwo(secondTokenizer);

            } catch (err) {

                setError(err.message);

            } finally {

                setLoading(false);

            }
        }

        initialiseCompare();

    }, []);

    /*
        Load the default corpus for both tokenizers.
    */
    useEffect(() => {

        if (!tokenizerOne || !tokenizerTwo || !language) {
            return;
        }

        loadDefaultCorpus(
            language,
            tokenizerOne,
            tokenizerTwo
        );

    }, [language, tokenizerOne, tokenizerTwo]);

    /*
        Toggle selected metrics.
    */
    function handleMetricChange(metric) {

        setMetrics((currentMetrics) => {

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
            tokens: result?.metrics?.token_count ?? 0,
            fertility: result?.metrics?.fertility ?? 0,
            compression: result?.metrics?.compression ?? 0,
            token_premium:
                result?.metrics?.token_premium ?? null
        };

    }

    /*
        Loads the default corpus through both tokenizers.
    */
    async function loadDefaultCorpus(
        selectedLanguage = language,
        selectedTokenizerOne = tokenizerOne,
        selectedTokenizerTwo = tokenizerTwo
    ) {

        try {

            setLoading(true);
            setError("");

            const [resultOne, resultTwo] =
                await Promise.all([

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

            setSource("default");
            setSelectedFile(null);
            setFileName("default");

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

            const [resultOne, resultTwo] =
                await Promise.all([

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

            setSource("upload");
            setSelectedFile(file);
            setFileName(file.name);

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
            language,
            tokenizerOne,
            tokenizerTwo
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

        setLanguage(newLanguage);

        setSelectionLoading(true);
        setSelectionType("language");
        setSelectionStatus("Loading language...");

        try {

            setError("");

            if (source === "default") {

                await loadDefaultCorpus(
                    newLanguage,
                    tokenizerOne,
                    tokenizerTwo
                );

            } else if (selectedFile) {

                await processUploadedCorpus(
                    selectedFile,
                    newLanguage,
                    tokenizerOne,
                    tokenizerTwo
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

        setTokenizerOne(newTokenizer);

        setSelectionLoading(true);
        setSelectionType("tokenizer");
        setSelectionStatus("Loading tokenizer 1...");

        try {

            setError("");

            if (source === "default") {

                const result = await getDefaultCorpus(
                    language,
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

            } else if (selectedFile) {

                const result = await uploadCorpus(
                    selectedFile,
                    language,
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

        setTokenizerTwo(newTokenizer);

        setSelectionLoading(true);
        setSelectionType("tokenizer");
        setSelectionStatus("Loading tokenizer 2...");

        try {

            setError("");

            if (source === "default") {

                const result = await getDefaultCorpus(
                    language,
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

            } else if (selectedFile) {

                const result = await uploadCorpus(
                    selectedFile,
                    language,
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
                language,
                tokenizerOne,
                tokenizerTwo
            );

            setFileName("default");
            setSelectedFile(null);
            setSource("default");

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

                return tokenizerMetrics.token_premium === null ||
                    tokenizerMetrics.token_premium === undefined
                    ? "N/A"
                    : Number(
                        tokenizerMetrics.token_premium
                    ).toFixed(2);

            default:

                return "N/A";
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
                                        language === item
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
                                        metrics.includes(metric)
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

                        <span>{language}</span>

                        <span>
                            {metrics.length} metrics selected
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
                    {fileName} • {language}
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

                    {fileName !== "default" && (

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
                            value={tokenizerOne}
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

                        {metrics.length > 0 && (

                            <div className="compare-tokenization-metrics">

                                {metrics.map((metric) => (

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
                            value={tokenizerTwo}
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

                        {metrics.length > 0 && (

                            <div className="compare-tokenization-metrics">

                                {metrics.map((metric) => (

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

        </div>

    );

}

export default Compare;