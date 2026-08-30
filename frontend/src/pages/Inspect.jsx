/*
    Inspect Page
    Author: Madzibandila Charmain
    Date: 21 August 2026
*/

import { useEffect, useRef, useState } from "react";

import {
    getOptions,
    getDefaultCorpus,
    uploadCorpus,
    tokenizeText
} from "../api/client";

import { useAppState } from "../context/AppStateContext";

function Inspect() {

    /* Shared application state. These values are stored in AppStateContext so they remain unchanged when the user moves between different pages. */ 

    const { 

        language, 
        setLanguage,

        tokenizer, 
        setTokenizer, 

        source, 
        setSource, 

        selectedFile, 
        setSelectedFile, 

        fileName, 
        setFileName,

        corpusTokenizedText, 
        setCorpusTokenizedText, 

        corpusMetrics, 
        setCorpusMetrics, 

        typedTokenizedText, 
        setTypedTokenizedText, 

        textMetrics, 
        setTextMetrics, 

        inspectInitialised, 
        setInspectInitialised

    } = useAppState();

    /*
        Type Anything text belongs only to Inspect.

        It is intentionally not stored in AppStateContext
        so Compare has its own independent text box.
    */
    const [inputText, setInputText] = useState("");

    /* Languages provided by the backend. */

    const [languages, setLanguages] = useState([]);

    /* Tokenizers provided by the backend. */

    const [tokenizers, setTokenizers] = useState([]);

    /* Displays whether the frontend is currently waiting for a backend response. */

    const [loading, setLoading] = useState(false);

    const [selectionLoading, setSelectionLoading] = useState(false);

    const [selectionStatus, setSelectionStatus] = useState("");

    const [selectionType, setSelectionType] = useState("");

    /* Stores an error returned by the backend. */

    const [error, setError] = useState("");

    /* Reference to the actual file input. */

    const fileInputRef = useRef(null);

    /*  Load languages and tokenizers from the FastAPI 
        backend when the page loads. 
    */

    useEffect(() => {

        async function initialiseInspect() {

            try {

                setLoading(true);
                setError("");

                const result = await getOptions();

                setLanguages(result.languages);
                setTokenizers(result.tokenizers);

                if (!inspectInitialised) { 

                    const defaultLanguage = 
                        result.defaults?.language || "English"; 

                    const defaultTokenizer = 
                        result.defaults?.tokenizer || result.tokenizers[0]; 

                    setLanguage(defaultLanguage); 
                    setTokenizer(defaultTokenizer); 

                    const defaultResult = 
                        await getDefaultCorpus(
                            defaultLanguage,
                            defaultTokenizer
                        ); 

                    setCorpusTokenizedText(
                        formatTokenizedText(
                            defaultResult.tokenized_text
                        )
                    ); 

                    setCorpusMetrics({ 

                        tokens:
                            defaultResult.metrics.token_count ?? 0, 

                        fertility:
                            defaultResult.metrics.fertility ?? 0, 

                        compression:
                            defaultResult.metrics.compression ?? 0, 

                        token_premium:
                            defaultResult.metrics.token_premium ?? null

                    }); 

                    setInspectInitialised(true); 

                } 

            } 

            catch (err) { 

                setError(err.message); 

            } 

            finally { 

                setLoading(false); 

            } 

        }

        initialiseInspect(); 

    }, [ 

        inspectInitialised, 
        setLanguage, 
        setTokenizer, 
        setCorpusTokenizedText, 
        setCorpusMetrics, 
        setInspectInitialised 

    ]);

    //The second useEffect

    useEffect(() => {

        if (!inputText.trim() || !tokenizer) {

            setTypedTokenizedText([]);

            setTextMetrics({

                tokens: 0,
                fertility: 0,
                compression: 0,
                token_premium: 0

            });

            return;

        }

        const timeoutId = setTimeout(

            async () => {

                try {

                    setLoading(true);
                    setError("");

                    const result = await tokenizeText(

                        inputText,
                        language,
                        tokenizer

                    );

                    setTypedTokenizedText(

                        formatTokenizedText(
                            result.tokenized_text
                        )

                    );

                    setTextMetrics({

                        tokens:
                            result.metrics.token_count ?? 0,

                        fertility:
                            result.metrics.fertility ?? 0,

                        compression:
                            result.metrics.compression ?? 0,

                        token_premium: 0

                    });

                }

                catch (err) {

                    setError(err.message);

                } 

                finally {

                    setLoading(false);

                }

            },

            400

        );

        return () => clearTimeout(timeoutId);

    }, [
        inputText, 
        language, 
        tokenizer, 
        setTypedTokenizedText, 
        setTextMetrics
    ]);

    /* Loads default Corpus */

    async function loadDefaultCorpus(

        selectedLanguage = language,

        selectedTokenizer = tokenizer

    ){

        try {

            setLoading(true);
            setError("");

            const result = await getDefaultCorpus(

                selectedLanguage,
                selectedTokenizer

            );

            setCorpusTokenizedText(

                formatTokenizedText(
                    result.tokenized_text
                )

            );

            setCorpusMetrics({

                tokens:
                    result.metrics.token_count ?? 0,

                fertility:
                    result.metrics.fertility ?? 0,

                compression:
                    result.metrics.compression ?? 0,

                token_premium:
                    result.metrics.token_premium

            });

        }

        catch (err) {

            setError(err.message);

            throw err;

        }

        finally {

            setLoading(false);

        }

    }

    //Connects the upload button to the backend

    async function processUploadedCorpus(

        file,

        selectedLanguage,

        selectedTokenizer

    ) {

        try {

            setLoading(true);
            setError("");

            const result = await uploadCorpus(

                file,
                selectedLanguage,
                selectedTokenizer

            );

            setSource("upload")

            setSelectedFile(file);

            setFileName(file.name);

            setCorpusTokenizedText(

                formatTokenizedText(
                    result.tokenized_text
                )

            );

            setCorpusMetrics({

                tokens:
                    result.metrics.token_count ?? 0,

                fertility:
                    result.metrics.fertility ?? 0,

                compression:
                    result.metrics.compression ?? 0,

                token_premium: 0

            });

        }

        catch (err) {

            setError(err.message);

            throw err;

        }

        finally {

            setLoading(false);

        }

    }

    async function handleLanguageChange(event) {

        if (selectionLoading) {
            return;
        }

        const newLanguage = event.target.value;

        setLanguage(newLanguage);

        setSelectionLoading(true);

        setSelectionType("language");

        setSelectionStatus("Loading language...");

        /* Ensures changing language should load new language's
            default corpus
        */

        try {

            setError("");

            if (source === "default") {

                await loadDefaultCorpus(

                    newLanguage,
                    tokenizer

                );

            }

            else if (selectedFile) {

                await processUploadedCorpus(

                    selectedFile,
                    newLanguage,
                    tokenizer

                );

            }

            setSelectionStatus("Language ready");

        }

        catch (err) {

            setError(err.message);

            setSelectionStatus("Language failed");

        }

        finally {

            setSelectionLoading(false);

        }

    }

    async function handleTokenizerChange(event) {

        if (selectionLoading) {
            return;
        }

        const newTokenizer = event.target.value;

        setTokenizer(newTokenizer);

        setSelectionLoading(true);

        setSelectionType("tokenizer");

        setSelectionStatus("Loading tokenizer...");

        try {

            setError("");

            if (source === "default") {

                await loadDefaultCorpus(

                    language,
                    newTokenizer

                );

            }

            else if (selectedFile) {

                await processUploadedCorpus(

                    selectedFile,
                    language,
                    newTokenizer

                );

            }

            setSelectionStatus("Tokenizer ready");

        }

        catch (err) {

            setError(err.message);

            setSelectionStatus("Tokenizer failed");

        }

        finally {

            setSelectionLoading(false);

        }

    }

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

    /* Handled file slection from user computer. */

    async function handleFileChange(event) {

        const file = event.target.files[0];

        if (!file) {
            return;
        }

        await processUploadedCorpus(

            file,
            language,
            tokenizer

        );

    }

    /* Returns the corpus back to the default state */

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
                tokenizer
            );

            setFileName("default");

            setSelectedFile(null);

            setSource("default");

            if (fileInputRef.current) {

                fileInputRef.current.value = "";

            }

            setSelectionStatus("Default corpus ready");

        }

        catch (err) {

            setError(err.message);

            setSelectionStatus("Default corpus failed");

        }

        finally {

            setSelectionLoading(false);

        }

    }

    // Cycles through the 8 CSS colors for the tokens

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

    return (

        <>

            <section className="inspect-intro">

                {/* Description of what the Inspect page does */}

                <p className="inspect-label">
                    INSPECT
                </p>

                <h1>
                    From isiXhosa to Setswana, See the Language Beneath.
                </h1>

                <p className="inspect-description">

                    Pick a tokenizer, choose a language and explore how your
                    text is broken down into subword tokens the model can understand.

                </p>

            </section>

            {/* Tokenizer and Language selection box */}

            <section className="inspect-controls">

                {/* Left side containing the 2 dropdowns */}

                <div className="inspect-filters">

                    {/* Tokenizer Dropdown */}

                    <div className="filter-group">

                        <label htmlFor="tokenizer">
                            Tokenizer
                        </label>

                        <select
                            id="tokenizer"
                            value={tokenizer}
                            onChange={handleTokenizerChange}
                            disabled={selectionLoading}
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

                    </div>

                    {/* Language dropdown */}

                    <div className="filter-group">

                        <label htmlFor="language">
                            Language
                        </label>

                        <select
                            id="language"
                            value={language}
                            onChange={handleLanguageChange}
                            disabled={selectionLoading}
                        >

                            {languages.map((item) => (

                                <option
                                    key={item}
                                    value={item}
                                >
                                    {item}
                                </option>

                            ))}

                        </select>

                    </div>

                </div>

                {selectionStatus && (

                    <div
                        className={`selection-status ${
                            selectionLoading
                                ? "is-loading"
                                : "is-ready"
                        }`}
                    >

                        <span className="status-dot"></span>

                        <span>
                            {selectionStatus}
                        </span>

                    </div>

                )}

            </section>

            {/* Corpus tokenization box */}

            <section className="corpus-box">

                <div className="corpus-heading">
                    Mzansi Explorer • Corpus Tokenization
                </div>

                <p className="corpus-label">

                    {fileName} • {language} • {tokenizer}

                </p>

                <div className="upload-container">

                    <input
                        type="file"
                        id="corpus-upload"
                        ref={fileInputRef}
                        accept=".txt"
                        onChange={handleFileChange}
                        disabled={selectionLoading}
                    />

                    <label
                        htmlFor="corpus-upload"
                        className="upload-button"
                    >
                        Upload your corpus(text)
                    </label>

                    {/* Shows Default button */}

                    {fileName !== "default" && (

                        <button
                            type="button"
                            className="default-button"
                            onClick={handleDefault}
                            disabled={selectionLoading}
                        >
                            Default
                        </button>

                    )}

                </div>

                {/* Tokenization Result */}

                <div className="tokenization-result">

                    <div className="tokenization-text">

                        {renderTokens(
                            corpusTokenizedText
                        )}

                    </div>

                </div>

                {/* Tokenization metrics */}

                <div className="tokenization-metrics">

                    {/* Row 1 - Existing metrics */}

                    <div className="metric-row">

                        <div className="metric-card">

                            <span className="metric-name">
                                Tokens
                            </span>

                            <span className="metric-value">
                                {corpusMetrics.tokens}
                            </span>

                        </div>

                        <div className="metric-card">

                            <span className="metric-name">
                                Fertility
                            </span>

                            <span className="metric-value">

                                {Number(
                                    corpusMetrics.fertility
                                ).toFixed(2)}

                            </span>

                        </div>

                        <div className="metric-card">

                            <span className="metric-name">
                                Compression
                            </span>

                            <span className="metric-value">

                                {Number(
                                    corpusMetrics.compression
                                ).toFixed(2)}

                            </span>

                        </div>

                        <div className="metric-card">

                            <span className="metric-name">
                                Token Premium
                            </span>

                            <span className="metric-value">

                                {corpusMetrics.token_premium === null

                                    ? "N/A"

                                    : Number(
                                        corpusMetrics.token_premium
                                    ).toFixed(2)

                                }

                            </span>

                        </div>

                    </div>

                    {/* Row 2 - Placeholder metrics */}

                    <div className="metric-row metric-row-centered">

                        <div className="metric-card">

                            <span className="metric-name">
                                Precision
                            </span>

                            <span className="metric-value">
                                0.00
                            </span>

                        </div>

                        <div className="metric-card">

                            <span className="metric-name">
                                F1
                            </span>

                            <span className="metric-value">
                                0.00
                            </span>

                        </div>

                        <div className="metric-card">

                            <span className="metric-name">
                                Recall
                            </span>

                            <span className="metric-value">
                                0.00
                            </span>

                        </div>

                    </div>

                </div>

            </section>

            {/* Text input box */}

            <section className="text-input-box">

                <div className="text-input-heading">
                    Mzansi Explorer • Type Anything
                </div>

                {/* Text entered by the user */}

                <textarea
                    className="text-input-area"
                    value={inputText}
                    onChange={(event) =>
                        setInputText(event.target.value)
                    }
                    placeholder="Type or paste your text here..."
                />

                {/*Tokenization result */}

                <div className="typed-tokenization-result">

                    <div className="typed-result-text">

                        {renderTokens(typedTokenizedText) ||
                            "Your tokenized text will appear here."}

                    </div>

                    {/* Metrics for the typed text */}

                    <div className="typed-tokenization-metrics">

                        {/* Token count */}

                        <div className="typed-metric-card">

                            <span className="typed-metric-name">
                                Tokens
                            </span>

                            <span className="typed-metric-value">
                                {textMetrics.tokens}
                            </span>

                        </div>

                        {/* Fertility */}

                        <div className="typed-metric-card">

                            <span className="typed-metric-name">
                                Fertility
                            </span>

                            <span className="typed-metric-value">

                                {Number(
                                    textMetrics.fertility
                                ).toFixed(2)}

                            </span>

                        </div>

                        {/* Compression count */}

                        <div className="typed-metric-card">

                            <span className="typed-metric-name">
                                Compression
                            </span>

                            <span className="typed-metric-value">

                                {Number(
                                    textMetrics.compression
                                ).toFixed(2)}

                            </span>

                        </div>

                        {/* Token premium */}

                        <div className="typed-metric-card">

                            <span className="typed-metric-name">
                                Token Premium
                            </span>

                            <span className="typed-metric-value">

                                {textMetrics.token_premium === null

                                    ? "N/A"

                                    : Number(
                                        textMetrics.token_premium
                                    ).toFixed(2)

                                }

                            </span>

                        </div>

                    </div>

                </div>

            </section>

        </>

    );

}

export default Inspect;