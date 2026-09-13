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

    tokenizeText,

    getMBI,

    getTokenizerInfo

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

    const [selectedLanguages, setSelectedLanguages] = useState(() => {

        const savedLanguages =
            localStorage.getItem("inspectSelectedLanguages");

        if (savedLanguages) {

            try {

                return JSON.parse(savedLanguages);

            }

            catch (err) {

                return [];

            }

        }

        return [];

    });

    const [languageData, setLanguageData] = useState(() => {

        const savedLanguageData =
            localStorage.getItem("inspectLanguageData");

        if (savedLanguageData) {

            try {

                return JSON.parse(savedLanguageData);

            }

            catch (err) {

                return {};

            }

        }

        return {};

    });

    /* Tokenizers provided by the backend. */

    const [tokenizers, setTokenizers] = useState([]);

    const [tokenizerInput, setTokenizerInput] = useState("");

    /* Language menu */

    const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

    /* Displays whether the frontend is currently waiting for a backend response. */

    const [loading, setLoading] = useState(false);

    const [mbiLoading, setMbiLoading] = useState(false);

    const [selectionLoading, setSelectionLoading] = useState(false);

    const [tokenizerStatus, setTokenizerStatus] = useState("");

    const [languageStatus, setLanguageStatus] = useState("");

    /* Stores an error returned by the backend. */

    const [error, setError] = useState("");

    const [mbiError, setMbiError] = useState("");

    const [mbiUnavailable, setMbiUnavailable] = useState("");

    const [mbiMetrics, setMbiMetrics] = useState({

        precision: 0,

        recall: 0,

        f1: 0

    });

    /* Reference to the actual file input. */

    const fileInputRef = useRef(null);

    /*
        Save selected languages so they remain unchanged
        when the user moves between different pages.
    */

    useEffect(() => {

        localStorage.setItem(
            "inspectSelectedLanguages",
            JSON.stringify(selectedLanguages)
        );

    }, [selectedLanguages]);

    /*
        Save language results so they remain unchanged
        when the user moves between different pages.
    */

    useEffect(() => {

        localStorage.setItem(
            "inspectLanguageData",
            JSON.stringify(languageData)
        );

    }, [languageData]);

    /* Load languages and tokenizers from the FastAPI
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
                        result.defaults?.tokenizer || "gpt2";

                    setLanguage(defaultLanguage);

                    setTokenizer(defaultTokenizer);

                    setSelectedLanguages([defaultLanguage]);

                    setTokenizerInput(defaultTokenizer);

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

                    setLanguageData({

                        [defaultLanguage]: {

                            tokenizedText:
                                formatTokenizedText(
                                    defaultResult.tokenized_text
                                ),

                            metrics: {

                                tokens:
                                    defaultResult.metrics.token_count ?? 0,

                                fertility:
                                    defaultResult.metrics.fertility ?? 0,

                                compression:
                                    defaultResult.metrics.compression ?? 0,

                                token_premium:
                                    defaultResult.metrics.token_premium ?? null

                            },

                            mbi: null

                        }

                    });

                    if (hasMbiMetrics(defaultLanguage)) {
                        try {
                            const defaultMbiResult = await getMBI(
                                defaultTokenizer,
                                defaultLanguage
                            );
                            setLanguageData((previousData) => ({
                                ...previousData,
                                [defaultLanguage]: {
                                    ...previousData[defaultLanguage],
                                    mbi: {
                                        precision:
                                            defaultMbiResult.metrics.precision ?? 0,
                                        recall:
                                            defaultMbiResult.metrics.recall ?? 0,
                                        f1:
                                            defaultMbiResult.metrics.f1 ?? 0
                                    }
                                }
                            }));
                        }
                        catch (err) {
                            setLanguageData((previousData) => ({
                                ...previousData,
                                [defaultLanguage]: {
                                    ...previousData[defaultLanguage],
                                    mbi: null
                                }
                            }));
                        }
                    }                    

                    await loadMbiMetrics(

                        defaultLanguage,

                        defaultTokenizer

                    );

                    setInspectInitialised(true);

                }

                else {

                    if (

                        selectedLanguages.length === 0 &&

                        language

                    ) {

                        setSelectedLanguages([language]);

                    }

                    setTokenizerInput(tokenizer);

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

    function hasMbiMetrics(selectedLanguage) {
        return selectedLanguage !== "English";
    }

    async function loadMbiMetrics(
        selectedLanguage = language,
        selectedTokenizer = tokenizer
    ) {
        if (!hasMbiMetrics(selectedLanguage)) {
            setMbiMetrics({
                precision: 0,
                recall: 0,
                f1: 0
            });

            setMbiError("");
            setMbiUnavailable("");

            return;
        }

        try {
            setMbiLoading(true);
            setMbiError("");
            setMbiUnavailable("");

            const result = await getMBI(
                selectedTokenizer,
                selectedLanguage
            );

            setMbiMetrics({
                precision:
                    result.metrics.precision ?? 0,
                recall:
                    result.metrics.recall ?? 0,
                f1:
                    result.metrics.f1 ?? 0
            });
        } catch (err) {
            if (err.message?.includes("Unsupported language")) {
                setMbiMetrics({
                    precision: 0,
                    recall: 0,
                    f1: 0
                });
                setMbiUnavailable(
                    `${selectedLanguage} does not have MBI metrics.`
                );
                return;
            }

            setMbiError(err.message);
            throw err;
        } finally {
            setMbiLoading(false);
        }
    }

    //The second useEffect

    useEffect(() => {

        if (!inputText.trim() || !tokenizer) {

            setTypedTokenizedText([]);

            setTextMetrics({
                tokens: 0,
                fertility: 0,
                compression: 0,
            });

            return;
        }

        const timeoutId = setTimeout(

            async () => {

                try {

                    setLoading(true);
                    setError("");

                    const sentences = inputText

                        .split(/(?<=[.!?])/)
                        .map((sentence) => sentence.trim())
                        .filter((sentence) => sentence.length > 0);

                    const tokenizedSentences = [];

                    for (const sentence of sentences) {

                        const sentenceResult = await tokenizeText(

                            sentence,
                            language,
                            tokenizer
                        );

                        tokenizedSentences.push(

                            formatTokenizedText(
                                sentenceResult.tokenized_text
                            )

                        );

                    }

                    setTypedTokenizedText(tokenizedSentences);

                    const result = await tokenizeText(

                        inputText,
                        language,
                        tokenizer
                    );

                    setTextMetrics({

                        tokens:
                            result.metrics.token_count ?? 0,

                        fertility:
                            result.metrics.fertility ?? 0,

                        compression:
                            result.metrics.compression ?? 0,

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

            await loadMbiMetrics(
                selectedLanguage,
                selectedTokenizer
            );

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

    async function handleLanguageChange(newLanguage) {

        if (selectionLoading) {
            return;
        }

        setSelectionLoading(true);

        setLanguageStatus(`Loading ${newLanguage}`);

        setError("");

        try {

            let result;

            if (source === "default") {

                result = await getDefaultCorpus(
                    newLanguage,
                    tokenizer
                );
            }

            else if (selectedFile) {

                result = await uploadCorpus(
                    selectedFile,
                    newLanguage,
                    tokenizer
                );

            }

            let mbiResult = null;

            if (hasMbiMetrics(newLanguage)) {
                try {
                    mbiResult = await getMBI(
                        tokenizer,
                        newLanguage
                    );
                }
                catch (err) {
                    mbiResult = null;
                }
            } 

            setLanguageData((previousData) => ({

                ...previousData,

                [newLanguage]: {

                    tokenizedText: formatTokenizedText(

                        result.tokenized_text

                    ),

                    metrics: {

                        tokens:
                            result.metrics.token_count ?? 0,

                        fertility:
                            result.metrics.fertility ?? 0,

                        compression:
                            result.metrics.compression ?? 0,

                        token_premium:
                            result.metrics.token_premium ?? null

                    },

                    mbi: mbiResult

                        ? {

                            precision:
                                mbiResult.metrics.precision ?? 0,

                            recall:
                                mbiResult.metrics.recall ?? 0,

                            f1:
                                mbiResult.metrics.f1 ?? 0

                        }

                        : null

                }

            }));

            setLanguage(newLanguage);

            setLanguageStatus("Language ready.");

        }

        catch (err) {

            setError(err.message);

            setLanguageStatus("Could not load language corpus.");

        }

        finally {

            setSelectionLoading(false);

        }

    }

    async function toggleLanguage(selectedLanguage) {

        if (selectionLoading) {
            return;
        }

        if (selectedLanguages.includes(selectedLanguage)) {

            // Deselect language

            setSelectedLanguages((previousLanguages) =>

                previousLanguages.filter(

                    (item) => item !== selectedLanguage

                )

            );

            // Remove its stored results

            setLanguageData((previousData) => {

                const updatedData = {

                    ...previousData

                };

                delete updatedData[selectedLanguage];

                return updatedData;

            });

            // If the removed language was active,

            // make another selected language active.

            if (language === selectedLanguage) {

                const remainingLanguages =

                    selectedLanguages.filter(

                        (item) => item !== selectedLanguage

                    );

                if (remainingLanguages.length > 0) {

                    setLanguage(remainingLanguages[0]);

                }

            }

            return;

        }

        let updatedLanguages = [...selectedLanguages];

        // Maximum of 4 languages

        if (updatedLanguages.length >= 4) {

            const removedLanguage = updatedLanguages.shift();

            setLanguageData((previousData) => {

                const updatedData = {

                    ...previousData

                };

                delete updatedData[removedLanguage];

                return updatedData;

            });

        }

        updatedLanguages.push(selectedLanguage);

        setSelectedLanguages(updatedLanguages);

        await handleLanguageChange(selectedLanguage);

    }

    function formatTokenizedText(tokenizedText) {

        if (!tokenizedText) {

            return [];

        }

        // Backend returned a list of tokens

        if (Array.isArray(tokenizedText)) {

            return tokenizedText;

        }

        // Backend returned text as a string

        if (typeof tokenizedText === "string") {

            return tokenizedText

                .split(/\n+/)

                .map((sentence) =>

                    sentence.split(/\s+/).filter(Boolean)

                )

                .filter((sentence) => sentence.length > 0);

        }

        return [];

    }

    /* Handled file slection from user computer. */

    async function handleFileChange(event) {

        const file = event.target.files[0];

        if (!file) {

            return;

        }

        try {

            setLoading(true);

            setError("");

            await processUploadedCorpus(

                file,

                language,

                tokenizer

            );

            await loadMbiMetrics(

                language,

                tokenizer

            );

            const result = await uploadCorpus(

                file,

                language,

                tokenizer

            );

            setLanguageData((previousData) => ({

                ...previousData,

                [language]: {

                    tokenizedText:
                        formatTokenizedText(

                            result.tokenized_text

                        ),

                    metrics: {

                        tokens:
                            result.metrics.token_count ?? 0,

                        fertility:
                            result.metrics.fertility ?? 0,

                        compression:
                            result.metrics.compression ?? 0,

                        token_premium:
                            result.metrics.token_premium ?? null

                    },

                    mbi: previousData[language]?.mbi ?? null

                }

            }));

        }

        catch (err) {

            setError(err.message);

        }

        finally {

            setLoading(false);

        }

    }

    async function handleTokenizerInput(event) {

        if (event.key !== "Enter") {
            return;
        }

        const newTokenizer = tokenizerInput.trim();

        if (!newTokenizer) {
            return;
        }

        if (selectionLoading) {
            return;
        }

        setSelectionLoading(true);
        setTokenizerStatus("Loading tokenizer...");
        setError("");

        try {

            /*
                First check that the tokenizer entered by the user
                is available in the backend.
            */
            await getTokenizerInfo(newTokenizer);

            /*
                Use all currently selected languages.

                If for some reason no languages are selected,
                fall back to the active language.
            */
            const languagesToProcess =
                selectedLanguages.length > 0
                    ? selectedLanguages
                    : [language];

            /*
                Store the results for every selected language.

                Each language is sent to the backend together with
                the NEW tokenizer.
            */
            const updatedLanguageData = {};

            for (const selectedLanguage of languagesToProcess) {

                let result;

                /*
                    Default corpus:
                    send the selected language AND the newly typed
                    tokenizer to the backend.
                */
                if (source === "default") {

                    result = await getDefaultCorpus(
                        selectedLanguage,
                        newTokenizer
                    );

                }

                /*
                    Uploaded corpus:
                    send the uploaded file, selected language AND
                    the newly typed tokenizer to the backend.
                */
                else if (selectedFile) {

                    result = await uploadCorpus(
                        selectedFile,
                        selectedLanguage,
                        newTokenizer
                    );

                }

                /*
                    If there is no corpus available, there is nothing
                    to tokenize for this language.
                */
                else {

                    continue;

                }

                /*
                    Load MBI for this language using the NEW tokenizer.
                */
                let mbiResult = null;

                if (hasMbiMetrics(selectedLanguage)) {

                    try {

                        mbiResult = await getMBI(
                            newTokenizer,
                            selectedLanguage
                        );

                    }
                    catch (err) {

                        /*
                            Some languages may not have MBI metrics.
                            This should not stop the tokenizer from
                            being applied to the language.
                        */
                        mbiResult = null;

                    }

                }

                /*
                    Save the newly tokenized result and metrics for
                    this language.
                */
                updatedLanguageData[selectedLanguage] = {

                    tokenizedText:
                        formatTokenizedText(
                            result.tokenized_text
                        ),

                    metrics: {

                        tokens:
                            result.metrics.token_count ?? 0,

                        fertility:
                            result.metrics.fertility ?? 0,

                        compression:
                            result.metrics.compression ?? 0,

                        token_premium:
                            result.metrics.token_premium ?? null

                    },

                    mbi: mbiResult
                        ? {

                            precision:
                                mbiResult.metrics.precision ?? 0,

                            recall:
                                mbiResult.metrics.recall ?? 0,

                            f1:
                                mbiResult.metrics.f1 ?? 0

                        }
                        : null

                };

            }

            /*
                Update all selected language results at once.
            */
            setLanguageData(updatedLanguageData);

            /*
                The typed tokenizer becomes the active tokenizer
                for the entire Inspect page.
            */
            setTokenizer(newTokenizer);

            /*
                Also update the main corpus display to show the
                currently active language's result.
            */
            if (updatedLanguageData[language]) {

                setCorpusTokenizedText(
                    updatedLanguageData[language].tokenizedText
                );

                setCorpusMetrics(
                    updatedLanguageData[language].metrics
                );

            }

            /*
                Update the MBI display for the currently active language.
            */
            if (hasMbiMetrics(language)) {

                const activeMbi =
                    updatedLanguageData[language]?.mbi;

                if (activeMbi) {

                    setMbiMetrics(activeMbi);
                    setMbiError("");
                    setMbiUnavailable("");

                }
                else {

                    setMbiMetrics({
                        precision: 0,
                        recall: 0,
                        f1: 0
                    });

                    setMbiUnavailable(
                        `${language} does not have MBI metrics.`
                    );

                }

            }
            else {

                setMbiMetrics({
                    precision: 0,
                    recall: 0,
                    f1: 0
                });

                setMbiError("");
                setMbiUnavailable("");

            }

            setTokenizerStatus("Tokenizer ready.");

        }
        catch (err) {

            setError(err.message);
            setTokenizerStatus("Tokenizer not available.");
        }
        finally {
            setSelectionLoading(false);
        }
    }

    /* Returns the corpus back to the default state */

    async function handleDefault() {

        if (selectionLoading) {

            return;

        }

        setSelectionLoading(true);

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

            const result = await getDefaultCorpus(

                language,

                tokenizer

            );

            setLanguageData((previousData) => ({

                ...previousData,

                [language]: {

                    tokenizedText:
                        formatTokenizedText(

                            result.tokenized_text

                        ),

                    metrics: {

                        tokens:
                            result.metrics.token_count ?? 0,

                        fertility:
                            result.metrics.fertility ?? 0,

                        compression:
                            result.metrics.compression ?? 0,

                        token_premium:
                            result.metrics.token_premium ?? null

                    },

                    mbi: previousData[language]?.mbi ?? null

                }

            }));

        }

        catch (err) {

            setError(err.message);

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

        let sentences;

        if (Array.isArray(tokens[0])) {

            sentences = tokens;

        }

        else {

            sentences = [tokens];

        }

        const visibleSentences = sentences.slice(0, 10);

        return (

            <>

                {visibleSentences.map((sentence, sentenceIndex) => (

                    <div

                        key={`sentence-${sentenceIndex}`}

                        className="token-sentence"

                    >

                        {sentence.map((token, tokenIndex) => {

                            const colourIndex = tokenIndex % 8;

                            return (

                                <span

                                    key={`${sentenceIndex}-${tokenIndex}-${token}`}

                                    className={`token-pill token-colour-${colourIndex}`}

                                >

                                    {token}

                                </span>

                            );

                        })}

                    </div>

                ))}

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

                    {/* Tokenizer */}

                    <div className="filter-group tokenizer-filter">

                        <label htmlFor="tokenizer">

                            Tokenizer

                        </label>

                        <div className="tokenizer-search">

                            <input

                                type="text"

                                id="tokenizer"

                                value={tokenizerInput}

                                onChange={(event) => {

                                    setTokenizerInput(event.target.value)

                                }}

                                onKeyDown={(event) => {

                                    if (event.key === "Enter") {

                                        handleTokenizerInput(event);

                                    }

                                }}

                                placeholder="Type tokenizer name..."

                                disabled={selectionLoading}

                            />

                            <button

                                type="button"

                                className="search-button"

                                onClick={() =>

                                    handleTokenizerInput({ key: "Enter" })

                                }

                                disabled={selectionLoading}

                            >

                                Search

                            </button>

                        </div>

                        {/* Tokenizer status */}

                        { tokenizerStatus && (

                            <div

                                className={`selection-status ${

                                    tokenizerStatus === "Tokenizer not available."

                                        ? "is-error"

                                        : tokenizerStatus === "Loading tokenizer..."

                                            ? "is-loading"

                                            : "is-ready"

                                }`}

                            >

                                <span className="status-dot"></span>

                                <span>{tokenizerStatus}</span>

                            </div>

                        )}

                    </div>

                    {/* Language */}

                    <div className="filter-group language-filter">

                        <label htmlFor="language">

                            Language

                        </label>

                        <div className="language-selector">

                            <button

                                type="button"

                                id="language"

                                className="language-button"

                                onClick={() =>

                                    setLanguageMenuOpen(!languageMenuOpen)

                                }

                                disabled={selectionLoading}

                            >

                                <span>

                                    {selectedLanguages.length === 1

                                        ? selectedLanguages[0]

                                        : `${selectedLanguages.length} languages selected`

                                    }

                                </span>

                                <span className="language-arrow">

                                    ▾

                                </span>

                            </button>

                            {languageMenuOpen && (

                                <div className="language-menu">

                                    <div className="language-menu-title">

                                        CHOOSE A LANGUAGE

                                    </div>

                                    <div className="language-menu-subtitle">

                                        Choose up to 4 languages

                                    </div>

                                    <div className="language-options">

                                        {languages.map((item) => (

                                            <button

                                                type="button"

                                                key={item}

                                                className={`language-option ${

                                                    selectedLanguages.includes(item)

                                                        ? "selected"

                                                        : ""

                                                }`}

                                                onClick={() => {

                                                    toggleLanguage(item);

                                                }}

                                                disabled={selectionLoading}

                                            >

                                                {item}

                                            </button>

                                        ))}

                                    </div>

                                    <button

                                        type="button"

                                        className="language-done-button"

                                        onClick={() =>

                                            setLanguageMenuOpen(false)

                                        }

                                    >

                                        Done

                                    </button>

                                </div>

                            )}

                        </div>

                        {/* Language status */}

                        {languageStatus && (

                            <div

                                className={`selection-status ${

                                    languageStatus === "Could not load language corpus."

                                        ? "is-error"

                                        : languageStatus.startsWith("Loading ")

                                            ? "is-loading"

                                            : "is-ready"

                                }`}

                            >

                                <span className="status-dot"></span>

                                <span>

                                    {languageStatus}

                                </span>

                            </div>

                        )}

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

                <div
                    className={
                        selectedLanguages.length > 1
                            ? "language-tokenization-grid"
                            : "language-tokenization-single"
                    }
                >
                    {selectedLanguages.map((selectedLanguage) => {

                        const data = languageData[selectedLanguage];
                        if (!data) {
                            return null;
                        }

                        return (
                            <div
                                key={selectedLanguage}
                                className="language-tokenization-block"
                            >

                                {/* Tokenization Result */}

                                <div className="tokenization-result">

                                    <div className="tokenization-language">

                                        {selectedLanguage}

                                    </div>

                                    <div className="tokenization-text">

                                        {renderTokens(

                                            data.tokenizedText

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

                                                {data.metrics.tokens}

                                            </span>

                                        </div>

                                        <div className="metric-card">

                                            <span className="metric-name">

                                                Fertility

                                            </span>

                                            <span className="metric-value">

                                                {Number(

                                                    data.metrics.fertility

                                                ).toFixed(2)}

                                            </span>

                                        </div>

                                        <div className="metric-card">

                                            <span className="metric-name">

                                                Compression

                                            </span>

                                            <span className="metric-value">

                                                {Number(

                                                    data.metrics.compression

                                                ).toFixed(2)}

                                            </span>

                                        </div>

                                        <div className="metric-card">

                                            <span className="metric-name">

                                                Token Premium

                                            </span>

                                            <span className="metric-value">

                                                {data.metrics.token_premium === null

                                                    ? "N/A"

                                                    : Number(

                                                        data.metrics.token_premium

                                                    ).toFixed(2)

                                                }

                                            </span>

                                        </div>

                                    </div>

                                    {/* Row 2 - Placeholder metrics */}
                                    {hasMbiMetrics(selectedLanguage) && (
                                        <div className="metric-row metric-row-centered">
                                            <div className="metric-card">
                                                <span className="metric-name">
                                                    Precision
                                                </span>

                                                <span className="metric-value">
                                                    {data.mbi === null
                                                        ? "N/A"
                                                        : Number(
                                                            data.mbi.precision
                                                        ).toFixed(2)}
                                                </span>
                                            </div>

                                            <div className="metric-card">
                                                <span className="metric-name">
                                                    F1
                                                </span>

                                                <span className="metric-value">
                                                    {data.mbi === null
                                                        ? "N/A"
                                                        : Number(
                                                            data.mbi.f1
                                                        ).toFixed(2)}
                                                </span>
                                            </div>

                                            <div className="metric-card">
                                                <span className="metric-name">
                                                    Recall
                                                </span>

                                                <span className="metric-value">
                                                    {data.mbi === null
                                                        ? "N/A"
                                                        : Number(
                                                            data.mbi.recall
                                                        ).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {mbiUnavailable && (

                    <div className="selection-status is-error">

                        <span className="status-dot"></span>

                        <span>{mbiUnavailable}</span>

                    </div>

                )}

                {mbiError && (

                    <div className="inspect-error">

                        {mbiError}

                    </div>

                )}

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

                    </div>

                </div>

            </section>

        </>

    );

}

export default Inspect;