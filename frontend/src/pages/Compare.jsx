/*
    Compare Page

    Author: Madzibandila Charmain

    Date: 21 August 2026
*/

import { useCallback, useEffect, useRef, useState } from "react";

import "./Compare.css";

import {
    getOptions,
    getDefaultCorpus,
    uploadCorpus,
    tokenizeText,
    compareMBI,
    getTokenizerInfo,
    friendlyError,
    isConnectivityError,
} from "../api/client";

import { useAppState } from "../context/useAppState";

import CorpusUpload from "../components/CorpusUpload";
import { checkCorpusFile, shortFileName } from "../lib/corpusFormats";

import TokenizationMetrics from "../components/TokenizationMetrics";

import { SearchIcon } from "../components/Icons";
import TypeAnything from "../components/TypeAnything";
import CompareCharts from "../components/CompareCharts";

import StatusLine from "../components/StatusLine";
import { statusState } from "../lib/statusState";

import { languageColour } from "../components/languageColours";

import { formatTokenizedText } from "../lib/tokenText";

const DEFAULT_COMPARE_TOKENIZER_ONE = "gpt2";
const DEFAULT_COMPARE_TOKENIZER_TWO = "google/gemma-4-12B-it";

/* What TypeAnything is shown when there is nothing typed yet, or the
   page is missing a language/tokenizer to type against. Shared so
   both sides of the pair use the exact same zeroed shape. */
const EMPTY_TYPED_METRICS = {
    tokens: 0,
    fertility: 0,
    compression: 0,
    token_premium: 0
};



/*
    One tokenizer's half of a /compare_mbi response. A missing value stays
    null here; the card is what decides how to print it.
*/
function readMbi(side) {

    const metrics = side?.metrics || {};

    return {
        precision: metrics.precision ?? null,
        recall: metrics.recall ?? null,
        f1: metrics.f1 ?? null,
        aligned_boundaries: metrics.aligned_boundaries ?? null,
        total_gold_boundaries: metrics.total_gold_boundaries ?? null,
        words_evaluated: side?.words_evaluated ?? null
    };
}



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
        setCompareInitialised,

        compareLanguages: languages,
        setCompareLanguages: setLanguages,
        compareLimits: limits,
        setCompareLimits: setLimits,
        compareOptionsLoaded,
        setCompareOptionsLoaded,

        compareTokenizerOneTokens: tokenizerOneTokens,
        setCompareTokenizerOneTokens: setTokenizerOneTokens,
        compareTokenizerTwoTokens: tokenizerTwoTokens,
        setCompareTokenizerTwoTokens: setTokenizerTwoTokens,
        compareTokenizerOneMetrics: tokenizerOneMetrics,
        setCompareTokenizerOneMetrics: setTokenizerOneMetrics,
        compareTokenizerTwoMetrics: tokenizerTwoMetrics,
        setCompareTokenizerTwoMetrics: setTokenizerTwoMetrics,

    compareCorpusLoaded,
    setCompareCorpusLoaded
    } = useAppState();

    /*
        Type Anything text is kept locally to Compare.
        This prevents the Compare text box from sharing
        its value with the Inspect text box.
    */
    const [inputText, setInputText] = useState("");


    /*
        Languages, limits and the corpus tokens now come from context
        (see the destructuring above), so they survive leaving Compare.
        The search boxes start from the stored tokenizers so they are
        not blank when you come back.
    */
    const [tokenizerOneInput, setTokenizerOneInput] =
        useState(compareTokenizerOne);
    const [tokenizerTwoInput, setTokenizerTwoInput] =
        useState(compareTokenizerTwo);

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
            token_premium: 0,
            total_gold_boundaries: 0,
            words_evaluated: 0
        });

    const [typedTokenizerTwoMetrics, setTypedTokenizerTwoMetrics] =
        useState({
            tokens: 0,
            fertility: 0,
            compression: 0,
            token_premium: 0,
            total_gold_boundaries: 0,
            words_evaluated: 0
        });

    /*
        Which input the typed tokens/metrics above were produced for.
        They are only shown while this still matches what is in the box,
        so a previous sentence's tokens never sit under a new sentence.
    */
    const [typedResultKey, setTypedResultKey] = useState("");

    const [mbiError, setMbiError] = useState("");
    const [mbiUnavailable, setMbiUnavailable] = useState("");

    const [mbiComparison, setMbiComparison] = useState({
        tokenizerA: readMbi(null),
        tokenizerB: readMbi(null)
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
    const [corpusLoadingLabel, setCorpusLoadingLabel] = useState("");

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
        ? `${shortFileName(compareFileName)} \u2022 Uploaded corpus \u2022 `
            + `${compareTokenizerOne || "tokenizer 1"} vs `
            + `${compareTokenizerTwo || "tokenizer 2"}`
        : `Built-in corpus \u2022 ${compareLanguage || "no language selected"}`
            + ` \u2022 ${compareTokenizerOne || "tokenizer 1"} vs `
            + `${compareTokenizerTwo || "tokenizer 2"}`;

    /*
        Moved above every effect that calls it. It used to sit after
        them, as a `const` initialised by useCallback - unlike a
        function declaration, a const is not hoisted, so the effect
        below that references it ran into the temporal dead zone and
        crashed the page on every load with "Cannot access
        'loadDefaultCorpus' before initialization". Declaring it
        before any effect that uses it is the fix - no behaviour
        change otherwise.
    */
    /*
        Loads the default corpus through both tokenizers.

        useCallback so the effect below can list it as a real
        dependency. Its default parameters are the only reactive
        values it reads - everything else is a stable setState setter -
        so those three are its actual dependencies.
    */
    const loadDefaultCorpus = useCallback(async function loadDefaultCorpus(
        selectedLanguage = compareLanguage,
        selectedTokenizerOne = compareTokenizerOne,
        selectedTokenizerTwo = compareTokenizerTwo
    ) {

        try {

            setLoading(true);
            setError("");

            const [
                settledOne,
                settledTwo
            ] = await Promise.allSettled([

                getDefaultCorpus(
                    selectedLanguage,
                    selectedTokenizerOne
                ),

                getDefaultCorpus(
                    selectedLanguage,
                    selectedTokenizerTwo
                )

            ]);

            /*
                Promise.all rejected the instant either side failed,
                discarding whichever side HAD actually come back - one
                gated or slow tokenizer blanked a perfectly good result
                on the other side too. allSettled keeps both outcomes, so
                a working side still reaches the screen and only the
                failing side's own reason gets thrown below, instead of
                a generic message covering a result that was fine.
            */
            if (settledOne.status === "fulfilled") {

                setTokenizerOneTokens(
                    formatTokenizedText(
                        settledOne.value.tokenized_text
                    )
                );

                setTokenizerOneMetrics(
                    formatMetrics(settledOne.value)
                );
            }

            if (settledTwo.status === "fulfilled") {

                setTokenizerTwoTokens(
                    formatTokenizedText(
                        settledTwo.value.tokenized_text
                    )
                );

                setTokenizerTwoMetrics(
                    formatMetrics(settledTwo.value)
                );
            }

            setCompareSource("default");
            setCompareSelectedFile(null);
            setCompareFileName("default");

            if (settledOne.status === "rejected") {
                throw settledOne.reason;
            }

            if (settledTwo.status === "rejected") {
                throw settledTwo.reason;
            }

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
    }, [
        compareLanguage,
        compareTokenizerOne,
        compareTokenizerTwo,
        setCompareFileName,
        setCompareSelectedFile,
        setCompareSource
    ]);

    /*
        Load backend options when Compare opens.
    */
    useEffect(() => {

        if (compareOptionsLoaded) {
            return;
        }

        async function initialiseCompare() {

            try {

                setLoading(true);
                setError("");

                const result = await getOptions();

                setLanguages(result.languages || []);
                setLimits(result.limits || null);

                const initialTokenizerOne =
                    compareTokenizerOne || DEFAULT_COMPARE_TOKENIZER_ONE;

                const initialTokenizerTwo =
                    compareTokenizerTwo || DEFAULT_COMPARE_TOKENIZER_TWO;

                /*
                    Initialise Compare selections only once.
                    The selections are stored in AppStateContext,
                    so navigating away from Compare does not reset them.
                */
                 if (!compareLanguage) {
                    setCompareLanguage(
                        result.defaults?.language || "isiZulu"
                    );
                }

                setCompareTokenizerOne(initialTokenizerOne);
                setCompareTokenizerTwo(initialTokenizerTwo);

                setTokenizerOneInput(initialTokenizerOne);
                setTokenizerTwoInput(initialTokenizerTwo);

                setCompareInitialised(true);
                setCompareOptionsLoaded(true);

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
        compareOptionsLoaded,
        compareLanguage,
        compareTokenizerOne,
        compareTokenizerTwo,
        setCompareLanguage,
        setCompareTokenizerOne,
        setCompareTokenizerTwo,
        setCompareInitialised,
        setCompareOptionsLoaded,
        setLanguages,
        setLimits
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
                    tokenizerA: readMbi(result?.tokenizer_a),
                    tokenizerB: readMbi(result?.tokenizer_b)
                });

            } catch (err) {

                if (
                    err.message?.includes(
                        "Unsupported language"
                    )
                ) {

                    if (!cancelled) {

                        setMbiComparison({
                            tokenizerA: readMbi(null),
                            tokenizerB: readMbi(null)
                        });

                        setMbiUnavailable(
                            `${compareLanguage} does not have MBI metrics.`
                        );
                    }

                    return;
                }

                if (!cancelled) {
                    setMbiComparison({
                        tokenizerA: readMbi(null),
                        tokenizerB: readMbi(null)
                    });
                    setMbiError(
                        friendlyError(err) ||
                        "Morphology metrics could not be loaded."
                    );
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
            !compareLanguage ||
            compareSource !== "default" ||
            compareCorpusLoaded
        ) {
            return;
        }

        setCompareCorpusLoaded(true);

        /*
            loadDefaultCorpus re-throws now, and an effect cannot catch for
            us. The message is already in `error` by the time it rejects,
            so this only stops it surfacing as an unhandled rejection.
        */
        setSelectionType("default");
        setCorpusLoadingLabel("built-in corpus");
        setSelectionLoading(true);

        loadDefaultCorpus(
            compareLanguage,
            compareTokenizerOne,
            compareTokenizerTwo
        )
            .catch(() => {})
            .finally(() => {
                setSelectionLoading(false);
            });

    }, [
        compareLanguage,
        compareTokenizerOne,
        compareTokenizerTwo,
        compareSource,
        compareCorpusLoaded,
        setCompareCorpusLoaded,
        loadDefaultCorpus
    ]);

    /*
        Tokenizes text entered by the user using both
        comparison tokenizers.
        A short delay prevents a backend request from being
        sent for every individual keystroke.
    */
    const typedReady = Boolean(
        inputText.trim() &&
        compareTokenizerOne &&
        compareTokenizerTwo &&
        compareLanguage
    );

    /*
        Identifies exactly what the typed results should be for. Results
        are only displayed once typedResultKey has caught up with it.
    */
    const typedKey = JSON.stringify([
        inputText,
        compareLanguage,
        compareTokenizerOne,
        compareTokenizerTwo
    ]);

    const typedShown = typedReady && typedResultKey === typedKey;

    useEffect(() => {

        /* Nothing reset here on purpose - typedReady (below, used by
           the TypeAnything call) already hides the stale tokens/
           metrics from this effect's last run, so clearing them via
           setState had nothing behind it. It was flagged by
           react-hooks/set-state-in-effect for exactly that reason. */
        if (!typedReady) {
            return;
        }

        /* Set by the cleanup below. Any response that arrives after the
           input has changed again is ignored instead of overwriting the
           newer one. */
        let cancelled = false;

        const timeoutId = setTimeout(async () => {

            try {

                setError("");

                const [
                    settledOne,
                    settledTwo
                ] = await Promise.allSettled([

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

                if (cancelled) {
                    return;
                }

                /*
                    Token Premium for typed text is always zero.

                    Same reasoning as the corpus loads above: one side
                    failing should not blank the side that tokenized
                    fine.
                */
                if (settledOne.status === "fulfilled") {

                    setTypedTokenizerOneTokens(
                        formatTokenizedText(
                            settledOne.value.tokenized_text
                        )
                    );

                    setTypedTokenizerOneMetrics({
                        ...formatMetrics(settledOne.value),
                        token_premium: 0
                    });
                }
                else {

                    setTypedTokenizerOneTokens([]);
                    setTypedTokenizerOneMetrics(EMPTY_TYPED_METRICS);
                }

                if (settledTwo.status === "fulfilled") {

                    setTypedTokenizerTwoTokens(
                        formatTokenizedText(
                            settledTwo.value.tokenized_text
                        )
                    );

                    setTypedTokenizerTwoMetrics({
                        ...formatMetrics(settledTwo.value),
                        token_premium: 0
                    });
                }
                else {

                    setTypedTokenizerTwoTokens([]);
                    setTypedTokenizerTwoMetrics(EMPTY_TYPED_METRICS);
                }

                setTypedResultKey(typedKey);

                const failure = [settledOne, settledTwo].find(
                    (settled) => settled.status === "rejected"
                );

                if (failure) {
                    throw failure.reason;
                }

            } catch (err) {

                setError(
                    friendlyError(err) ||
                    "Could not tokenize the text."
                );

            }

        }, 400);

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };

    }, [
        inputText,
        compareLanguage,
        compareTokenizerOne,
        compareTokenizerTwo,
        typedReady,
        typedKey
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

            /*
                Not `?? 0`. An uploaded file has no premium at all, and the
                card needs the null to know to drop itself.
            */
            token_premium:
                result?.metrics?.token_premium ?? null,

            token_premium_basis:
                result?.metrics?.token_premium_basis ?? null
        };
    }

    /*
        English corpus won't display Precision/F1/Recall.
    */
    function hasMbiMetrics() {

        /*
            This used to check the language dropdown alone, which meant an
            uploaded corpus still showed NCHLT morphology numbers for
            whatever language happened to be selected - gold segmentations
            for one text sitting beside tokens counted from another. The
            dropdown says nothing about a file the user supplied, so an
            upload has no MBI at all.
        */
        if (compareSource === "upload") {
            return false;
        }

        return compareLanguage !== "English";
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
                settledOne,
                settledTwo
            ] = await Promise.allSettled([

                uploadCorpus(
                    file,
                    selectedTokenizerOne
                ),

                uploadCorpus(
                    file,
                    selectedTokenizerTwo
                )

            ]);

            /* Same reasoning as loadDefaultCorpus: a side that uploaded
               fine should not be thrown away just because the other
               side failed to load. */
            setCompareSource("upload");
            setCompareSelectedFile(file);
            setCompareFileName(file.name);

            if (settledOne.status === "fulfilled") {

                setTokenizerOneTokens(
                    formatTokenizedText(
                        settledOne.value.tokenized_text
                    )
                );

                setTokenizerOneMetrics(
                    formatMetrics(settledOne.value)
                );
            }

            if (settledTwo.status === "fulfilled") {

                setTokenizerTwoTokens(
                    formatTokenizedText(
                        settledTwo.value.tokenized_text
                    )
                );

                setTokenizerTwoMetrics(
                    formatMetrics(settledTwo.value)
                );
            }

            if (settledOne.status === "rejected") {
                throw settledOne.reason;
            }

            if (settledTwo.status === "rejected") {
                throw settledTwo.reason;
            }

        } catch (err) {

            console.error(
                "Upload corpus error:",
                err
            );

            if (isConnectivityError(err)) {

                setError(friendlyError(err));
                setSelectionStatus("");
                setSelectionFailed(false);

            }
            else {

                const detail =
                    friendlyError(err) ||
                    "Could not process the uploaded corpus.";

                setSelectionFailed(true);

                setSelectionStatus(detail);

            }

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

        /* Wrong type or too big? Say so now rather than after the upload. */
        const problem = checkCorpusFile(file, limits);

        if (problem) {

            setSelectionFailed(true);
            setSelectionStatus(problem);

            return;

        }

        /* Same reason: the handler owns the message, not the browser. */
        try {

            setSelectionLoading(true);
            setSelectionType("upload");
            setSelectionFailed(false);
            setCorpusLoadingLabel(file.name);
            setSelectionStatus(`Loading ${shortFileName(file.name)}...`);

            await processUploadedCorpus(
                file,
                compareLanguage,
                compareTokenizerOne,
                compareTokenizerTwo
            );

            setSelectionStatus(`${shortFileName(file.name)} ready.`);

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

            if (isConnectivityError(err)) {

                /* Can't reach it at all is page-level news - it belongs
                   in the one shared error slot, not repeated here too
                   (processUploadedCorpus may have already set it; this
                   covers the loadDefaultCorpus path the same way). */
                setError(friendlyError(err));
                setSelectionStatus("");
                setSelectionFailed(false);

            }
            else {

                /* What the backend said, not "Language failed". */
                const detail =
                    friendlyError(err) ||
                    "Could not load the language corpus.";

                setSelectionFailed(true);

                setSelectionStatus(detail);

            }

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
        setCorpusLoadingLabel("built-in corpus");
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

            if (isConnectivityError(err)) {

                setError(friendlyError(err));
                setSelectionStatus("");
                setSelectionFailed(false);

            }
            else {

                const detail =
                    friendlyError(err) ||
                    "Could not load the built-in corpus.";

                setSelectionFailed(true);

                setSelectionStatus(detail);

            }

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

                                <SearchIcon />

                                <span> Search</span>

                            </button>

                        </div>

                        {/* Tokenizer 1 status */}

                        {tokenizerOneStatus && (

                            <StatusLine
                                    state={statusState({
                                        failed: tokenizerOneFailed,
                                        loading: tokenizerOneLoading
                                    })}
                                    text={tokenizerOneStatus}
                                    modelName={tokenizerOneInput}
                                />

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

                                <SearchIcon />

                                <span> Search</span>

                            </button>

                        </div>

                        {tokenizerTwoStatus && (

                            <StatusLine
                                    state={statusState({
                                        failed: tokenizerTwoFailed,
                                        loading: tokenizerTwoLoading
                                    })}
                                    text={tokenizerTwoStatus}
                                    modelName={tokenizerTwoInput}
                                />

                        )}

                    </div>

                </div>

                {/* Only failures that have no status line of their own
                    get here - the options load and the typed-text
                    tokenize. Field failures live under the field they
                    belong to. Under the tokenizer search fields, the
                    same spot their own status lines sit. */}

                {(error || mbiUnavailable || mbiError) && (

                    <StatusLine
                        state="error"
                        text={
                            error ||
                            mbiUnavailable ||
                            `Morphology metrics could not be loaded: ${mbiError}`
                        }
                    />

                )}

            </section>

            {/* Corpus tokenization */}

            <section className="compare-corpus-box">

                <div className="compare-corpus-heading">
                    Corpus Tokenization
                </div>

                <p className="compare-corpus-label" title={corpusLabel}>
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
                    loading={selectionLoading}
                    disabled={
                        selectionLoading ||
                        loading ||
                        tokenizerOneLoading ||
                        tokenizerTwoLoading
                    }
                />

                <div className="corpus-status-row">
                    <StatusLine
                        state={statusState({
                            failed: selectionFailed,
                            loading: selectionLoading,
                        })}
                        text={selectionStatus}
                    />
                </div>

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
                        alignmentLabel="MBI"
                        alignmentAsPercentage={true}
                        headingInsideResult={true}
                        tokenizerType="1"
                        busy={
                            tokenizerOneLoading ||
                            selectionLoading
                        }
                        busyLabel={
                            tokenizerOneLoading
                                ? `Loading ${tokenizerOneInput
                                    || "tokenizer 1"}...`
                                : selectionType === "upload"
                                    ? `Loading ${corpusLoadingLabel}...`
                                : selectionType === "default"
                                    ? "Loading the built-in corpus..."
                                : `Loading ${compareLanguage}...`
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
                        alignmentLabel="MBI"
                        alignmentAsPercentage={true}
                        headingInsideResult={true}
                        tokenizerType="2"
                        busy={
                            tokenizerTwoLoading ||
                            selectionLoading
                        }
                        busyLabel={
                            tokenizerTwoLoading
                                ? `Loading ${tokenizerTwoInput
                                    || "tokenizer 2"}...`
                                : selectionType === "upload"
                                    ? `Loading ${corpusLoadingLabel}...`
                                : selectionType === "default"
                                    ? "Loading the built-in corpus..."
                                : `Loading ${compareLanguage}...`
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
                maxChars={limits?.max_text_chars ?? null}
                inputText={inputText}
                onInputChange={setInputText}
                results={[
                    {
                        id: "tokenizer-a",
                        title: compareTokenizerOne,
                        tokens: typedShown ? typedTokenizerOneTokens : [],
                        metrics: typedShown
                            ? typedTokenizerOneMetrics
                            : EMPTY_TYPED_METRICS
                    },
                    {
                        id: "tokenizer-b",
                        title: compareTokenizerTwo,
                        tokens: typedShown ? typedTokenizerTwoTokens : [],
                        metrics: typedShown
                            ? typedTokenizerTwoMetrics
                            : EMPTY_TYPED_METRICS
                    }
                ]}
            />

        </div>
    );
}

export default Compare;