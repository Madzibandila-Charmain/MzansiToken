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
    tokenizeText,
    compareMBI,
    getTokenizerInfo,
    friendlyError,
} from "../api/client";

import { useAppState } from "../context/AppStateContext";

import CorpusUpload from "../components/CorpusUpload";

import TokenizationMetrics from "../components/TokenizationMetrics";

import TypeAnything from "../components/TypeAnything";
import CompareCharts from "../components/CompareCharts";

import TokenStream from "../components/TokenStream";

import StatusMessage from "../components/StatusMessage";

import { languageColour } from "../components/languageColours";

import { formatTokenizedText } from "../lib/tokenText";



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
        compareInitialised,
        setCompareInitialised
    } = useAppState();

    /*
        Type Anything text is kept locally to Compare.
        This prevents the Compare text box from sharing
        its value with the Inspect text box.
    */
    const [inputText, setInputText] = useState("");


    /*
        Languages and tokenizers provided by the backend.
    */
    const [languages, setLanguages] = useState([]);
    const [tokenizers, setTokenizers] = useState([]);

    const [tokenizerOneInput, setTokenizerOneInput] = useState("");
    const [tokenizerTwoInput, setTokenizerTwoInput] = useState("");

    /*
        Tokenized corpus for each tokenizer.
    */
    const [tokenizerOneTokens, setTokenizerOneTokens] = useState([]);
    const [tokenizerTwoTokens, setTokenizerTwoTokens] = useState([]);

    /*
        Tokenized text entered by the user for each tokenizer.
    */
    const [typedTokenizerOneTokens, setTypedTokenizerOneTokens] =
        useState([]);

    const [typedTokenizerTwoTokens, setTypedTokenizerTwoTokens] =
        useState([]);

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

    const [mbiLoading, setMbiLoading] = useState(false);
    const [mbiError, setMbiError] = useState("");
    const [mbiUnavailable, setMbiUnavailable] = useState("");

    const [mbiComparison, setMbiComparison] = useState({
        tokenizerA: {
            precision: 0,
            recall: 0,
            f1: 0,
            words_evaluated: 0
        },
        tokenizerB: {
            precision: 0,
            recall: 0,
            f1: 0,
            words_evaluated: 0
        }
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

    /*
        General selection status is used for language
        changes and returning to the default corpus.
    */
    const [selectionLoading, setSelectionLoading] = useState(false);
    const [selectionStatus, setSelectionStatus] = useState("");
    const [selectionType, setSelectionType] = useState("");

    /*
        Each tokenizer has its own loading and status state.
        This keeps Tokenizer 1 and Tokenizer 2 independent.
    */
    const [tokenizerOneLoading, setTokenizerOneLoading] = useState(false);
    /*
        The selection status had no failure state at all, so "Language
        failed" rendered in the green ready style. A failure that looks
        like a success is worse than no message.
    */
    const [selectionFailed, setSelectionFailed] = useState(false);

    const [tokenizerOneStatus, setTokenizerOneStatus] = useState("");
    const [tokenizerOneFailed, setTokenizerOneFailed] = useState(false);

    const [tokenizerTwoLoading, setTokenizerTwoLoading] = useState(false);
    const [tokenizerTwoStatus, setTokenizerTwoStatus] = useState("");
    const [tokenizerTwoFailed, setTokenizerTwoFailed] = useState(false);

    const [error, setError] = useState("");

    /*
        File input reference.
    */
    const fileInputRef = useRef(null);

    /*
        The label read "default", which is the internal name for the
        built-in corpus and means nothing to a reader. Name what is
        actually on screen instead - same wording as Inspect.
    */
    const corpusLabel = compareSource === "upload"
        ? `${compareFileName} \u2022 Uploaded corpus \u2022 `
            + `${compareTokenizerOne || "tokenizer 1"} vs `
            + `${compareTokenizerTwo || "tokenizer 2"}`
        : `Built-in corpus \u2022 ${compareLanguage || "no language selected"}`
            + ` \u2022 ${compareTokenizerOne || "tokenizer 1"} vs `
            + `${compareTokenizerTwo || "tokenizer 2"}`;

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

                    const secondTokenizer =
                        result.tokenizers?.find(
                            (item) =>
                                item !== defaultTokenizer
                            ) || defaultTokenizer;

                    const initialTokenizerOne =
                        compareTokenizerOne ||
                        defaultTokenizer;

                    const initialTokenizerTwo =
                        compareTokenizerTwo ||
                        secondTokenizer;

                    if (!compareTokenizerOne) {
                        setCompareTokenizerOne(
                            initialTokenizerOne
                        );
                    }

                    if (!compareTokenizerTwo) {
                        setCompareTokenizerTwo(
                            initialTokenizerTwo
                        );
                    }

                    setTokenizerOneInput(
                        initialTokenizerOne
                    );

                    setTokenizerTwoInput(
                        initialTokenizerTwo
                    );

                    setCompareInitialised(true);
                }

            } catch (err) {

                setError(
                    friendlyError(err) ||
                    "Could not load the backend options."
                );

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

    useEffect(() => {

        if (
            !compareInitialised ||
            !compareLanguage ||
            !compareTokenizerOne ||
            !compareTokenizerTwo
        ) {
            return;
        }

        let cancelled = false;

        async function loadMbiComparison() {

            try {

                setMbiLoading(true);
                setMbiError("");
                setMbiUnavailable("");

                const result = await compareMBI(
                    compareTokenizerOne,
                    compareTokenizerTwo,
                    compareLanguage
                );

                if (cancelled) {
                    return;
                }

                setMbiComparison({
                    tokenizerA: {
                        precision:
                            result.tokenizer_a.metrics.precision ?? 0,
                        recall:
                            result.tokenizer_a.metrics.recall ?? 0,
                        f1:
                            result.tokenizer_a.metrics.f1 ?? 0,
                        words_evaluated:
                            result.tokenizer_a.words_evaluated ?? 0
                    },

                    tokenizerB: {
                        precision:
                            result.tokenizer_b.metrics.precision ?? 0,
                        recall:
                            result.tokenizer_b.metrics.recall ?? 0,
                        f1:
                            result.tokenizer_b.metrics.f1 ?? 0,
                        words_evaluated:
                            result.tokenizer_b.words_evaluated ?? 0
                    }
                });

            } catch (err) {

                if (
                    err.message?.includes(
                        "Unsupported language"
                    )
                ) {

                    if (!cancelled) {

                        setMbiComparison({
                            tokenizerA: {
                                precision: 0,
                                recall: 0,
                                f1: 0,
                                words_evaluated: 0
                            },

                            tokenizerB: {
                                precision: 0,
                                recall: 0,
                                f1: 0,
                                words_evaluated: 0
                            }
                        });

                        setMbiUnavailable(
                            `${compareLanguage} does not have MBI metrics.`
                        );
                    }

                    return;
                }

                if (!cancelled) {
                    setMbiError(err.message);
                }

            } finally {

                if (!cancelled) {
                    setMbiLoading(false);
                }

            }
        }

        loadMbiComparison();

        return () => {
            cancelled = true;
        };

    }, [
        compareInitialised,
        compareLanguage,
        compareTokenizerOne,
        compareTokenizerTwo
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

        /*
            loadDefaultCorpus re-throws now, and an effect cannot catch for
            us. The message is already in `error` by the time it rejects,
            so this only stops it surfacing as an unhandled rejection.
        */
        loadDefaultCorpus(
            compareLanguage,
            compareTokenizerOne,
            compareTokenizerTwo
        ).catch(() => {});

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

                setError(
                    friendlyError(err) ||
                    "Could not tokenize the text."
                );

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
        Converts backend tokenized text into an array.
    */

    /*
        Render tokens using the same token-pill style as Inspect.
    */

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

    function getMetricValue(metric, metrics) {

        if (metric === "Tokens") {

            return Number(
                metrics?.tokens ?? 0
            ).toLocaleString();

        }

        if (metric === "Fertility") {

            return Number(
                metrics?.fertility ?? 0
            ).toFixed(2);

        }

        if (metric === "Compression") {

            return Number(
                metrics?.compression ?? 0
            ).toFixed(2);

        }

        return "0.00";
    }

    function formatMbiMetric(value) {

        return Number(
            value ?? 0
        ).toFixed(2);
    }

    function getMbiMetricDisplay(value) {

        if (mbiUnavailable) {
            return "N/A";
        }

        if (mbiLoading) {
            return "Loading...";
        }

        return formatMbiMetric(value);
    }

    /*
        English corpus won't display Precision/F1/Recall.
    */
    function hasMbiMetrics() {

        return compareLanguage !== "English";
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

            setError(
                friendlyError(err) ||
                "Could not load the corpus."
            );

            /*
                Re-thrown on purpose. This was swallowed here, so the
                caller's catch never ran and handleLanguageChange went on
                to report "ready" for a load that had failed - a green
                status line over no data. Inspect's version has always
                re-thrown; this one did not.
            */
            throw err;

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
                    selectedTokenizerOne
                ),

                uploadCorpus(
                    file,
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

            console.error(
                "Upload corpus error:",
                err
            );

            const detail =
                friendlyError(err) ||
                "Could not process the uploaded corpus.";

            setSelectionFailed(true);

            setSelectionStatus(detail);

            /* Same reason as loadDefaultCorpus: the caller has to know. */
            throw err;

        } finally {

            setLoading(false);
            setSelectionLoading(false);

        }
    }

    /*
        Handle corpus file selection.
    */
    async function handleFileChange(event) {

        const file =
            event.target.files[0];

        if (!file) {
            return;
        }

        /* Same reason: the handler owns the message, not the browser. */
        try {

            await processUploadedCorpus(
                file,
                compareLanguage,
                compareTokenizerOne,
                compareTokenizerTwo
            );

        }
        catch {
            /* Already reported by processUploadedCorpus. */
        }
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
        setSelectionFailed(false);

        setSelectionType("language");
        setSelectionStatus(`Loading ${newLanguage}...`);

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

            setSelectionFailed(false);

            setSelectionStatus(
                `${newLanguage} ready.`
            );

        } catch (err) {

            console.error(
                "Language loading error:",
                err
            );

            /* What the backend said, not "Language failed". */
            const detail =
                friendlyError(err) ||
                "Could not load the language corpus.";

            setSelectionFailed(true);

            setSelectionStatus(detail);

        } finally {

            setSelectionLoading(false);

        }
    }

    /*
        Search and change Tokenizer 1.
    */

    async function handleTokenizerOneSearch(event) {

        if (
            event &&
            event.key &&
            event.key !== "Enter"
        ) {
            return;
        }

        const newTokenizer =
            (
                event?.value ??
                tokenizerOneInput
            ).trim();

        if (!newTokenizer) {
            return;
        }

        if (
            tokenizerOneLoading ||
            selectionLoading ||
            loading
        ) {
            return;
        }

        setTokenizerOneLoading(true);

        setTokenizerOneFailed(false);

        setTokenizerOneStatus(
            `Loading ${newTokenizer}...`
        );

        setError("");

        try {

            /*
                Check that the tokenizer entered by the user
                is available in the backend.
            */

            await getTokenizerInfo(
                newTokenizer
            );

            /*
                Upload mode.
            */

            if (
                compareSource === "upload" &&
                compareSelectedFile
            ) {

                const result =
                    await uploadCorpus(
                        compareSelectedFile,
                        newTokenizer
                    );

                setTokenizerOneTokens(
                    formatTokenizedText(
                        result?.tokenized_text
                    )
                );

                setTokenizerOneMetrics(
                    formatMetrics(result)
                );

            }

            /*
                Default corpus mode.
            */

            else {

                const result =
                    await getDefaultCorpus(
                        compareLanguage,
                        newTokenizer
                    );

                setTokenizerOneTokens(
                    formatTokenizedText(
                        result?.tokenized_text
                    )
                );

                setTokenizerOneMetrics(
                    formatMetrics(result)
                );

            }

            setCompareTokenizerOne(
                newTokenizer
            );

            setTokenizerOneInput(
                newTokenizer
            );

            setTokenizerOneFailed(false);

            setTokenizerOneStatus(
                `${newTokenizer} ready.`
            );

        }
        catch (err) {

            console.error(
                "Tokenizer 1 loading error:",
                err
            );

            /*
                The backend says exactly what is wrong. The old flat
                sentence threw that away, so every failure looked the same.
            */
            const detail =
                friendlyError(err) ||
                "Could not load tokenizer 1.";

            /* Status line only. It used to also go to `error`, which
               renders a second copy below the card - same sentence twice,
               and the second one loses the link. Inspect never had that
               block. */
            setTokenizerOneFailed(true);

            setTokenizerOneStatus(detail);

        }
        finally {
            setTokenizerOneLoading(false);
        }

    }

    /*
        Search and change Tokenizer 2.
    */

    async function handleTokenizerTwoSearch(event) {

        if (
            event &&
            event.key &&
            event.key !== "Enter"
        ) {
            return;
        }

        const newTokenizer =
            (
                event?.value ??
                tokenizerTwoInput
            ).trim();

        if (!newTokenizer) {
            return;
        }

        if (
            tokenizerTwoLoading ||
            selectionLoading ||
            loading
        ) {
            return;
        }

        setTokenizerTwoLoading(true);

        setTokenizerTwoFailed(false);

        setTokenizerTwoStatus(
            `Loading ${newTokenizer}...`
        );

        setError("");

        try {

            /*
                Check that the tokenizer entered by the user
                is available in the backend.
            */

            await getTokenizerInfo(
                newTokenizer
            );

            /*
                Upload mode.
            */

            if (
                compareSource === "upload" &&
                compareSelectedFile
            ) {

                const result =
                    await uploadCorpus(
                        compareSelectedFile,
                        newTokenizer
                    );

                setTokenizerTwoTokens(
                    formatTokenizedText(
                        result?.tokenized_text
                    )
                );

                setTokenizerTwoMetrics(
                    formatMetrics(result)
                );

            }

            /*
                Default corpus mode.
            */
            else {

                const result =
                    await getDefaultCorpus(
                        compareLanguage,
                        newTokenizer
                    );

                setTokenizerTwoTokens(
                    formatTokenizedText(
                        result?.tokenized_text
                    )
                );

                setTokenizerTwoMetrics(
                    formatMetrics(result)
                );

            }

            setCompareTokenizerTwo(
                newTokenizer
            );

            setTokenizerTwoInput(
                newTokenizer
            );

            setTokenizerTwoFailed(false);

            setTokenizerTwoStatus(
                `${newTokenizer} ready.`
            );

        }
        catch (err) {

            console.error(
                "Tokenizer 2 loading error:",
                err
            );

            const detail =
                friendlyError(err) ||
                "Could not load tokenizer 2.";

            /* Status line only. It used to also go to `error`, which
               renders a second copy below the card - same sentence twice,
               and the second one loses the link. Inspect never had that
               block. */
            setTokenizerTwoFailed(true);

            setTokenizerTwoStatus(detail);

        }
        finally {
            setTokenizerTwoLoading(false);
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
        setSelectionStatus(
            "Loading the built-in corpus..."
        );

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

            setSelectionFailed(false);

            setSelectionStatus(
                "Built-in corpus ready."
            );

        } catch (err) {

            console.error(
                "Default corpus error:",
                err
            );

            const detail =
                friendlyError(err) ||
                "Could not load the built-in corpus.";

            setSelectionFailed(true);

            setSelectionStatus(detail);

        } finally {

            setSelectionLoading(false);

        }
    }

    return (

        <div className="compare-page">

            {/* Compare Header */}

            <section className="compare-intro">

                {/* Description of what the Compare page does */}

                <p className="compare-label">
                    COMPARE
                </p>

                <h1>
                    Put Two Tokenizers Through the Same Test.
                </h1>

                <p className="compare-description">
                    See exactly where they differ, side by side, across the same
                    language and corpus.
                </p>

            </section>

            {/* Corpus language, as pills.

                It used to live only inside the Customize panel, so the one
                thing that decides what both tokenizers are reading was
                hidden behind a button. Same coloured pills as Inspect, and
                the colour is the one that language carries in every chart. */}

            <section className="compare-setup">

                <div className="compare-tokenizer-filter-heading">
                    Corpus language
                </div>

                <div className="language-pills">

                    {languages.map((item) => (

                        <button
                            key={item}
                            type="button"
                            className={`language-pill ${
                                compareLanguage === item
                                    ? "is-selected"
                                    : ""
                            }`}
                            onClick={() =>
                                handleLanguageChange(item)
                            }
                            disabled={
                                selectionLoading ||
                                loading ||
                                tokenizerOneLoading ||
                                tokenizerTwoLoading ||
                                compareSource === "upload"
                            }
                        >

                            <span
                                className="pill-dot"
                                style={{
                                    background: languageColour(item)
                                }}
                            ></span>

                            {item}

                        </button>

                    ))}

                </div>

                {compareSource === "upload" && (
                    <div className="selection-status">
                        <span className="status-dot"></span>
                        <span>
                            Language is off while an uploaded corpus is active.
                        </span>
                    </div>
                )}

                {/* Tokenizer Selection - same card, because picking a
                    language and picking two tokenizers is one decision:
                    what is being compared, and on what. */}

                <div className="compare-tokenizer-filter-heading">
                    Compare Tokenizers
                </div>

                <div className="compare-tokenizer-filter-options">

                    {/* Tokenizer 1 */}

                    <div className="compare-tokenizer-filter-item">

                        <label
                            htmlFor="compare-tokenizer-one"
                            className="compare-tokenizer-filter-label"
                        >
                            Tokenizer 1
                        </label>

                        <div className="tokenizer-search">

                            <input
                                type="text"
                                id="compare-tokenizer-one"
                                value={tokenizerOneInput}
                                onChange={(event) => {
                                    setTokenizerOneInput(
                                        event.target.value
                                    );
                                }}
                                onKeyDown={(event) => {

                                    if (
                                        event.key === "Enter"
                                    ) {

                                        handleTokenizerOneSearch(
                                            event
                                        );

                                    }

                                }}
                                placeholder="Type tokenizer name..."
                                disabled={
                                    tokenizerOneLoading ||
                                    selectionLoading ||
                                    loading
                                }
                            />

                            <button
                                type="button"
                                className="search-button"
                                onClick={() =>
                                    handleTokenizerOneSearch({
                                        key: "Enter"
                                    })
                                }
                                disabled={
                                    tokenizerOneLoading ||
                                    selectionLoading ||
                                    loading
                                }
                            >

                                <svg
                                    className="search-button-icon"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-hidden="true"
                                >
                                    <circle
                                        cx="11"
                                        cy="11"
                                        r="7"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                    />

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

                        {/* Tokenizer 1 status */}

                        {tokenizerOneStatus && (

                            <div
                                className={`selection-status ${
                                    tokenizerOneFailed
                                        ? "is-error"
                                        : tokenizerOneLoading
                                            ? "is-loading"
                                            : "is-ready"
                                }`}
                            >

                                <span className="status-dot"></span>

                                <StatusMessage
                                    text={tokenizerOneStatus}
                                    failed={tokenizerOneFailed}
                                    modelName={tokenizerOneInput}
                                />

                            </div>

                        )}

                    </div>

                    {/* Tokenizer 2 */}

                    <div className="compare-tokenizer-filter-item">

                        <label
                            htmlFor="compare-tokenizer-two"
                            className="compare-tokenizer-filter-label"
                        >
                            Tokenizer 2
                        </label>

                        <div className="tokenizer-search">

                            <input
                                type="text"
                                id="compare-tokenizer-two"
                                value={tokenizerTwoInput}
                                onChange={(event) => {
                                    setTokenizerTwoInput(
                                        event.target.value
                                    );
                                }}
                                onKeyDown={(event) => {

                                    if (
                                        event.key === "Enter"
                                    ) {

                                        handleTokenizerTwoSearch(
                                            event
                                        );

                                    }

                                }}
                                placeholder="Type tokenizer name..."
                                disabled={
                                    tokenizerTwoLoading ||
                                    selectionLoading ||
                                    loading
                                }
                            />

                            <button
                                type="button"
                                className="search-button"
                                onClick={() =>
                                    handleTokenizerTwoSearch({
                                        key: "Enter"
                                    })
                                }
                                disabled={
                                    tokenizerTwoLoading ||
                                    selectionLoading ||
                                    loading
                                }
                            >

                                <svg
                                    className="search-button-icon"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    aria-hidden="true"
                                >
                                    <circle
                                        cx="11"
                                        cy="11"
                                        r="7"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                    />

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

                        {tokenizerTwoStatus && (

                            <div
                                className={`selection-status ${
                                    tokenizerTwoFailed
                                        ? "is-error"
                                        : tokenizerTwoLoading
                                            ? "is-loading"
                                            : "is-ready"
                                }`}
                            >

                                <span className="status-dot"></span>

                                <StatusMessage
                                    text={tokenizerTwoStatus}
                                    failed={tokenizerTwoFailed}
                                    modelName={tokenizerTwoInput}
                                />

                            </div>

                        )}

                    </div>

                </div>

            </section>

            {/* Only failures that have no status line of their own get
                here - the options load and the typed-text tokenize. Field
                failures live under the field they belong to. */}

            {error && (

                <div className="compare-error">
                    <span className="status-dot"></span>
                    <StatusMessage text={error} failed={true} />
                </div>

            )}

            {/* Corpus tokenization */}

            <section className="compare-corpus-box">

                <div className="compare-corpus-heading">
                    Corpus Tokenization
                </div>

                <p className="compare-corpus-label">
                    {corpusLabel}
                </p>

                <CorpusUpload
                    inputId="compare-corpus-upload"
                    fileInputRef={fileInputRef}
                    onFileChange={handleFileChange}
                    onDefault={handleDefault}
                    showDefault={
                        compareFileName !== "default"
                    }
                    disabled={
                        selectionLoading ||
                        loading ||
                        tokenizerOneLoading ||
                        tokenizerTwoLoading
                    }
                />

                {/* Status */}

                {selectionStatus && (

                    <div
                        className={`compare-selection-status ${
                            selectionFailed
                                ? "is-error"
                                : selectionLoading
                                    ? "is-loading"
                                    : "is-ready"
                        }`}
                    >

                        <span className="compare-status-dot"></span>

                        <StatusMessage
                            text={selectionStatus}
                            failed={selectionFailed}
                        />

                    </div>

                )}

                {/* Two Tokenizer Displays */}

                <div className="compare-tokenization-results">

                    {/* TOKENIZER 1 */}

                    <TokenizationMetrics
                        title={
                            compareTokenizerOne ||
                            "Tokenizer 1"
                        }
                        tokens={tokenizerOneTokens}
                        metrics={tokenizerOneMetrics}
                        mbi={
                            mbiComparison.tokenizerA
                        }
                        showMbi={hasMbiMetrics()}
                        tokenizerType="1"
                        busy={
                            tokenizerOneLoading ||
                            selectionLoading
                        }
                        busyLabel={
                            tokenizerOneLoading
                                ? `Loading ${tokenizerOneInput
                                    || "tokenizer 1"}\u2026`
                                : `Loading ${compareLanguage}\u2026`
                        }
                    />

                    {/* TOKENIZER 2 */}

                    <TokenizationMetrics
                        title={
                            compareTokenizerTwo ||
                            "Tokenizer 2"
                        }
                        tokens={tokenizerTwoTokens}
                        metrics={tokenizerTwoMetrics}
                        mbi={
                            mbiComparison.tokenizerB
                        }
                        showMbi={hasMbiMetrics()}
                        tokenizerType="2"
                        busy={
                            tokenizerTwoLoading ||
                            selectionLoading
                        }
                        busyLabel={
                            tokenizerTwoLoading
                                ? `Loading ${tokenizerTwoInput
                                    || "tokenizer 2"}\u2026`
                                : `Loading ${compareLanguage}\u2026`
                        }
                    />

                </div>

            </section>

            {/* Side-by-side charts for the two selected tokenizers. */}
            <CompareCharts
                tokenizerA={compareTokenizerOne}
                tokenizerB={compareTokenizerTwo}
            />

            {/* Type Anything */}
            <TypeAnything
                inputText={inputText}
                onInputChange={setInputText}
                results={[
                    {
                        id: "tokenizer-a",
                        title: compareTokenizerOne,
                        tokens: typedTokenizerOneTokens,
                        metrics: typedTokenizerOneMetrics
                    },
                    {
                        id: "tokenizer-b",
                        title: compareTokenizerTwo,
                        tokens: typedTokenizerTwoTokens,
                        metrics: typedTokenizerTwoMetrics
                    }
                ]}
            />

        </div>
    );
}

export default Compare;