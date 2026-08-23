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

function Inspect() {

    /* English is set as the initial value until backend options are loaded */
    const [language, setLanguage] = useState("English");

    /*  Selected tokenizer */
    const [tokenizer, setTokenizer] = useState("");

    /* Languages provided by the backend. */
    const [languages, setLanguages] = useState([]);

    /* Tokenizers provided by the backend. */
    const [tokenizers, setTokenizers] = useState([]);

    /*  Determines whether the user is using the default 
        corpus or an uploaded corpus.
    */
    const [source, setSource] = useState("default");

    /* Stores the actual uploaded File object. */
    const [selectedFile, setSelectedFile] = useState(null);

    /* Filename displayed to the user. */
    const [fileName, setFileName] = useState("default");

    /* Tokenized result for the corpus section. */
    const [corpusTokenizedText, setCorpusTokenizedText] = useState("");

    /* Metrics returned by FastAPI for the corpus. */
    const [corpusMetrics, setCorpusMetrics] = useState({
        tokens: 0,
        fertility: 0,
        compression: 0,
        token_premium: null
    });


    /* Stores the text typed by the use */
    const [inputText, setInputText] = useState("");

    /* Tokenized result for the Type Anything section. */
    const [typedTokenizedText, setTypedTokenizedText] = useState("");

    /* Metrics returned by FastAPI for typed text. */
    const [textMetrics, setTextMetrics] = useState({
        tokens: 0,
        fertility: 0,
        compression: 0,
        token_premium: null
    });

    /* Displays whether the frontend is currently waiting for a backend response. */
    const [loading, setLoading] = useState(false);

    /* Stores an error returned by the backend. */
    const [error, setError] = useState("");

    /* Reference to the actual file input. */
    const fileInputRef = useRef(null);

    /*  Load languages and tokenizers from the FastAPI 
        backend when the page loads. 
    */
    useEffect(() => {

        async function loadOptions() {

            try {

                setLoading(true);
                setError("");

                const result = await getOptions();

                setLanguage(result.languages);
                setTokenizers(result.tokenizers);

                const defaultLanguage = 
                    result.defaults?.language || "English";

                const defaultTokenizer = 
                    result.defaults?.tokenizer || 
                    result.tokenizers[0];

                setLanguage(defaultLanguage);
                setTokenizer(defaultTokenizer);
            }
            catch (err) {
                setError(err.message);
            }
            finally {
                setLoading(false);
            }
        }

        loadOptions();

    }, []);


    /* Handled file slection from user computer. */
    function handleFileChange(event) {
        const selectedFile = event.target.files[0];

        if (selectedFile) {
            setFileName(selectedFile.name);
        }
    }

    /* Returns the corpus back to the default state */
    function handleDefault() {
        setFileName("default");

        /* Clear the actual file selected in the browser. */
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
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
                        >
                            {tokenizers.map((item) => (
                                <option key={item} value={item}>
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
                        >

                            {languages.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                        
                    </div>

                </div>

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
                    />

                    <label htmlFor="corpus-upload" className="upload-button">
                        Upload your corpus(text)
                    </label>

                    {/* Shows Default button */}
                    {fileName !== "default" && (
                        <button
                            type="button"
                            className="default-button"
                            onClick={handleDefault}
                        >
                            Default
                        </button>
                    )}

                </div>

                {/* Tokenization Result */}
                <div className="tokenization-result">

                    <div className="tokenization-text">
                        Hello_Mutalukanyi_This_Is_Just_A_Placeholder_Replace_with_a_State
                    </div>
                </div>

                {/* Tokenization metrics */}
                <div className="tokenization-metrics">

                    <div className="metric-card">
                        <span className="metric-name">
                            Tokens
                        </span>

                        <span className="metric-value">
                            124
                        </span>
                    </div>

                    <div className="metric-card">
                        <span className="metric-name">
                            Fertility
                        </span>

                        <span className="metric-value">
                            1.23
                        </span>
                    </div>

                    <div className="metric-card">
                        <span className="metric-name">
                            Compression
                        </span>

                        <span className="metric-value">
                            512
                        </span>
                    </div>

                    <div className="metric-card">
                        <span className="metric-name">
                            Token Premium
                        </span>

                        <span className="metric-value">
                            87
                        </span>
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
                    onChange={(event) => {const text = event.target.value;
                        setInputText(text);
                        calculatedTextMetrics(text);
                    }}
                    placeholder="Type or paste your text here..."
                />

                {/*Tokenization result */}
                <div className="typed-tokenization-result">

                    <div className="typed-result-text">
                        {inputText || "Your tokenized text will appear here."}
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
                                {textMetrics.fertility.toFixed(2)}
                            </span>
                        </div>

                        {/* Compression count */}
                        <div className="typed-metric-card">
                            <span className="typed-metric-name">
                                Compression
                            </span>

                            <span className="typed-metric-value">
                                {textMetrics.compression.toFixed(2)}
                            </span>
                        </div>

                        {/* Token premium */}
                        <div className="typed-metric-card">
                            <span className="typed-metric-name">
                                Token Premium
                            </span>

                            <span className="typed-metric-value">
                                {textMetrics.tokenPremium.toFixed(2)}
                            </span>
                        </div>

                    </div>

                </div>

            </section>
        </>   
    );
}

export default Inspect;