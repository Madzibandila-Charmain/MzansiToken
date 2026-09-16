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

import MetricsChart from "../components/MetricsChart";

import { languageColour } from "../components/languageColours";

import CorpusUpload from "../components/CorpusUpload";

import TypeAnything from "../components/TypeAnything";

const GPT2_SPACE = "\u0120";
const SENTENCEPIECE_SPACE = "\u2581";
const WORDPIECE_PREFIX = "##";

/* Two side by side is what fits without scrolling. */
const MAX_INSPECT_LANGUAGES = 2;

function readable(token) {

    if (
        token.startsWith(GPT2_SPACE) ||
        token.startsWith(SENTENCEPIECE_SPACE)
    ) {
        return { text: token.slice(1), newWord: true };
    }

    if (token.startsWith(WORDPIECE_PREFIX)) {
        return { text: token.slice(2), newWord: false };
    }

    return { text: token, newWord: false };
}

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

                    setSource("default");

                    setFileName("default");

                    setSelectedFile(null);

                    setSelectedLanguages([
                        defaultLanguage
                    ]);

                    setTokenizerInput(
                        defaultTokenizer
                    );

                    const defaultResult =
                        await getDefaultCorpus(
                            defaultLanguage,
                            defaultTokenizer
                        );

                    const formattedDefaultTokens =
                        formatTokenizedText(
                            defaultResult.tokenized_text
                        );

                    const defaultMetrics = {
                        tokens:
                            defaultResult.metrics.token_count ?? 0,

                        fertility:
                            defaultResult.metrics.fertility ?? 0,

                        compression:
                            defaultResult.metrics.compression ?? 0,

                        token_premium:
                            defaultResult.metrics.token_premium ?? null
                    };

                    setCorpusTokenizedText(
                        formattedDefaultTokens
                    );

                    setCorpusMetrics(
                        defaultMetrics
                    );

                    setLanguageData({
                        [defaultLanguage]: {
                            tokenizedText:
                                formattedDefaultTokens,

                            metrics:
                                defaultMetrics,

                            mbi: null
                        }
                    });

                    if (
                        hasMbiMetrics(
                            defaultLanguage
                        )
                    ) {

                        try {

                            const defaultMbiResult =
                                await getMBI(
                                    defaultTokenizer,
                                    defaultLanguage
                                );

                            setLanguageData(
                                (previousData) => ({
                                    ...previousData,

                                    [defaultLanguage]: {
                                        ...previousData[
                                            defaultLanguage
                                        ],

                                        mbi: {
                                            precision:
                                                defaultMbiResult
                                                    .metrics
                                                    .precision ?? 0,

                                            recall:
                                                defaultMbiResult
                                                    .metrics
                                                    .recall ?? 0,

                                            f1:
                                                defaultMbiResult
                                                    .metrics
                                                    .f1 ?? 0
                                        }
                                    }
                                })
                            );

                        }
                        catch (err) {

                            setLanguageData(
                                (previousData) => ({
                                    ...previousData,

                                    [defaultLanguage]: {
                                        ...previousData[
                                            defaultLanguage
                                        ],

                                        mbi: null
                                    }
                                })
                            );
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
                        source === "default" &&
                        selectedLanguages.length === 0 &&
                        language
                    ) {

                        setSelectedLanguages([
                            language
                        ]);

                    }

                    setTokenizerInput(
                        tokenizer
                    );
                }
            }
            catch (err) {

                setError(
                    err.message
                );

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
        setSource,
        setFileName,
        setSelectedFile,
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

        if (
            !hasMbiMetrics(
                selectedLanguage
            )
        ) {

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

        }
        catch (err) {

            if (
                err.message?.includes(
                    "Unsupported language"
                )
            ) {

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

            setMbiError(
                err.message
            );

            throw err;

        }
        finally {

            setMbiLoading(false);

        }

    }

    //The second useEffect
    useEffect(() => {

        if (
            !inputText.trim() ||
            !tokenizer
        ) {

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
                        .map((sentence) =>
                            sentence.trim()
                        )
                        .filter(
                            (sentence) =>
                                sentence.length > 0
                        );

                    const tokenizedSentences = [];

                    for (
                        const sentence
                        of sentences
                    ) {

                        const sentenceResult =
                            await tokenizeText(
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

                    setTypedTokenizedText(
                        tokenizedSentences
                    );

                    const result =
                        await tokenizeText(
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

                    setError(
                        err.message
                    );

                }
                finally {

                    setLoading(false);

                }

            },
            400
        );

        return () =>
            clearTimeout(timeoutId);

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

            const result =
                await getDefaultCorpus(
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

            setError(
                err.message
            );

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

        /*
            Language selection is only available when

            the default corpus is active.
        */

        if (source !== "default") {
            return;
        }

        setSelectionLoading(true);

        setLanguageStatus(
            `Loading ${newLanguage}`
        );

        setError("");

        try {

            const result =
                await getDefaultCorpus(
                    newLanguage,
                    tokenizer
                );

            let mbiResult = null;

            if (
                hasMbiMetrics(
                    newLanguage
                )
            ) {

                try {

                    mbiResult =
                        await getMBI(
                            tokenizer,
                            newLanguage
                        );

                }
                catch (err) {

                    mbiResult = null;

                }

            }

            const formattedTokens =
                formatTokenizedText(
                    result.tokenized_text
                );

            const newMetrics = {
                tokens:
                    result.metrics.token_count ?? 0,

                fertility:
                    result.metrics.fertility ?? 0,

                compression:
                    result.metrics.compression ?? 0,

                token_premium:
                    result.metrics.token_premium ?? null
            };

            const newMbi =
                mbiResult
                    ? {
                        precision:
                            mbiResult.metrics.precision ?? 0,

                        recall:
                            mbiResult.metrics.recall ?? 0,

                        f1:
                            mbiResult.metrics.f1 ?? 0
                    }
                    : null;

            setLanguageData(
                (previousData) => ({
                    ...previousData,

                    [newLanguage]: {
                        tokenizedText:
                            formattedTokens,

                        metrics:
                            newMetrics,

                        mbi:
                            newMbi
                    }
                })
            );

            setLanguage(newLanguage);

            /*
                Update the main corpus display.
            */

            setCorpusTokenizedText(
                formattedTokens
            );

            setCorpusMetrics(
                newMetrics
            );

            /*
                Update MBI display.
            */

            if (mbiResult) {

                setMbiMetrics({
                    precision:
                        mbiResult.metrics.precision ?? 0,

                    recall:
                        mbiResult.metrics.recall ?? 0,

                    f1:
                        mbiResult.metrics.f1 ?? 0
                });

                setMbiError("");

                setMbiUnavailable("");

            }
            else {

                setMbiMetrics({
                    precision: 0,
                    recall: 0,
                    f1: 0
                });

                if (
                    hasMbiMetrics(
                        newLanguage
                    )
                ) {

                    setMbiUnavailable(
                        `${newLanguage} does not have MBI metrics.`
                    );

                }
                else {

                    setMbiUnavailable("");

                }

            }

            setLanguageStatus(
                "Language ready."
            );

        }
        catch (err) {

            setError(
                err.message
            );

            setLanguageStatus(
                "Could not load language corpus."
            );

        }
        finally {

            setSelectionLoading(false);

        }

    }

    async function toggleLanguage(selectedLanguage) {

        if (selectionLoading) {
            return;
        }

        /*
            Languages can only be selected when the

            default corpus is active.
        */

        if (source !== "default") {
            return;
        }

        if (
            selectedLanguages.includes(
                selectedLanguage
            )
        ) {

            // Deselect language

            const remainingLanguages =
                selectedLanguages.filter(
                    (item) =>
                        item !== selectedLanguage
                );

            setSelectedLanguages(
                remainingLanguages
            );

            // Remove its stored results

            setLanguageData(
                (previousData) => {

                    const updatedData = {
                        ...previousData
                    };

                    delete updatedData[
                        selectedLanguage
                    ];

                    return updatedData;

                }
            );

            // If the removed language was active,

            // make another selected language active.

            if (
                language === selectedLanguage
            ) {

                if (
                    remainingLanguages.length > 0
                ) {

                    const nextLanguage =
                        remainingLanguages[0];

                    setLanguage(
                        nextLanguage
                    );

                    const remainingData =
                        languageData[
                            nextLanguage
                        ];

                    if (remainingData) {

                        setCorpusTokenizedText(
                            remainingData.tokenizedText
                        );

                        setCorpusMetrics(
                            remainingData.metrics
                        );

                        if (
                            remainingData.mbi
                        ) {

                            setMbiMetrics(
                                remainingData.mbi
                            );

                        }
                        else {

                            setMbiMetrics({
                                precision: 0,
                                recall: 0,
                                f1: 0
                            });

                        }

                    }

                }

            }

            return;

        }

        let updatedLanguages =
            [
                ...selectedLanguages
            ];

        /* Inspect reads two languages side by side. Compare is the page
           for four - here a third selection pushes the oldest one out. */

        if (
            updatedLanguages.length >= MAX_INSPECT_LANGUAGES
        ) {

            const removedLanguage =
                updatedLanguages.shift();

            setLanguageData(
                (previousData) => {

                    const updatedData = {
                        ...previousData
                    };

                    delete updatedData[
                        removedLanguage
                    ];

                    return updatedData;

                }
            );

        }

        updatedLanguages.push(
            selectedLanguage
        );

        setSelectedLanguages(
            updatedLanguages
        );

        await handleLanguageChange(
            selectedLanguage
        );

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
                    sentence
                        .split(/\s+/)
                        .filter(Boolean)
                )
                .filter(
                    (sentence) =>
                        sentence.length > 0
                );

        }

        return [];

    }

    /* Handled file slection from user computer. */
    async function handleFileChange(event) {

        const file =
            event.target.files[0];

        if (!file) {
            return;
        }

        /*
            Make sure the selected file is a text file.
        */

        if (
            !file.name
                .toLowerCase()
                .endsWith(".txt")
        ) {

            setError(
                "Please select a .txt file."
            );

            return;

        }

        try {

            setSelectionLoading(true);

            setLoading(true);

            setError("");

            /*
                The uploaded file is processed using the
                CURRENT language and CURRENT tokenizer.
            */

            const result =
                await uploadCorpus(
                    file,
                    tokenizer
                );

            /*
                Format the tokenized text returned by FastAPI.
            */

            const formattedTokens =
                formatTokenizedText(
                    result.tokenized_text
                );

            /*
                Save the uploaded file information.
            */

            setSource("upload");

            setSelectedFile(file);

            setFileName(file.name);

            /*
                Uploaded corpora are not associated with any selected language.
                Clear the selected languages and their
                stored language-specific results.
            */

            setSelectedLanguages([]);

            setLanguageData({});

            /*
                Display the uploaded file's tokenized text.
            */

            setCorpusTokenizedText(
                formattedTokens
            );

            /*
                Display the uploaded file's metrics.
            */

            setCorpusMetrics({
                tokens:
                    result.metrics?.token_count ?? 0,

                fertility:
                    result.metrics?.fertility ?? 0,

                compression:
                    result.metrics?.compression ?? 0,

                token_premium:
                    result.metrics?.token_premium ?? null
            });

            /*
                Uploaded corpora do not have language-specific
                MBI metrics.
            */

            setMbiMetrics({
                precision: 0,
                recall: 0,
                f1: 0
            });

            setMbiError("");

            setMbiUnavailable("");

            /*
                The tokenizer remains the active tokenizer.
            */

            setTokenizer(
                tokenizer
            );

            setLanguageMenuOpen(
                false
            );

        }
        catch (err) {

            console.error(
                "Upload corpus error:",
                err
            );

            setError(
                err.message ||
                "Could not process the uploaded corpus."
            );

        }
        finally {

            setLoading(false);

            setSelectionLoading(false);

        }

    }

    async function handleTokenizerInput(event) {

        if (event.key !== "Enter") {
            return;
        }

        const newTokenizer =
            (event.value ?? tokenizerInput).trim();

        if (!newTokenizer) {
            return;
        }

        if (selectionLoading) {
            return;
        }

        setSelectionLoading(true);

        setTokenizerStatus(
            "Loading tokenizer..."
        );

        setError("");

        try {

            /*
                First check that the tokenizer entered by the user
                is available in the backend.
            */

            await getTokenizerInfo(
                newTokenizer
            );

            /*
                UPLOAD MODE
            */

            if (
                source === "upload" &&
                selectedFile
            ) {

                const result =
                    await uploadCorpus(
                        selectedFile,
                        newTokenizer
                    );

                /*
                    Format the tokenized text returned by FastAPI.
                */

                const formattedTokens =
                    formatTokenizedText(
                        result.tokenized_text
                    );

                /*
                    Update the uploaded corpus tokenization.
                */

                setCorpusTokenizedText(
                    formattedTokens
                );

                /*
                    Update the uploaded corpus metrics.
                */

                setCorpusMetrics({
                    tokens:
                        result.metrics?.token_count ?? 0,

                    fertility:
                        result.metrics?.fertility ?? 0,

                    compression:
                        result.metrics?.compression ?? 0,

                    token_premium:
                        result.metrics?.token_premium ?? null
                });

                /*
                    Uploaded corpora are not connected to a
                    language, so there are no language-specific
                    MBI metrics to load.
                */

                setMbiMetrics({
                    precision: 0,
                    recall: 0,
                    f1: 0
                });

                setMbiError("");

                setMbiUnavailable("");

            }

            /*
                DEFAULT MODE
            */

            else {

                const languagesToProcess =
                    selectedLanguages.length > 0
                        ? selectedLanguages
                        : [language];

                const updatedLanguageData = {};

                /*
                    Process each selected language separately.
                */

                for (
                    const selectedLanguage
                    of languagesToProcess
                ) {

                    const result =
                        await getDefaultCorpus(
                            selectedLanguage,
                            newTokenizer
                        );

                    /*
                        MBI is only available for languages
                        that support it.
                    */

                    let mbiResult = null;

                    if (
                        hasMbiMetrics(
                            selectedLanguage
                        )
                    ) {

                        try {

                            mbiResult =
                                await getMBI(
                                    newTokenizer,
                                    selectedLanguage
                                );

                        }
                        catch (err) {

                            /*
                                MBI failure should not prevent
                                the tokenizer from being applied.
                            */

                            mbiResult = null;

                        }
                    }

                    /*
                        Store the tokenized result and metrics
                        for this language.
                    */

                    updatedLanguageData[
                        selectedLanguage
                    ] = {

                        tokenizedText:
                            formatTokenizedText(
                                result.tokenized_text
                            ),

                        metrics: {

                            tokens:
                                result.metrics
                                    ?.token_count ?? 0,

                            fertility:
                                result.metrics
                                    ?.fertility ?? 0,

                            compression:
                                result.metrics
                                    ?.compression ?? 0,

                            token_premium:
                                result.metrics
                                    ?.token_premium ?? null

                        },

                        mbi:
                            mbiResult
                                ? {

                                    precision:
                                        mbiResult.metrics
                                            ?.precision ?? 0,

                                    recall:
                                        mbiResult.metrics
                                            ?.recall ?? 0,

                                    f1:
                                        mbiResult.metrics
                                            ?.f1 ?? 0

                                }
                                : null

                    };

                }

                /*
                    Update all selected language results.
                */

                setLanguageData(
                    updatedLanguageData
                );

                /*
                    Update the main corpus display with the
                    currently active language.
                */

                if (
                    updatedLanguageData[
                        language
                    ]
                ) {

                    setCorpusTokenizedText(
                        updatedLanguageData[
                            language
                        ].tokenizedText
                    );

                    setCorpusMetrics(
                        updatedLanguageData[
                            language
                        ].metrics
                    );

                    /*
                        Update the MBI display for the
                        currently active language.
                    */

                    const activeMbi =
                        updatedLanguageData[
                            language
                        ].mbi;

                    if (
                        hasMbiMetrics(
                            language
                        )
                    ) {

                        if (activeMbi) {

                            setMbiMetrics(
                                activeMbi
                            );

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

                }

            }

            /*
                The tokenizer has successfully been loaded.
                Make it the active tokenizer for the Inspect page.
            */

            setTokenizer(
                newTokenizer
            );

            /*
                Keep the search box showing the active tokenizer.
            */

            setTokenizerInput(
                newTokenizer
            );

            setTokenizerStatus(
                "Tokenizer ready."
            );

        }
        catch (err) {

            console.error(
                "Tokenizer loading error:",
                err
            );

            setError(
                err.message ||
                "Could not load tokenizer."
            );

            setTokenizerStatus(
                "Tokenizer not available."
            );

        }
        finally {

            setSelectionLoading(
                false
            );

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

            /*
                Load the default corpus for the current language
                using the current tokenizer.
            */

            const result =
                await getDefaultCorpus(
                    language,
                    tokenizer
                );

            const formattedTokens =
                formatTokenizedText(
                    result.tokenized_text
                );

            const defaultMetrics = {
                tokens:
                    result.metrics.token_count ?? 0,

                fertility:
                    result.metrics.fertility ?? 0,

                compression:
                    result.metrics.compression ?? 0,

                token_premium:
                    result.metrics.token_premium ?? null
            };

            /* Restore MBI for the default language. */ 
            let defaultMbi = null; 
            
            if ( hasMbiMetrics( language ) ) { 
                try { 
                    const defaultMbiResult = 
                    await getMBI( tokenizer, language ); 
                    
                    defaultMbi = { 
                        precision: defaultMbiResult.metrics.precision ?? 0, 
                        
                        recall: defaultMbiResult.metrics.recall ?? 0, 
                        
                        f1: defaultMbiResult.metrics.f1 ?? 0 
                    }; 
                } 
                catch (err) { 
                    defaultMbi = null; 
                } 
            }

            setFileName(
                "default"
            );

            setSelectedFile(
                null
            );

            setSource(
                "default"
            );

            /*
                Restore the current language as the
                only selected language.
            */

            setSelectedLanguages([
                language
            ]);

            /*
                Store the default language result.
            */

            setLanguageData({
                [language]: {
                    tokenizedText:
                        formattedTokens,

                    metrics:
                        defaultMetrics,

                    mbi: defaultMbi
                }
            });

            /*
                Update the main corpus display.
            */

            setCorpusTokenizedText(
                formattedTokens
            );

            setCorpusMetrics(
                defaultMetrics
            );


            /* Update the MBI display. */ 
            if (defaultMbi) { 
                setMbiMetrics( defaultMbi ); 
                
                setMbiError(""); 
                
                setMbiUnavailable(""); 
            } 
            else { 
                setMbiMetrics({ 
                    precision: 0, 
                    recall: 0, 
                    f1: 0 
                }); 
                
                if ( hasMbiMetrics( language ) ) { 
                    setMbiUnavailable( 
                        `${language} does not have MBI metrics.` 
                    ); 
                } 
                else { 
                    setMbiUnavailable(""); 
                } 
            }

            /*
                Clear the uploaded file input so the
                same file can be selected again later.
            */

            if (fileInputRef.current) {

                fileInputRef.current.value =
                    "";

            }

            setLanguageMenuOpen(
                false
            );

        }
        catch (err) {

            setError(
                err.message
            );

        }
        finally {

            setSelectionLoading(
                false
            );

        }

    }

    // Cycles through the 8 CSS colors for the tokens
    function renderTokens(tokens) {

        if (
            !tokens ||
            tokens.length === 0
        ) {

            return "Your tokenized text will appear here.";

        }

        let sentences;

        if (
            Array.isArray(tokens[0])
        ) {

            sentences =
                tokens;

        }
        else {

            sentences = [
                tokens
            ];

        }

        const visibleSentences = sentences.slice(0, 10);
        return (
            <>
                {visibleSentences.map(
                    (
                        sentence,
                        sentenceIndex
                    ) => (

                        <div
                            key={`sentence-${sentenceIndex}`}
                            className="token-sentence"
                        >

                            {sentence.map(
                                (
                                    token,
                                    tokenIndex
                                ) => {

                                    const colourIndex =
                                        tokenIndex % 8;

                                    const { text, newWord } =
                                        readable(
                                            Array.isArray(token)
                                                ? token.join("")
                                                : String(token)
                                        );

                                    return (
                                        <span
                                            key={`${sentenceIndex}-${tokenIndex}-${token}`}
                                            className={`token-pill token-colour-${colourIndex}` + (newWord ? " token-new-word" : "")}
                                            title={token}
                                        >
                                            {text}
                                        </span>
                                    );

                                }
                            )}

                        </div>

                    )
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
                    Read one or two languages token by token, then see all of them
                    at once underneath &mdash; no scrolling back and forth.
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
                                    setTokenizerInput(
                                        event.target.value
                                    );
                                }}
                                onKeyDown={(event) => {

                                    if (
                                        event.key === "Enter"
                                    ) {

                                        handleTokenizerInput(
                                            event
                                        );

                                    }

                                }}
                                placeholder="Type tokenizer name..."
                                disabled={
                                    selectionLoading
                                }
                            />

                            <button
                                type="button"
                                className="search-button"
                                onClick={() =>
                                    handleTokenizerInput({
                                        key: "Enter"
                                    })
                                }
                                disabled={
                                    selectionLoading
                                }
                            >
                                <svg
                                    className="search-button-icon"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-hidden="true"
                                >
                                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.5" />
                                    <path
                                        d="M16.5 16.5L21 21"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <span> Search</span>
                            </button>

                        </div>

                        {/* Shortcut pills for the supported tokenizers.
                            The list comes from GET /options, which this page
                            already loads into `tokenizers`. Typing your own
                            still works - these are a shortcut, not a limit. */}

                        {tokenizers.length > 0 && (

                            <div className="tokenizer-pills">

                                {tokenizers.map(
                                    (name) => (

                                        <button
                                            key={name}
                                            type="button"
                                            className={`tokenizer-pill ${
                                                tokenizer === name
                                                    ? "is-selected"
                                                    : ""
                                            }`}
                                            onClick={() => {

                                                setTokenizerInput(
                                                    name
                                                );

                                                handleTokenizerInput({
                                                    key: "Enter",
                                                    value: name
                                                });

                                            }}
                                            disabled={
                                                selectionLoading
                                            }
                                        >
                                            {name}
                                        </button>

                                    )
                                )}

                            </div>

                        )}

                        {/* Tokenizer status */}

                        {tokenizerStatus && (

                            <div
                                className={`selection-status ${
                                    tokenizerStatus ===
                                    "Tokenizer not available."
                                        ? "is-error"
                                        : tokenizerStatus ===
                                            "Loading tokenizer..."
                                                ? "is-loading"
                                                : "is-ready"
                                }`}
                            >

                                <span className="status-dot"></span>

                                <span>
                                    {tokenizerStatus}
                                </span>

                            </div>

                        )}

                    </div>

                    {/* Language */}

                    <div className="filter-group language-filter">

                        <label>
                            Read closely &mdash; pick up to two
                        </label>

                        <div className="language-selector">

                            <button
                                type="button"
                                className="language-button"
                                onClick={() =>
                                    setLanguageMenuOpen(
                                        !languageMenuOpen
                                    )
                                }
                                disabled={
                                    selectionLoading ||
                                    source === "upload"
                                }
                            >

                                <span>

                                    {selectedLanguages.length === 0
                                        ? "Select languages"
                                        : selectedLanguages.join(", ")
                                    }

                                </span>

                                <span className="language-arrow">
                                    {languageMenuOpen ? "▲" : "▼"}
                                </span>

                            </button>

                            {languageMenuOpen && (
                                <div className="language-menu">

                                    <div className="language-menu-title">
                                        LANGUAGES
                                    </div>

                                    <div className="language-menu-subtitle">
                                        Select up to two languages
                                    </div>

                                    <div className="language-options">

                                        {languages.map(
                                            (item) => (

                                                <button
                                                    type="button"
                                                    key={item}
                                                    className={`language-option ${
                                                        selectedLanguages.includes(
                                                            item
                                                        )
                                                            ? "selected"
                                                            : ""
                                                    }`}
                                                    onClick={() => {
                                                        toggleLanguage(
                                                            item
                                                        );
                                                    }}
                                                    disabled={
                                                        selectionLoading ||
                                                        source === "upload"
                                                    }
                                                >

                                                    <span
                                                        className="pill-dot"
                                                        style={{
                                                            background:
                                                                languageColour(
                                                                    item
                                                                )
                                                        }}
                                                    ></span>

                                                    {item}

                                                </button>

                                            )
                                        )}

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

                        {source === "upload" && (
                            <div className="selection-status">

                                <span className="status-dot"></span>

                                <span>
                                    Language is off while an uploaded corpus is active.
                                </span>

                            </div>
                        )}

                        {/* Language status */}

                        {languageStatus && (
                            <div
                                className={`selection-status ${
                                    languageStatus ===
                                    "Could not load language corpus."
                                        ? "is-error"
                                        : languageStatus.startsWith(
                                            "Loading "
                                        )
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

                    {source === "upload"
                        ? `${fileName} • Uploaded Corpus • ${tokenizer}`
                        : `${fileName} • ${language} • ${tokenizer}`}

                </p>

                <CorpusUpload
                    inputId="corpus-upload"
                    fileInputRef={fileInputRef}
                    onFileChange={handleFileChange}
                    onDefault={handleDefault}
                    showDefault={fileName !== "default"}
                    disabled={selectionLoading}
                />

                <div
                    className={
                        source === "upload"
                            ? "language-tokenization-single"
                            : selectedLanguages.length > 1
                                ? "language-tokenization-grid"
                                : "language-tokenization-single"
                    }
                >

                    {source === "upload" ? (

                        <div
                            className="language-tokenization-block"
                        >

                            {/* Tokenization Result */}

                            <div className="tokenization-result">

                                <div className="tokenization-language">

                                    <span
                                        className="swatch"
                                        style={{ background: "#8b93a0" }}
                                    ></span>

                                    Uploaded Corpus

                                    <span className="count">
                                        {Number(
                                            corpusMetrics.tokens
                                        ).toLocaleString()} tokens
                                    </span>

                                </div>

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

                                            {corpusMetrics.token_premium ===
                                            null
                                                ? "N/A"
                                                : Number(
                                                    corpusMetrics.token_premium
                                                ).toFixed(2)
                                            }

                                        </span>

                                    </div>

                                </div>

                            </div>

                        </div>

                    ) : (

                        selectedLanguages.map(
                            (selectedLanguage) => {

                                const data =
                                    languageData[
                                        selectedLanguage
                                    ];

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

                                                <span
                                                    className="swatch"
                                                    style={{
                                                        background:
                                                            languageColour(
                                                                selectedLanguage
                                                            )
                                                    }}
                                                ></span>

                                                {selectedLanguage}

                                                <span className="count">
                                                    {Number(
                                                        data.metrics.tokens
                                                    ).toLocaleString()} tokens
                                                </span>

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

                                                        {data.metrics.token_premium ===
                                                        null
                                                            ? "N/A"
                                                            : Number(
                                                                data.metrics.token_premium
                                                            ).toFixed(2)
                                                        }

                                                    </span>

                                                </div>

                                            </div>

                                            {/* Row 2 - Placeholder metrics */}

                                            {hasMbiMetrics(
                                                selectedLanguage
                                            ) && (

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
                                                                ).toFixed(2)
                                                            }

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
                                                                ).toFixed(2)
                                                            }

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
                                                                ).toFixed(2)
                                                            }

                                                        </span>

                                                    </div>

                                                </div>

                                            )}

                                        </div>

                                    </div>

                                );

                            }
                        )

                    )}

                </div>

                {mbiUnavailable && (

                    <div className="selection-status is-error">

                        <span className="status-dot"></span>

                        <span>
                            {mbiUnavailable}
                        </span>

                    </div>

                )}

                {mbiError && (

                    <div className="inspect-error">
                        {mbiError}
                    </div>

                )}

            </section>
            <MetricsChart tokenizer={tokenizer} />

            {/* Text input box */}
            <TypeAnything
                inputText={inputText}
                onInputChange={setInputText}
                results={[
                    {
                        tokens: typedTokenizedText,
                        metrics: textMetrics
                    }
                ]}
                renderTokens={renderTokens}
            />

        </>
        

    );

}

export default Inspect;