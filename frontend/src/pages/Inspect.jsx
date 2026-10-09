/*
    Inspect Page
    Author: Madzibandila Charmain
    Date: 21 August 2026
*/

import "./Inspect.css";

import { useEffect, useRef, useState } from "react";

import {
    getOptions,
    getDefaultCorpus,
    uploadCorpus,
    tokenizeText,
    getMBI,
    getTokenizerInfo,
    friendlyError,
    isConnectivityError,
} from "../api/client";

import { useAppState } from "../context/useAppState";

import MetricsChart from "../components/MetricsChart";

import { languageColour } from "../components/languageColours";

import CorpusUpload from "../components/CorpusUpload";
import { checkCorpusFile, shortFileName } from "../lib/corpusFormats";

import { SearchIcon } from "../components/Icons";
import TypeAnything from "../components/TypeAnything";

import TokenStream from "../components/TokenStream";

import MetricCards from "../components/MetricCards";

import StatusLine from "../components/StatusLine";
import { statusState } from "../lib/statusState";

import { formatTokenizedText } from "../lib/tokenText";

/* Two side by side is what fits without scrolling. */
const MAX_INSPECT_LANGUAGES = 2;


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

    /* Upload size and character caps, straight from /options. */
    const [limits, setLimits] = useState(null);

    /* Shown next to the upload button. */
    const [uploadStatus, setUploadStatus] = useState("");
    const [uploadFailed, setUploadFailed] = useState(false);

    const [selectedLanguages, setSelectedLanguages] = useState(() => {

        try {

            const savedLanguages =
                localStorage.getItem("inspectSelectedLanguages");

            const parsed = savedLanguages
                ? JSON.parse(savedLanguages)
                : null;

            /* JSON.parse succeeds on "null", "7" and "{}" as well as on an
               array, and any of those reaches .length and .filter later.
               Anything that is not an array is thrown away. */
            return Array.isArray(parsed) ? parsed : [];

        }
        catch {
            return [];
        }
    });

    const [languageData, setLanguageData] = useState(() => {
        const savedLanguageData =
            localStorage.getItem("inspectLanguageData");

        if (savedLanguageData) {
            try {
                const parsed = JSON.parse(savedLanguageData);

                /* Same reason: an array or a number parses fine and then
                   breaks every lookup that follows. */
                return parsed && typeof parsed === "object" &&
                    !Array.isArray(parsed)
                    ? parsed
                    : {};
            }
            catch {
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

    const [selectionLoading, setSelectionLoading] = useState(false);

    const [tokenizerStatus, setTokenizerStatus] = useState("");
    const [tokenizerFailed, setTokenizerFailed] = useState(false);

    /*
        Which panels are actually waiting on the backend. A single flag made
        every panel say "Loading English" while isiXhosa was the one being
        fetched, so the names are tracked instead of a yes/no.
    */
    const [busyLanguages, setBusyLanguages] = useState([]);
    const [busyUpload, setBusyUpload] = useState(false);
    const [corpusLoadingLabel, setCorpusLoadingLabel] = useState("");

    /* Stores an error returned by the backend. */
    const [error, setError] = useState("");

    const [mbiError, setMbiError] = useState("");

    const [mbiUnavailable, setMbiUnavailable] = useState("");

    /* Reference to the actual file input. */
    const fileInputRef = useRef(null);

    /* The languages on screen right now, however they got picked. */
    const shown = selectedLanguages.length
        ? selectedLanguages
        : (language ? [language] : []);

    const languageLabel = shown.length === 0
        ? "no language selected"
        : shown.length === 1
            ? shown[0]
            : `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;

    /*
        The label used to read "default", which is the internal name for the
        built-in corpus and means nothing to a reader. Name the languages
        actually on screen instead, and keep it correct for one or two.

        It has to come after languageLabel: a const cannot be read on the
        line above the one that makes it.
    */
    const corpusLabel = source === "upload"
        ? `${shortFileName(fileName)} \u2022 Uploaded corpus \u2022 ${tokenizer}`
        : `Built-in corpus \u2022 ${languageLabel} \u2022 ${tokenizer}`;

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
    /*
        The effect below reads source/selectedLanguages/language/
        tokenizer in its `else` branch, which is why exhaustive-deps
        wanted all four listed - but this effect means to run once per
        mount (or once more, right after inspectInitialised itself
        flips true), not every time the user picks a different language
        or tokenizer. Listing them for real would re-run the whole
        thing - including the GET /options call - on every change.

        latestRef holds the current render's values without being a
        dependency itself: reading ref.current is not a reactive read,
        so exhaustive-deps has nothing left to ask for. It is kept in
        sync by the small effect right below it, which runs after
        every render with no dependency array of its own - there is
        nothing to be exhaustive about when the point is to run every
        time.
    */
    const latestRef = useRef({
        source,
        selectedLanguages,
        language,
        tokenizer
    });

    useEffect(() => {
        latestRef.current = {
            source,
            selectedLanguages,
            language,
            tokenizer
        };
    });

    useEffect(() => {

        async function initialiseInspect() {

            try {

                setError("");

                const result = await getOptions();

                /* A reply missing either key used to put `undefined`
                   into state, and the first `tokenizers.length` after
                   that crashed the page. */
                setLanguages(
                    Array.isArray(result?.languages) ? result.languages : []
                );

                setTokenizers(
                    Array.isArray(result?.tokenizers) ? result.tokenizers : []
                );

                setLimits(result?.limits || null);

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
                                                    .f1 ?? 0,

                                            aligned_boundaries:
                                                defaultMbiResult
                                                    .metrics
                                                    .aligned_boundaries ?? 0,

                                            total_gold_boundaries:
                                                defaultMbiResult
                                                    .metrics
                                                    .total_gold_boundaries ?? 0
                                        },

                                        mbiFailed: false
                                    }
                                })
                            );

                            /* A dataset problem is server-side news, the
                               same as a gated model or an unreachable
                               backend - it belongs in the one shared
                               status line under the tokenizer search,
                               not a second box of its own. */
                            setMbiError("");

                            setMbiUnavailable("");

                        }
                        catch (err) {

                            /* mbi stays null either way - "not fetched
                               yet" and "fetch failed" used to look
                               identical, and MetricCards turned a null
                               mbi into a plain 0.0% / 0 of 0, which reads
                               as a real (and alarming) measurement.
                               mbiFailed tells the card the two apart. */
                            setLanguageData(
                                (previousData) => ({
                                    ...previousData,

                                    [defaultLanguage]: {
                                        ...previousData[
                                            defaultLanguage
                                        ],

                                        mbi: null,

                                        mbiFailed: true
                                    }
                                })
                            );

                            if (
                                err.message?.includes(
                                    "Unsupported language"
                                )
                            ) {

                                setMbiUnavailable(
                                    `${defaultLanguage} does not have MBI metrics.`
                                );

                            }
                            else {

                                setMbiError(
                                    friendlyError(err) ||
                                    "Morphology metrics could not be loaded."
                                );

                            }

                        }
                    }
                    else {

                        setMbiError("");

                        setMbiUnavailable("");

                    }

                    setInspectInitialised(true);

                }
                else {

                    if (
                        latestRef.current.source === "default" &&
                        latestRef.current.selectedLanguages.length === 0 &&
                        latestRef.current.language
                    ) {

                        setSelectedLanguages([
                            latestRef.current.language
                        ]);

                    }

                    setTokenizerInput(
                        latestRef.current.tokenizer
                    );
                }
            }
            catch (err) {

                setError(
                    friendlyError(err) ||
                    "Could not load the backend options."
                );

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

        /*
            These sentence calls used to go out one at a time, awaited in
            a loop - a short paragraph meant a dozen separate round trips
            to the SAME already-loaded tokenizer before anything on
            screen updated, and nothing here could be cancelled, so an
            older, slower request landing after a newer (shorter) edit
            could overwrite it with stale tokens. Promise.all is safe
            here in a way it would not be for Rank's board: every
            sentence hits the one tokenizer this page already loaded,
            never several different ones that might still need
            downloading. The AbortController gives the cleanup below
            something real to cancel, the same pattern Rank uses.
        */
        const controller = new AbortController();

        const timeoutId = setTimeout(
            async () => {

                try {

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

                    const tokenizedSentences = await Promise.all(
                        sentences.map((sentence) =>
                            tokenizeText(
                                sentence,
                                language,
                                tokenizer,
                                controller.signal
                            ).then((sentenceResult) =>
                                formatTokenizedText(
                                    sentenceResult.tokenized_text
                                )
                            )
                        )
                    );

                    if (controller.signal.aborted) {
                        return;
                    }

                    setTypedTokenizedText(
                        tokenizedSentences
                    );

                    const result =
                        await tokenizeText(
                            inputText,
                            language,
                            tokenizer,
                            controller.signal
                        );

                    if (controller.signal.aborted) {
                        return;
                    }

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

                    if (
                        err.name === "AbortError" ||
                        controller.signal.aborted
                    ) {
                        return;
                    }

                    setError(
                        friendlyError(err) ||
                        "Could not tokenize the text."
                    );

                }

            },
            400
        );

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };

    }, [
        inputText,
        language,
        tokenizer,
        setTypedTokenizedText,
        setTextMetrics
    ]);

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

        setBusyLanguages([newLanguage]);

        /*
            The corpus box has one status line, fed by uploadStatus and
            uploadFailed, and it is the only place Inspect reports corpus
            progress. This used to write languageStatus/languageFailed,
            which no JSX reads, so a language change said nothing at all.
        */
        setUploadFailed(false);

        setUploadStatus(
            `Loading ${newLanguage}...`
        );

        setError("");

        try {

            const result =
                await getDefaultCorpus(
                    newLanguage,
                    tokenizer
                );

            let mbiResult = null;
            let mbiFetchFailed = false;
            let mbiLanguageUnsupported = false;
            let mbiErrorDetail = "";

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
                catch (mbiErr) {

                    /* Not re-thrown on purpose: a flaky morphology score
                       should not stop the tokenizer from being applied.
                       mbiFetchFailed still records it, so the card can
                       say "could not load" instead of a bare 0.0%. */
                    mbiResult = null;

                    if (
                        mbiErr.message?.includes(
                            "Unsupported language"
                        )
                    ) {

                        mbiLanguageUnsupported = true;

                    }
                    else {

                        mbiFetchFailed = true;

                        mbiErrorDetail =
                            friendlyError(mbiErr) ||
                            "Morphology metrics could not be loaded.";

                    }

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
                            mbiResult.metrics.f1 ?? 0,

                        aligned_boundaries:
                            mbiResult.metrics.aligned_boundaries ?? 0,

                        total_gold_boundaries:
                            mbiResult.metrics.total_gold_boundaries ?? 0
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
                            newMbi,

                        mbiFailed:
                            mbiFetchFailed
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

                setMbiError("");

                setMbiUnavailable("");

            }
            else if (mbiFetchFailed) {

                /* A dataset problem is server-side news, the same as a
                   gated model or an unreachable backend - it belongs in
                   the one shared status line under the tokenizer
                   search, not a note of its own further down the
                   page. */
                setMbiError(mbiErrorDetail);

                setMbiUnavailable("");

            }
            else if (mbiLanguageUnsupported || hasMbiMetrics(newLanguage)) {

                setMbiUnavailable(
                    `${newLanguage} does not have MBI metrics.`
                );

            }
            else {

                setMbiUnavailable("");

            }

            setUploadFailed(false);

            setUploadStatus(
                `${newLanguage} ready.`
            );

        }
        catch (err) {

            console.error(
                "Language loading error:",
                err
            );

            if (isConnectivityError(err)) {

                /* Can't reach it at all is page-level news - it belongs
                   in the one shared error slot under the tokenizer
                   picker, not repeated here too. Clear the "Loading..."
                   line instead of echoing the same message a second
                   time. */
                setError(friendlyError(err));
                setUploadStatus("");
                setUploadFailed(false);

            }
            else {

                const detail =
                    friendlyError(err) ||
                    "Could not load the language corpus.";

                setUploadStatus(detail);
                setUploadFailed(true);

            }

        }
        finally {

            setBusyLanguages([]);
            setBusyUpload(false);

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


    /* Handled file slection from user computer. */
    async function handleFileChange(event) {

        const file =
            event.target.files[0];

        if (!file) {
            return;
        }

        /* Wrong type or too big? Say so now rather than after the upload. */

        const problem = checkCorpusFile(file, limits);

        if (problem) {

            setUploadStatus(problem);
            setUploadFailed(true);

            return;

        }

        setUploadStatus(`Loading ${shortFileName(file.name)}...`);
        setUploadFailed(false);

        try {

            setSelectionLoading(true);

            setBusyUpload(true);

            setError("");

            setCorpusLoadingLabel(file.name);

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
                Keep the selected languages and their cached results while an
                upload is active, so returning to the default corpus can restore
                the same multi-language view.
            */

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
                    result.metrics?.token_premium ?? null,

                /* Carried through so the metric row can say WHY the
                   premium is N/A instead of just showing N/A. */
                token_premium_basis:
                    result.metrics?.token_premium_basis ?? null
            });

            /*
                Uploaded corpora do not have language-specific
                MBI metrics.
            */

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

            /* The line said "Loading..." until the page was unmounted. */
            setUploadStatus(`${shortFileName(file.name)} ready.`);
            setUploadFailed(false);

        }
        catch (err) {

            console.error(
                "Upload corpus error:",
                err
            );

            if (isConnectivityError(err)) {

                setError(friendlyError(err));
                setUploadStatus("");
                setUploadFailed(false);

            }
            else {

                const detail =
                    friendlyError(err) ||
                    "Could not process the uploaded corpus.";

                /* Turns the line red. Without it the status stayed
                   green and still claimed the file was loading. */
                setUploadStatus(detail);
                setUploadFailed(true);

            }

        }
        finally {

            setBusyLanguages([]);
            setBusyUpload(false);

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

        setBusyUpload(true);

        setCorpusLoadingLabel(newTokenizer);

        /*
            A tokenizer change really does reload every panel on screen, so
            here - and only here - they are all marked busy.
        */
        if (source === "upload") {
            setBusyUpload(true);
        }
        else {
            setBusyLanguages(
                selectedLanguages.length > 0
                    ? selectedLanguages
                    : (language ? [language] : [])
            );
        }

        /*
            Clear the failure flag before the attempt, otherwise the status
            line stays red while the next tokenizer is still loading.
        */
        setTokenizerFailed(false);

        setTokenizerStatus(
            `Loading ${newTokenizer}...`
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

                /* Set from whichever selected language is the one on
                   screen right now, for the status line after the loop -
                   the other selected language (up to two can be picked)
                   keeps its own result in updatedLanguageData either
                   way, this is only about what the shared status line
                   reports. */
                let activeMbiFetchFailed = false;
                let activeMbiLanguageUnsupported = false;
                let activeMbiErrorDetail = "";

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
                    let mbiFetchFailed = false;

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
                        catch (mbiErr) {

                            /*
                                MBI failure should not prevent
                                the tokenizer from being applied.
                                mbiFetchFailed still records it, so the
                                card can say "could not load" rather than
                                a plain 0.0% that reads as a real score.
                            */

                            mbiResult = null;

                            const languageUnsupported =
                                mbiErr.message?.includes(
                                    "Unsupported language"
                                );

                            if (!languageUnsupported) {
                                mbiFetchFailed = true;
                            }

                            if (selectedLanguage === language) {

                                activeMbiLanguageUnsupported =
                                    languageUnsupported;

                                if (!languageUnsupported) {

                                    activeMbiFetchFailed = true;

                                    activeMbiErrorDetail =
                                        friendlyError(mbiErr) ||
                                        "Morphology metrics could not be loaded.";

                                }

                            }

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
                                            ?.f1 ?? 0,

                                    aligned_boundaries:
                                        mbiResult.metrics
                                            ?.aligned_boundaries ?? 0,

                                    total_gold_boundaries:
                                        mbiResult.metrics
                                            ?.total_gold_boundaries ?? 0

                                }
                                : null,

                        mbiFailed:
                            mbiFetchFailed

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

                    if (activeMbi) {

                        setMbiError("");

                        setMbiUnavailable("");

                    }
                    else if (activeMbiFetchFailed) {

                        /* A dataset problem is server-side news, the
                           same as a gated model or an unreachable
                           backend - it belongs in the one shared status
                           line under the tokenizer search, not a note
                           of its own further down the page. */
                        setMbiError(activeMbiErrorDetail);

                        setMbiUnavailable("");

                    }
                    else if (
                        activeMbiLanguageUnsupported ||
                        hasMbiMetrics(language)
                    ) {

                        setMbiUnavailable(
                            `${language} does not have MBI metrics.`
                        );

                    }
                    else {

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

            setTokenizerFailed(false);

            setTokenizerStatus(
                `${newTokenizer} ready.`
            );

        }
        catch (err) {

            console.error(
                "Tokenizer loading error:",
                err
            );

            /*
                The backend already says exactly what is wrong - gated model,
                bad id, validation, server fault. The old code threw that away
                and showed one flat sentence instead, so every failure looked
                identical to the user.
            */
            const detail =
                friendlyError(err) ||
                "Could not load tokenizer.";

            setTokenizerFailed(true);

            setTokenizerStatus(detail);

        }
        finally {

            setBusyLanguages([]);
            setBusyUpload(false);

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

        setBusyUpload(true);

        setError("");

        setCorpusLoadingLabel("built-in corpus");

        setUploadStatus("Loading the built-in corpus...");
        setUploadFailed(false);

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
            let defaultMbiFailed = false;
            let defaultMbiLanguageUnsupported = false;
            let defaultMbiErrorDetail = "";

            if ( hasMbiMetrics( language ) ) {
                try {
                    const defaultMbiResult =
                    await getMBI( tokenizer, language );

                    defaultMbi = {
                        precision: defaultMbiResult.metrics.precision ?? 0,

                        recall: defaultMbiResult.metrics.recall ?? 0,

                        f1: defaultMbiResult.metrics.f1 ?? 0,

                        aligned_boundaries:
                            defaultMbiResult.metrics.aligned_boundaries ?? 0,

                        total_gold_boundaries:
                            defaultMbiResult.metrics.total_gold_boundaries ?? 0
                    };
                }
                catch (mbiErr) {
                    /* Restoring the default corpus should not fail over
                       a flaky morphology score. defaultMbiFailed still
                       records it so the card says "could not load"
                       rather than a plain 0.0%. */
                    defaultMbi = null;

                    if (
                        mbiErr.message?.includes(
                            "Unsupported language"
                        )
                    ) {

                        defaultMbiLanguageUnsupported = true;

                    }
                    else {

                        defaultMbiFailed = true;

                        defaultMbiErrorDetail =
                            friendlyError(mbiErr) ||
                            "Morphology metrics could not be loaded.";

                    }
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

            /* Keep every language selected before the upload. */
            setSelectedLanguages((previousLanguages) =>
                previousLanguages.includes(language)
                    ? previousLanguages
                    : [...previousLanguages, language].slice(
                        -MAX_INSPECT_LANGUAGES
                    )
            );

            /*
                Store the default language result.
            */

            setLanguageData((previousData) => ({
                ...previousData,
                [language]: {
                    tokenizedText:
                        formattedTokens,

                    metrics:
                        defaultMetrics,

                    mbi: defaultMbi,

                    mbiFailed: defaultMbiFailed
                }
            }));

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

                setMbiError("");

                setMbiUnavailable("");

            }
            else if (defaultMbiFailed) {

                /* A dataset problem is server-side news, the same as a
                   gated model or an unreachable backend - it belongs in
                   the one shared status line under the tokenizer
                   search, not a note of its own further down the
                   page. */
                setMbiError(defaultMbiErrorDetail);

                setMbiUnavailable("");

            }
            else if (
                defaultMbiLanguageUnsupported ||
                hasMbiMetrics(language)
            ) {

                setMbiUnavailable(
                    `${language} does not have MBI metrics.`
                );

            }
            else {

                setMbiUnavailable("");

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

            /* The line still named the file that was just thrown away. */
            setUploadStatus("Built-in corpus ready.");
            setUploadFailed(false);

        }
        catch (err) {

            if (isConnectivityError(err)) {

                setError(friendlyError(err));
                setUploadStatus("");
                setUploadFailed(false);

            }
            else {

                const detail =
                    friendlyError(err) ||
                    "Could not load the built-in corpus.";

                setUploadStatus(detail);
                setUploadFailed(true);

            }

        }
        finally {

            setBusyLanguages([]);
            setBusyUpload(false);

            setSelectionLoading(
                false
            );

        }

    }

    // Cycles through the 8 CSS colors for the tokens

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
                                <SearchIcon />
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

                            <StatusLine
                                    state={statusState({
                                        failed: tokenizerFailed,
                                        loading: selectionLoading
                                    })}
                                    text={tokenizerStatus}
                                    modelName={tokenizerInput}
                                />

                        )}

                        {/*
                            Page-level failures: the first load, tokenizing
                            typed text, and morphology metrics that failed
                            or do not apply to this language. All of them
                            live here, under the tokenizer search and pills
                            - the same spot the tokenizer's own status uses
                            - instead of each keeping its own separate box
                            further down the page.
                        */}
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

                    </div>

                </div>

            </section>

            {/* Corpus tokenization box */}

            <section
                className={
                    "corpus-box"
                    + (busyUpload ? " is-busy" : "")
                }
            >

                {busyUpload && (
                    <div className="block-overlay">
                        <span className="spinner"></span>
                        <span className="block-overlay-text">
                            Loading {corpusLoadingLabel}&hellip;
                        </span>
                    </div>
                )}

                <div className="corpus-heading">
                    Corpus Tokenization
                </div>

                <p className="corpus-label" title={corpusLabel}>
                    {corpusLabel}
                </p>

                <CorpusUpload
                    inputId="corpus-upload"
                    fileInputRef={fileInputRef}
                    onFileChange={handleFileChange}
                    onDefault={handleDefault}
                    showDefault={fileName !== "default"}
                    loading={selectionLoading}
                    disabled={selectionLoading}
                />

                <div className="corpus-status-row">
                    <StatusLine
                        state={statusState({
                            failed: uploadFailed,
                            loading: selectionLoading,
                        })}
                        text={uploadStatus}
                    />
                </div>

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
                            className={
                                "language-tokenization-block"
                                + (busyUpload ? " is-busy" : "")
                            }
                        >

                            {/* Tokenization Result */}

                            <div className="tokenization-result">

                                <div className="tokenization-language">

                                    <span
                                        className="swatch"
                                        style={{ background: "#8b93a0" }}
                                    ></span>

                                    Uploaded Corpus

                                </div>

                                <div className="tokenization-text">

                                    <TokenStream tokens={corpusTokenizedText} />

                                </div>

                            </div>

                            {/* Tokenization metrics */}

                            <MetricCards
                                metrics={corpusMetrics}
                            />

                        </div>

                    ) : (

                        selectedLanguages.map(
                            (selectedLanguage) => {

                                const data =
                                    languageData[
                                        selectedLanguage
                                    ];

                                const isBusy =
                                    busyLanguages.includes(
                                        selectedLanguage
                                    );

                                /*
                                    A language that has just been picked has
                                    no data yet. Returning null left the user
                                    with no sign anything was happening, so
                                    stand an empty panel in its place and put
                                    the wheel in it.
                                */
                                if (!data) {

                                    if (!isBusy) {
                                        return null;
                                    }

                                    return (
                                        <div
                                            key={selectedLanguage}
                                            className="language-tokenization-block is-busy is-empty"
                                        >

                                            <div className="block-overlay">
                                                <span className="spinner"></span>
                                                <span className="block-overlay-text">
                                                    Loading {selectedLanguage}&hellip;
                                                </span>
                                            </div>

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

                                                </div>

                                                <div className="tokenization-text"></div>

                                            </div>

                                        </div>
                                    );
                                }

                                return (

                                    <div
                                        key={selectedLanguage}
                                        className={
                                            "language-tokenization-block"
                                            + (isBusy ? " is-busy" : "")
                                        }
                                    >

                                        {/* Only the panel that is actually
                                            waiting on the backend goes busy,
                                            and it names its own language. */}
                                        {isBusy && (
                                            <div className="block-overlay">
                                                <span className="spinner"></span>
                                                <span className="block-overlay-text">
                                                    Loading {selectedLanguage}&hellip;
                                                </span>
                                            </div>
                                        )}

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

                                            </div>

                                            <div className="tokenization-text">

                                                <TokenStream tokens={data.tokenizedText} />

                                            </div>

                                        </div>

                                        {/* Tokenization metrics */}

                                        <MetricCards
                                            metrics={data.metrics}
                                            mbi={data.mbi}
                                            mbiFailed={data.mbiFailed}
                                            showMbi={hasMbiMetrics(
                                                selectedLanguage
                                            )}
                                            alignmentLabel="MBI"
                                            alignmentAsPercentage={true}
                                        />

                                    </div>

                                );

                            }
                        )

                    )}

                </div>

                {/* mbiUnavailable and mbiError now surface in the one
                    page-level status line under the tokenizer picker,
                    alongside `error` - not repeated here. */}

            </section>
            <MetricsChart tokenizer={tokenizer} />

            {/* Text input box */}
            <TypeAnything
                maxChars={limits?.max_text_chars ?? null}
                inputText={inputText}
                onInputChange={setInputText}
                results={[
                    {
                        tokens: typedTokenizedText,
                        metrics: textMetrics
                    }
                ]}
            />

        </>
        

    );

}

export default Inspect;