/*
    Rank Page
    Author: Mukovhe Ranwashe (RNWMUK001)
    September 2026
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "./Rank.css";

import {
    createOrUpdateLeaderboardEntry,
    restoreLeaderboardEntry,
    deleteLeaderboardEntry,
    friendlyError,
    getLeaderboard,
    getMetrics,
    getMetricsBulk,
    getSavedLeaderboardEntry,
    getOptions,
    getScoring,
    getTokenizerInfo,
} from "../api/client";

import { useAppState } from "../context/useAppState";

import LeaderboardTable from "../components/LeaderboardTable";

import LanguageHeatmap from "../components/LanguageHeatmap";

import StatusMessage from "../components/StatusMessage";

import StatusLine from "../components/StatusLine";

import { INITIAL_TOKENIZERS } from "./rankPlaceholders";

/*
    English is the baseline the token premium is measured against, so it is
    not one of the languages a tokenizer is scored on. Averaging it in would
    add a guaranteed 1.0 premium to every tokenizer alike and flatter all of
    them by exactly the same amount.
*/
const BASELINE_LANGUAGE = "English";

/* How the four parts of the score read in a sentence. */
const COMPONENT_LABELS = {
    token_premium: "cost against English",
    fertility: "tokens per word",
    f1: "morpheme boundaries",
    compression: "bytes per token",
};

/*
    The premium bars are drawn against this, not against the worst language
    on the board. A fixed ceiling means the same language looks the same
    length whichever tokenizer is leading, so the chart can be read across
    two screenshots. 3.0x is three times the English bill, which is about
    where an English-trained BPE lands on isiZulu.
*/
const BREAKDOWN_CEILING = 3.0;

/* What the "rank by" control offers, and which way is good. */
const SORT_OPTIONS = [
    { key: "overall_score", label: "Overall score", lowerIsBetter: false },
    { key: "fertility", label: "Fertility", lowerIsBetter: true },
    { key: "compression", label: "Compression", lowerIsBetter: false },
    { key: "token_premium", label: "Token premium", lowerIsBetter: true },
    { key: "f1", label: "Morphology F1", lowerIsBetter: false },
    { key: "precision", label: "Precision", lowerIsBetter: false },
    { key: "recall", label: "Recall", lowerIsBetter: false },
    { key: "token_count", label: "Total tokens", lowerIsBetter: true },
    { key: "name", label: "Name", lowerIsBetter: true },
];

/*
    A tokenizer's colour is derived from its NAME, not from where it is
    standing. Colouring by rank would repaint every bar the moment somebody
    added a model, so the eye would have to re-learn the chart after a
    change that had nothing to do with the rows it repainted.

    Three colours, not six. The flag's own green, blue and red were run
    through a contrast and colour-blindness check against this page's white
    surface: the flag blue (#001489) is too dark to sit in a categorical
    set and the flag gold is too light to hold 3:1 contrast, and gold beside
    red is indistinguishable to a deuteranope. These three are the flag's
    hues moved just far enough to pass, and gold is kept for the one place
    it works - marking the English baseline bar, where it is the only thing
    of its kind rather than one category among several.

    Even so, colour is never the only thing carrying identity here: every
    bar sits beside the name and the number it belongs to, and the chip
    shows the tokenizer's initials. A reader who cannot separate the hues
    loses nothing.
*/
const IDENTITY_COLOURS = [
    "#007749",   /* the flag's green, unchanged - it already passes */
    "#2A46B8",   /* flag blue, lightened out of the too-dark band */
    "#D2342B",   /* flag red, a step down for contrast on white */
];

function identityColour(name) {

    const text = String(name || "");

    let hash = 0;

    for (let index = 0; index < text.length; index += 1) {
        hash = (hash * 31 + text.charCodeAt(index)) % 100000;
    }

    return IDENTITY_COLOURS[hash % IDENTITY_COLOURS.length];
}

/* The two capitals in the round chip beside a name, as in the mock-up. */
function initials(name) {

    const bare = String(name || "").split("/").pop();

    return bare.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "??";
}

/* "Davlan/afro-xlmr-base" -> "Davlan". The model's publisher. */
function vendor(name) {

    const parts = String(name || "").split("/");

    return parts.length > 1 ? parts[0] : "Hugging Face";
}

/* Small line icons, inline so the page needs no icon library. */
const IconEfficiency = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
);

const IconTrophy = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M7 6H4v1a3 3 0 0 0 3 3m10-4h3v1a3 3 0 0 1-3 3" />
        <path d="M9 20h6M12 14v6" />
    </svg>
);

/*
    Pure - read only their own parameters - so there is no reason to
    redeclare either one on every render. Used by initialiseDefaultLeaderboard
    and handleAdd below.
*/
function hasCompleteLeaderboardMetrics(saved) {
    if (!saved) {
        return false;
    }

    return (

        saved.token_count !== null &&
        saved.token_count !== undefined &&
        Number.isFinite(Number(saved.token_count)) &&

        saved.fertility !== null &&
        saved.fertility !== undefined &&
        Number.isFinite(Number(saved.fertility)) &&

        saved.compression !== null &&
        saved.compression !== undefined &&
        Number.isFinite(Number(saved.compression)) &&

        saved.token_premium !== null &&
        saved.token_premium !== undefined &&
        Number.isFinite(Number(saved.token_premium)) &&

        saved.f1 !== null &&
        saved.f1 !== undefined &&
        Number.isFinite(Number(saved.f1)) &&

        saved.precision !== null &&
        saved.precision !== undefined &&
        Number.isFinite(Number(saved.precision)) &&

        saved.recall !== null &&
        saved.recall !== undefined &&
        Number.isFinite(Number(saved.recall))
    );
}

/* "restored 3" / "restored 2 and measured 1" / with a failure appended.
   One failure reads the way the same failure reads on every other page:
   "Leaderboard ready - restored 3. Model 'x' not found on Hugging Face..."
   - the backend's sentence already names the model, so it is not wrapped
   in "1 did not load: x (...)" as well, which said the name twice and
   pushed the line past the 220 characters a status line is cut at. More
   than one failure lists the names, then the first reason. */
function describeDefaults(restored, measured, failed = []) {

    const parts = [];

    if (restored) {
        parts.push(`restored ${restored}`);
    }

    if (measured) {
        parts.push(`measured ${measured}`);
    }

    const sentence = parts.length === 0
        ? (failed.length
            ? "Could not set up the default leaderboard."
            : "Leaderboard ready.")
        : `Leaderboard ready \u2014 ${parts.join(" and ")}.`;

    if (!failed.length) {
        return sentence;
    }

    const [first] = failed;

    if (failed.length === 1 && first.detail.includes(first.name)) {
        return `${sentence} ${first.detail}`;
    }

    const names = failed.map((item) => item.name).join(", ");

    return `${sentence} ${failed.length} did not load: ${names} ` +
        `(${first.detail}).`;
}

function Rank() {

    /*
        The board, the heatmap grid, the scoring weights and the sort/
        filter controls all used to live in local state here, so leaving
        Rank for another page unmounted the component and took all of it
        with it - coming back meant remounting from zero and running the
        whole restore-or-measure flow again, even though nothing about
        the board had actually changed. These now live in AppStateContext,
        the same way Inspect and Compare's selections already do, so they
        survive navigating away and a page refresh - only the transient,
        in-progress-right-now state below (loading flags, add/remove
        status lines) stays local, because those are fine to reset.
    */
    const {
        rankInitialised,
        setRankInitialised,
        rankRows: rows,
        setRankRows: setRows,
        rankWeights: weights,
        setRankWeights: setWeights,
        rankSortKey: sortKey,
        setRankSortKey: setSortKey,
        rankBestFirst: bestFirst,
        setRankBestFirst: setBestFirst,
        rankFilter: filter,
        setRankFilter: setFilter,
        rankShowAllMetrics: showAllMetrics,
        setRankShowAllMetrics: setShowAllMetrics,
        rankFloresLanguages: floresLanguages,
        setRankFloresLanguages: setFloresLanguages,
        rankMatrix: matrix,
        setRankMatrix: setMatrix,
    } = useAppState();

    /* True only on a genuinely first load - a remount with the board
       already restored from context should show it immediately rather
       than flashing the loading state it does not need. */
    const [isLoading, setIsLoading] = useState(() => !rankInitialised);
    const [errorMessage, setErrorMessage] = useState("");

    const [adding, setAdding] = useState(false);

    /* True from the moment Rank mounts until its first load has completely
       finished - reading the board and, on an empty one, checking for
       saved measurements and restoring or measuring the four defaults.
       The search box, the Add button and Remove are all locked for that
       whole time, so the defaults always finish first and a manual add
       can only ever come after them.

       It used to start false and only switch on once measuring actually
       began, which left a gap - while the board was being read and
       while "Checking for saved measurements..." was on screen - where a
       tokenizer could be typed and added underneath the setup. The two
       then interleaved: whichever call's setAddStatus/loadLeaderboard
       landed last won, so a manual add looked like it "stopped" the
       defaults, which then "continued" and overwrote its status line. */
    const [bootstrapping, setBootstrapping] = useState(true);
    const [addStatus, setAddStatus] = useState("");
    const [addFailed, setAddFailed] = useState(false);
    const [addPartial, setAddPartial] = useState(false);
    const [addedName, setAddedName] = useState("");

    const [removingId, setRemovingId] = useState(null);

    /* Per-tokenizer reasons the heatmap grid below could not read a row's
       metrics - keyed by tokenizer name, same key `matrix` uses. Local
       and not persisted: it is a live reflection of the most recent
       fetch, and a stale error surviving a reload after the real problem
       is fixed would be worse than no error at all. */
    const [matrixErrors, setMatrixErrors] = useState({});

    /* Per-language premiums for whoever is top of the board. Left local
       rather than lifted with the rest: it is keyed off the leader's name
       and re-reads a cached, near-instant endpoint, so it is cheap to
       refetch on every mount and that keeps it honestly fresh rather than
       trusting a stale copy. */
    const [breakdown, setBreakdown] = useState([]);

    /* Which leaderName `breakdown` currently reflects - not the same
       thing as `leaderName` itself while a fetch for a new leader is
       still in flight. breakdownLoading is derived from comparing the
       two instead of being its own toggled flag - see the effect. */
    const [breakdownFor, setBreakdownFor] = useState(null);

    /*
        Adding a tokenizer is a long chain of requests. If the user leaves
        the page halfway through, every one of them should stop, and none
        of them should write state into a component that is gone.
    */
    const addControllerRef = useRef(null);

    /* What this browser remembered about Rank when the page mounted.
       Read through a ref rather than listed as a dependency of the
       mount effect below: that effect sets rankInitialised itself when
       it finishes, so depending on it made the effect run a second time
       - abort the first run, start over - for no reason at all. */
    const initialisedAtMountRef = useRef(rankInitialised);

    useEffect(() => {

        return () => addControllerRef.current?.abort();

    }, []);

    /* useCallback so initialiseDefaultLeaderboard below can list it as
       a dependency without that dependency changing identity every
       render - setRows is the only reactive thing this closes over,
       and setState setters are stable for the life of the component. */
    const loadLeaderboard = useCallback(async function loadLeaderboard(signal) {

        const data = await getLeaderboard(
            {
                sortBy: "overall_score",
                descending: true,
            },
            signal
        );

        const list = Array.isArray(data) ? data : [];

        setRows(list);

        /*
            Returned as well as stored: the mount effect below needs to
            know whether the board came back empty the moment this
            resolves, and reading the `rows` state right after calling
            this would still see the value from before the update -
            React batches it instead of applying it synchronously.
        */
        return list;
    }, [setRows]);

    /* Same reasoning as loadLeaderboard above - wrapped so the mount
       effect further down can depend on it honestly instead of lying
       with an empty array. hasCompleteLeaderboardMetrics and
       describeDefaults are not listed: they moved to module scope
       above, so their identity never changes at all. */
    const initialiseDefaultLeaderboard = useCallback(async function initialiseDefaultLeaderboard(savedEntries, signal, onlyMissing = false) {
        /*
            These are the tokenizers that make up the default Rank board.
            If a tokenizer was measured before, restore its saved measurement.
            Otherwise, measure it through the normal real-data pipeline.

            savedEntries is fetched by the caller (initialiseRank), not
            here - it already has to run that same lookup to decide
            whether this function should even be called at all, and
            fetching the same four rows twice for one decision would be
            wasteful.
        */
        let restored = 0;
        let measured = 0;

        /*
            One tokenizer failing here - a cold download timing out, a
            genuinely gated model, a backend hiccup - used to throw out of
            this whole function before the loop ever reached
            loadLeaderboard() below, so tokenizers that HAD already
            measured successfully earlier in this same run were sitting in
            the database but never made it onto the screen: the page
            showed an empty board with no explanation. Each tokenizer now
            gets its own try/catch below - a failure is recorded here and
            the loop moves on, so the rest of the board still gets
            measured and shown.
        */
        const failed = [];

        /*
            Which defaults to work through. Normally all four. When
            finishing a setup that was cut short (onlyMissing), only the
            ones that have never been measured: a default with a saved
            record is either already on the board or was taken off it on
            purpose, and either way it is left alone.
        */
        const work = INITIAL_TOKENIZERS
            .map((_, index) => index)
            .filter((index) => !onlyMissing || savedEntries[index] === null);

        for (let step = 0; step < work.length; step += 1) {

            const index = work[step];
            const name = INITIAL_TOKENIZERS[index];
            const saved = savedEntries[index];
            const position = `${step + 1} of ${work.length}`;

            try {

                /*
                    The tokenizer already has a measurement in the database.
                    Reactivate it without running the expensive measurement
                    again - restoreLeaderboardEntry (POST .../restore) just
                    flips the row back to active, the same call handleAdd
                    below already uses for the identical situation.
                    createOrUpdateLeaderboardEntry was being called here
                    instead, which re-runs the full FLORES + NCHLT
                    measurement regardless of there being a saved result
                    already sitting in the database - "Restoring" was
                    claiming to skip the expensive path while actually
                    paying for it every time.
                */
                if (hasCompleteLeaderboardMetrics(saved)) {

                    setAddStatus(
                        `Restoring ${name} (${position})...`
                    );

                    await restoreLeaderboardEntry(
                        name,
                        signal
                    );

                    restored += 1;

                    continue;
                }

                /*
                    This tokenizer has never been measured, so use the real
                    Hugging Face tokenizer and MzansiToken measurement pipeline.
                    Worth naming as measuring rather than saving: it is the slow
                    path, and a user who knows which one they are on knows why
                    it is taking as long as it is.
                */
                setAddStatus(
                    `Measuring ${name} for the first time (${position})...`
                );

                await getTokenizerInfo(name, signal);

                await createOrUpdateLeaderboardEntry(
                    name,
                    signal
                );

                measured += 1;

            }
            catch (error) {

                /* Leaving the page aborts every request in flight at
                   once - that is not this tokenizer's fault, and nothing
                   later in the loop can succeed either, so stop instead
                   of recording a string of identical abort failures. */
                if (error.name === "AbortError") {
                    throw error;
                }

                failed.push({
                    name,
                    detail: friendlyError(error) || String(error?.message || error)
                });
            }
        }

        /*
            Fetch the real active leaderboard and put it into React state -
            always, even when some of the above failed, so whatever DID
            measure or restore successfully still reaches the screen
            instead of staying hidden behind one bad tokenizer.
        */
        setAddStatus("Loading the leaderboard...");

        await loadLeaderboard(signal);

        if (failed.length) {
            setAddPartial(true);
        }

        /*
            The loop used to leave its last "Restoring..." line on screen
            for good, so the page went on claiming to be busy long after it
            had finished. Say what happened instead - including whatever
            did not make it onto the board.
        */
        setAddStatus(describeDefaults(restored, measured, failed));
    }, [loadLeaderboard]);

    useEffect(() => {

        const controller = new AbortController();

        /*
            Every await below is followed by an aborted check, and that is
            load-bearing. React's StrictMode (main.jsx) mounts this page,
            unmounts it and mounts it again in development, so the first
            run's controller is aborted almost immediately - but the async
            function it started keeps going unless it stops itself. It used
            to keep going: its aborted requests were caught and swallowed,
            it carried on into the seeding check as if the board were
            empty, marked that check as done, and died there. The real
            second run then saw "already checked" and skipped seeding, and
            the page sat on "Checking for saved measurements..." forever.
            An aborted run now returns at its first await and touches
            nothing.
        */
        async function initialiseRank() {

            setErrorMessage("");

            /*
                One cheap database read, first, on every mount - restored
                or not. This is what makes closing the site and reopening
                it show the previous board right away: a read straight
                from the database that was already sitting there, not a
                guess about whether this particular browser remembers
                finishing setup before. A revisit that already has the
                board in context still gets this same read, quietly
                replacing it with whatever is current rather than trusting
                a copy that could be stale.
            */
            let currentRows = [];
            let boardRead = false;

            try {

                currentRows = await loadLeaderboard(controller.signal);
                boardRead = true;

            }
            catch (error) {

                if (error.name !== "AbortError") {

                    setErrorMessage(
                        friendlyError(error) ||
                        "Could not load the leaderboard."
                    );

                }

            }

            if (controller.signal.aborted) {
                return;
            }

            /* Whatever the database had to say, say it now - a revisit
               already showing the board from context never needed the
               spinner in the first place, and a genuine first load has
               real rows (or a real error) to show instead of one. */
            setIsLoading(false);

            /*
                Refetching /options and /leaderboard/scoring (the language
                list and the score-weight sentence) on every single visit
                would be wasted work once this browser already has them -
                they barely ever change.
            */
            if (!initialisedAtMountRef.current) {

                try {

                    const options = await getOptions(controller.signal);

                    setFloresLanguages(options.languages || []);

                }
                catch (error) {

                    if (error.name !== "AbortError") {

                        setErrorMessage(
                            friendlyError(error) ||
                            "Could not load the leaderboard."
                        );

                    }

                }

                if (controller.signal.aborted) {
                    return;
                }

                try {

                    setWeights(
                        (await getScoring(controller.signal)).weights || null
                    );

                }
                catch (error) {

                    /* The explainer sentence is optional; the board is not. */
                    if (error.name !== "AbortError") {
                        setWeights(null);
                    }
                }

                if (controller.signal.aborted) {
                    return;
                }

            }

            /*
                Whether to set up the defaults is decided from what the
                database itself says, never from what this browser
                remembers - and only when the board was actually read: a
                backend that could not be reached says nothing about it.

                An empty board is one of two things. A deliberately
                emptied board - the user removed every tokenizer on
                purpose - still has all four defaults saved in the
                database, just inactive, and stays empty. A genuinely
                reset backend - a deleted data folder, a fresh clone, a
                teammate's first run - is missing at least one of them,
                and gets set up.

                A board that is NOT empty is checked too, because setup
                can be cut short: leaving Rank while the defaults are
                still being measured stops the loop, and the board used to
                stay one, two or three defaults short for good, since it
                was no longer empty. A default with no saved record at all
                has never been measured, so it is measured now. Defaults
                that have a saved record are left exactly as they are.
            */
            if (boardRead) {

                const boardEmpty = currentRows.length === 0;

                try {

                    /* Only worth saying on an empty board - a normal
                       revisit checks quietly. */
                    if (boardEmpty) {
                        setAddStatus("Checking for saved measurements...");
                    }

                    /*
                        Cheap database reads, so they go out together and
                        four sequential round trips become one wait.
                    */
                    const savedEntries = await Promise.all(
                        INITIAL_TOKENIZERS.map(async (name) => {

                            try {
                                return await getSavedLeaderboardEntry(
                                    name,
                                    controller.signal
                                );
                            }
                            catch (error) {

                                /* No saved measurement is an ordinary
                                   answer, not a failure: it just means
                                   this one has never been measured. */
                                if (error.status !== 404) {
                                    throw error;
                                }

                                return null;
                            }
                        })
                    );

                    if (controller.signal.aborted) {
                        return;
                    }

                    if (boardEmpty) {

                        /*
                            every(), not some(). "The user removed every
                            tokenizer on purpose" means all four were once
                            active and all four got taken off - which only
                            holds if EVERY one of them already has a saved
                            record. Three saved and one never measured is
                            the ordinary restore-three/measure-one case.
                        */
                        const allDefaultsAlreadySaved = savedEntries.every(
                            (entry) => entry !== null
                        );

                        if (!allDefaultsAlreadySaved) {

                            await initialiseDefaultLeaderboard(
                                savedEntries,
                                controller.signal
                            );
                        }
                        else {
                            /* Every default already has a saved record - this
                               is a board the user emptied on purpose, not a
                               reset backend. Respect it and stay empty. */
                            setAddStatus("");
                        }
                    }
                    else if (savedEntries.some((entry) => entry === null)) {

                        /* Setup was cut short: finish it. */
                        await initialiseDefaultLeaderboard(
                            savedEntries,
                            controller.signal,
                            true
                        );
                    }

                }
                catch (error) {

                    if (error.name !== "AbortError" && !controller.signal.aborted) {

                        setErrorMessage(
                            friendlyError(error) ||
                            "Could not load the leaderboard."
                        );
                        setAddStatus("");
                    }

                }
            }

            if (!controller.signal.aborted) {
                setRankInitialised(true);

                /* Every path above that does not end in an abort lands
                   here - success, a failed default, an unreachable
                   backend - so this is the one place the lock lifts. */
                setBootstrapping(false);
            }

        }

        initialiseRank();

        return () => controller.abort();

    }, [initialiseDefaultLeaderboard, loadLeaderboard, setFloresLanguages, setWeights, setRankInitialised]);

    async function handleAdd(requested) {
        const name = String(requested ?? filter).trim();

        if (!name || adding || bootstrapping) {
            return;
        }

        addControllerRef.current?.abort();

        const controller = new AbortController();
        addControllerRef.current = controller;

        setAdding(true);
        setAddFailed(false);
        setAddPartial(false);
        setAddedName(name);
        setAddStatus(`Loading ${name}...`);

        try {
            /*
                Check first so a typo or a gated model comes back as the
                backend's own sentence - with its Hugging Face link - before
                the user waits through a full measurement run.
            */
            await getTokenizerInfo(name, controller.signal);

            /*
                Check whether this tokenizer was measured before.

                If it was previously removed from the leaderboard, its
                measurements are still stored in the database. Restoring
                those measurements avoids running the expensive efficiency
                and morphology calculations again.
            */
            setAddStatus(`Checking saved results for ${name}...`);

            let saved = null;

            try {
                saved = await getSavedLeaderboardEntry(
                    name,
                    controller.signal
                );
            }
            catch (error) {
                /*
                    A 404 simply means this tokenizer has never been measured.
                    Any other error should still be reported normally.
                */
                if (error.status !== 404) {
                    throw error;
                }
            }

            if (hasCompleteLeaderboardMetrics(saved)) {
                setAddStatus(`Restoring saved results for ${name}...`);

                await restoreLeaderboardEntry(
                    name,
                    controller.signal
                );

                await loadLeaderboard(controller.signal);

                setAddStatus(
                    `${name} restored using its previous measurement.`
                );

                setFilter("");
                return;
            }

            /*
                No saved measurement exists, so this is a new tokenizer.
                This is the only path that performs the expensive measurement.
            */
            setAddStatus(`Saving ${name}...`);

            const savedResult = await createOrUpdateLeaderboardEntry(
                name,
                controller.signal
            );

            const measured = savedResult.metrics;

            await loadLeaderboard(controller.signal);

            const morphologyNote = measured.morphology_measured
                ? `, morphology on ${measured.morphology_measured}`
                : ", no morphology data";

            const failures = measured.failed_languages || [];

            /*
                A partial result says so. Reporting "scored on 7 languages"
                in the green ready style when two of them failed is the
                same bug as a failure that looks like a success - the user
                would have no way of knowing the score was built on less
                than it says.
            */
            if (failures.length) {
                setAddPartial(true);

                setAddStatus(
                    `${name} scored on ${measured.languages_measured} ` +
                    `languages${morphologyNote}. Morphology failed on ` +
                    `${failures.map((item) => item.language).join(", ")}: ` +
                    `${failures[0].detail}`
                );
            }
            else {
                setAddStatus(
                    `${name} scored on ${measured.languages_measured} ` +
                    `languages${morphologyNote}.`
                );
            }

            setFilter("");
        }
        catch (error) {
            if (error.name === "AbortError") {
                return;
            }

            /*
                Reported on the status line only, NOT in errorMessage.
                errorMessage replaces the whole board, so routing a failed
                add through it made one bad model id wipe the leaderboard
                off the screen. errorMessage is for a board that could not
                be loaded; this is an add that did not happen.
            */
            setAddFailed(true);

            setAddStatus(
                friendlyError(error) ||
                `Could not add ${name} to the leaderboard.`
            );

            /* The box is cleared on a failure too, not only on success.
               It is also the board's search filter, so leaving the failed
               name in it filtered the whole table down to "Nothing matches
               that." right under the error. The error line above still
               names the model, so the user knows what to retype. */
            setFilter("");
        }
        finally {
            if (addControllerRef.current === controller) {
                addControllerRef.current = null;
                setAdding(false);
            }
        }
    }

    async function handleRemove(row) {

        /* A sample row has nothing behind it to delete. */
        if (!row?.id || typeof row.id !== "number") {
            return;
        }

        if (removingId != null || adding || bootstrapping) {
            return;
        }

        setRemovingId(row.id);
        setAddFailed(false);
        setAddPartial(false);
        setAddedName("");
        setAddStatus(`Removing ${row.name}...`);

        try {

            await deleteLeaderboardEntry(row.id);

            await loadLeaderboard();

            setAddStatus(`${row.name} removed.`);

        }
        catch (error) {

            /* Same reason: the row is still there, so the board stays. */
            setAddFailed(true);

            setAddStatus(
                friendlyError(error) ||
                `Could not remove ${row.name}.`
            );

        }
        finally {
            setRemovingId(null);
        }
    }

    const busy = adding || removingId != null;

    const board = rows;

    const sortSpec =
        SORT_OPTIONS.find((option) => option.key === sortKey) ||
        SORT_OPTIONS[0];

    const visible = useMemo(() => {

        const needle = filter.trim().toLowerCase();

        const matched = needle
            ? board.filter((row) =>
                String(row.name).toLowerCase().includes(needle))
            : board;

        /*
            "Best first" has to mean best, not biggest - fertility and token
            premium are better when they are smaller. The direction comes
            from the column, so the control can say "best first" honestly
            whichever measure is chosen.
        */
        const ascending = bestFirst
            ? sortSpec.lowerIsBetter
            : !sortSpec.lowerIsBetter;

        return [...matched].sort((a, b) => {

            const left = a?.[sortKey];
            const right = b?.[sortKey];

            if (left == null && right == null) {
                return 0;
            }

            /* Unmeasured rows sit at the bottom either way round. */
            if (left == null) {
                return 1;
            }

            if (right == null) {
                return -1;
            }

            if (typeof left === "number" && typeof right === "number") {
                return ascending ? left - right : right - left;
            }

            const result = String(left).localeCompare(String(right));

            return ascending ? result : -result;
        });

    }, [board, filter, sortKey, bestFirst, sortSpec]);

    /*
        The spotlight always shows the best OVERALL tokenizer, whatever the
        table happens to be sorted or filtered by. "Current leader" that
        changed when you typed in the search box would not mean anything.
    */
    const ranked = useMemo(() => (
        [...board].sort(
            (a, b) => (b.overall_score ?? -1) - (a.overall_score ?? -1)
        )
    ), [board]);

    const leader = ranked[0] || null;

    const chasing = ranked.slice(0, 4);

    const leaderName = leader?.name || "";

    /* A plain string, so the grid's effect only reruns when the board's
       membership actually changes. Newline-joined because a model name can
       contain a slash but never a line break. */
    const boardNames = useMemo(
        () => ranked.map((row) => row.name).join("\n"),
        [ranked]
    );

    /*
        The leader's per-language premiums. Fetched rather than derived,
        because the board only stores the average and the interesting part
        is the spread underneath it. GET /metrics/{model} is cached by the
        backend, so the leader changing is a cheap request and usually an
        instant one.

        Depends on the NAME, not on the row object - the row is rebuilt on
        every reload and a dependency on it would refetch forever.
    */
    useEffect(() => {

        if (!leaderName) {
            /* Not cleared here on purpose: the section below only
               renders when `leader` is truthy, so a stale breakdown
               sitting in state while there is no leader is never
               seen. Resetting it was a synchronous setState with
               nothing behind it. */
            return;
        }

        const controller = new AbortController();

        getMetrics(leaderName, controller.signal)
            .then((perLanguage) => {

                const rows = Object.keys(perLanguage || {})
                    .filter((language) => language !== BASELINE_LANGUAGE)
                    .map((language) => ({
                        language,
                        premium: Number(
                            perLanguage[language]?.token_premium
                        ),
                    }))
                    .filter((row) => Number.isFinite(row.premium))
                    .sort((a, b) => b.premium - a.premium);

                setBreakdown(rows);
                setBreakdownFor(leaderName);
            })
            .catch((error) => {

                /*
                    The board above is already on screen and already correct.
                    A failure here costs one panel, so it removes the panel
                    rather than shouting over a page that is otherwise fine.
                */
                if (error.name !== "AbortError") {
                    console.warn(
                        "Could not read the leader's per-language metrics.",
                        error
                    );

                    setBreakdown([]);
                    setBreakdownFor(leaderName);
                }
            });

        return () => controller.abort();

    }, [leaderName]);

    /* True from the render where leaderName changes until the
       matching fetch above resolves - no separate flag to drift
       out of sync with what actually happened. */
    const breakdownLoading = Boolean(leaderName) && breakdownFor !== leaderName;

    /*
        The same per-language read, for every tokenizer on the board -
        now one request for the whole board instead of one per row.

        Keyed on the joined names rather than on `ranked`: the array is
        rebuilt on every reload, so depending on it would refetch forever.

        This used to call getMetrics once per tokenizer, one at a time,
        specifically to avoid firing several uncached tokenizations at
        the backend concurrently - a cold tokenizer makes it tokenize the
        whole corpus in eight languages, and ten of those at once would
        have held the API open for everything else. getMetricsBulk keeps
        that same one-at-a-time behaviour, just inside one request on the
        server rather than N requests from the browser - for a board
        that is already measured (the common case: reloading Rank with
        tokenizers already on it), every one of those is a cache hit, so
        collapsing N round trips into one is a real, measurable win and
        costs nothing for a board that genuinely is still being measured
        for the first time.

        The one trade-off worth knowing: the grid used to fill in row by
        row as each read landed. One request means one update instead -
        for the common cached case that is strictly faster to look at
        (everything appears almost immediately, rather than ten rows
        trickling in), but a genuinely unmeasured board now shows
        "Measuring..." and then fills in all at once, rather than
        row by row.
    */
    useEffect(() => {

        const names = boardNames ? boardNames.split("\n") : [];

        /* Nothing to read. What is already stored can stay: the grid only
           ever draws the rows the board currently has, and keeping a
           measurement means a tokenizer added back is instant. */
        if (names.length === 0) {
            return;
        }

        const controller = new AbortController();

        async function readEveryTokenizer() {

            try {

                const { metrics: perTokenizer, errors } = await getMetricsBulk(
                    names,
                    controller.signal
                );

                const nextEntries = {};
                const nextErrors = {};

                for (const name of names) {

                    const perLanguage = perTokenizer?.[name];

                    if (!perLanguage) {
                        /* Reported in `errors` by the backend, or simply
                           missing - either way this row failed, not the
                           whole grid. Keep the reason so the grid can
                           show it instead of a blank row with no
                           explanation. */
                        nextEntries[name] = { cells: {}, mean: NaN };

                        if (errors?.[name]) {
                            nextErrors[name] = errors[name];
                        }

                        continue;
                    }

                    const cells = {};
                    let total = 0;
                    let counted = 0;

                    Object.keys(perLanguage).forEach((language) => {

                        const premium = Number(
                            perLanguage[language]?.token_premium
                        );

                        if (!Number.isFinite(premium)) {
                            return;
                        }

                        cells[language] = premium;

                        /* English is the yardstick, so averaging it in
                           would flatter every tokenizer by the same 1.0. */
                        if (language !== BASELINE_LANGUAGE) {
                            total += premium;
                            counted += 1;
                        }
                    });

                    nextEntries[name] = {
                        cells: cells,
                        mean: counted ? total / counted : NaN,
                    };
                }

                setMatrix((previous) => ({
                    ...previous,
                    ...nextEntries,
                }));

                /* Clear this round's names first, then apply this round's
                   errors - so a tokenizer that failed last time and loads
                   fine now drops its old reason instead of carrying it
                   forever. Still logged too, for anyone with the console
                   open mid-development. */
                setMatrixErrors((previous) => {

                    const updated = { ...previous };

                    for (const name of names) {
                        delete updated[name];
                    }

                    return { ...updated, ...nextErrors };

                });

                if (errors && Object.keys(errors).length > 0) {
                    /* One tokenizer failing costs one row, not the grid. */
                    console.warn(
                        "Could not read per-language metrics for",
                        errors
                    );
                }

            }
            catch (error) {

                /* Leaving the page aborts the request in flight. Chrome
                   reports that as a plain TypeError rather than an
                   AbortError, so check the signal too - otherwise every
                   navigation away logs a warning about nothing. */
                if (error.name === "AbortError" || controller.signal.aborted) {
                    return;
                }

                console.warn(
                    "Could not read per-language metrics",
                    error
                );
            }
        }

        readEveryTokenizer();

        return () => controller.abort();

    }, [boardNames, setMatrix]);

    /* The grid's rows, in the board's own order - two different orders on
       one page would only invite the reader to reconcile them. */
    /* Follows whatever the board is showing. Searching the table and
       leaving the grid on all ten rows reads as the grid ignoring you. */
    const matrixRows = useMemo(() => (
        visible.map((row) => ({
            id: row.name,
            name: String(row.name).split("/").pop(),
            cells: matrix[row.name]?.cells || null,
            mean: matrix[row.name]?.mean,
            error: matrixErrors[row.name] || null,
        }))
    ), [visible, matrix, matrixErrors]);

    const matrixLoaded = useMemo(() => (
        visible.filter((row) => matrix[row.name]).length
    ), [visible, matrix]);

    const weightSentence = weights
        ? Object.entries(weights)
            .sort((a, b) => b[1] - a[1])
            .map(([key, weight]) => (
                `${COMPONENT_LABELS[key] || key} ` +
                `${Math.round(weight * 100)}%`
            ))
            .join(", ")
        : "";

    return (
        <div className="rank">

            {/* ---------------- HERO ---------------- */}

            <section className="rank-hero">

                <div className="rank-hero-copy">

                    <h1 className="rank-title">
                        Which tokenizer{" "}
                        <span className="rank-title-accent">
                            understands
                        </span>{" "}
                        Mzansi best?
                    </h1>

                    <p className="rank-lede">
                        A scoreboard for the models that sit between{" "}
                        <strong>your words and the machine</strong>. Every
                        tokenizer here is measured on the same FLORES
                        sentences in all eight languages and the same NCHLT
                        segmentations, then scored out of 100 - so the rows
                        can be read against each other.
                    </p>
                </div>
            </section>

            {/* ---------------- CONTROLS ---------------- */}

            <section className="rank-controls" aria-label="Board controls">

                <label className="rank-control">

                    <span className="rank-control-label">
                        rank by
                    </span>

                    <select
                        value={sortKey}
                        onChange={(event) => setSortKey(event.target.value)}
                    >
                        {SORT_OPTIONS.map((option) => (
                            <option key={option.key} value={option.key}>
                                {option.label}
                            </option>
                        ))}
                    </select>

                </label>

                <label className="rank-control">

                    <span className="visually-hidden">
                        Order
                    </span>

                    <select
                        value={bestFirst ? "best" : "worst"}
                        onChange={(event) =>
                            setBestFirst(event.target.value === "best")
                        }
                    >
                        <option value="best">Best first</option>
                        <option value="worst">Worst first</option>
                    </select>

                </label>

                <div className="rank-controls-right">

                    <div className="rank-find">

                        <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            className="rank-find-icon"
                        >
                            <circle cx="11" cy="11" r="7" />
                            <path d="M16.5 16.5 21 21" />
                        </svg>

                        <input
                            type="text"
                            value={filter}
                            onChange={(event) =>
                                setFilter(event.target.value)
                            }
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    handleAdd();
                                }
                            }}
                            placeholder="Find a tokenizer..."
                            aria-label="Find a tokenizer"
                            disabled={adding || bootstrapping}
                        />

                    </div>

                    <button
                        type="button"
                        className="rank-add-cta"
                        onClick={() => handleAdd()}
                        disabled={
                            busy ||
                            isLoading ||
                            bootstrapping ||
                            !filter.trim()
                        }
                    >
                        <span aria-hidden="true">+</span>
                        {adding ? "Adding..." : "Add tokenizer"}
                    </button>

                </div>

                {addStatus && (
                    <div
                        className={`selection-status ${
                            addFailed
                                ? "is-error"
                                : (busy || isLoading || bootstrapping)
                                    ? "is-loading"
                                    : addPartial
                                        ? "is-partial"
                                        : "is-ready"
                        }`}
                    >
                        {/*
                            isLoading belongs here as much as busy does.
                            Without it the first load drew a green dot and
                            no spinner beside "Restoring...", so the line
                            looked finished the whole time it was working.
                        */}
                        {(busy || isLoading || bootstrapping)
                            ? <span className="spinner"></span>
                            : <span className="status-dot"></span>}
                        <StatusMessage
                            text={addStatus}
                            failed={addFailed}
                            modelName={addedName}
                        />
                    </div>
                )}

                {/*
                    The board failed to load entirely - under "rank by
                    Overall score" with everything else this bar
                    reports, not down where the (now empty) board
                    itself sits.
                */}
                {errorMessage && (
                    <StatusLine state="error" text={errorMessage} />
                )}

            </section>

            {/* ---------------- SPOTLIGHT ---------------- */}

            {leader && !errorMessage && (

                <section className="rank-spotlight">

                    <article className="rank-leader">

                        <div className="rank-leader-top">

                            <span className="rank-leader-badge">
                                <span
                                    className="rank-leader-badge-icon"
                                    aria-hidden="true"
                                >
                                    {IconTrophy}
                                </span>
                                Current leader
                            </span>

                            <span className="rank-leader-meta">
                                rank 01 / overall score
                            </span>

                        </div>

                        <h2 className="rank-leader-name">
                            {String(leader.name).split("/").pop()}
                        </h2>

                        <p className="rank-leader-vendor">
                            {vendor(leader.name)}
                        </p>

                        <div className="rank-leader-figures">

                            <div className="rank-leader-score">

                                <span className="rank-leader-score-value">
                                    {typeof leader.overall_score === "number"
                                        ? leader.overall_score.toFixed(1)
                                        : "—"}
                                </span>

                                <span className="rank-leader-score-note">
                                    out of 100
                                </span>

                            </div>

                            <dl className="rank-leader-stats">

                                <div>
                                    <dt>compression</dt>
                                    <dd>
                                        {typeof leader.compression === "number"
                                            ? `${leader.compression.toFixed(2)}×`
                                            : "—"}
                                    </dd>
                                </div>

                                <div>
                                    <dt>fertility</dt>
                                    <dd>
                                        {typeof leader.fertility === "number"
                                            ? leader.fertility.toFixed(2)
                                            : "—"}
                                    </dd>
                                </div>

                                <div>
                                    <dt>premium</dt>
                                    <dd>
                                        {typeof leader.token_premium === "number"
                                            ? `${leader.token_premium.toFixed(2)}×`
                                            : "—"}
                                    </dd>
                                </div>

                            </dl>

                        </div>

                    </article>

                    <article className="rank-close">

                        <div className="rank-close-head">

                            <h2>Close at the top</h2>

                            <span
                                className="rank-close-icon"
                                aria-hidden="true"
                            >
                                {IconEfficiency}
                            </span>

                        </div>

                        <p className="rank-close-sub">
                            Small gaps, meaningful differences. The front
                            {" "}{chasing.length} on this run.
                        </p>

                        <ul className="rank-close-list">

                            {chasing.map((row) => (

                                <li key={row.id}>

                                    <span className="rank-close-name">
                                        {String(row.name).split("/").pop()}
                                    </span>

                                    <span className="rank-close-track">
                                        <span
                                            className="rank-close-fill"
                                            style={{
                                                width: `${Math.max(
                                                    0,
                                                    Math.min(
                                                        100,
                                                        row.overall_score || 0
                                                    )
                                                )}%`,
                                                background:
                                                    identityColour(row.name)
                                            }}
                                        ></span>
                                    </span>

                                    <span className="rank-close-value">
                                        {typeof row.overall_score === "number"
                                            ? row.overall_score.toFixed(1)
                                            : "—"}
                                    </span>

                                </li>

                            ))}

                        </ul>

                        <p className="rank-close-foot">
                            <span className="status-dot"></span>
                            Bars run from 0 to 100, not from the leader, so
                            a close board looks close.
                        </p>

                    </article>

                </section>

            )}

            {/* ---------------- THE BOARD ---------------- */}

            <section
                className={"rank-board" + (adding ? " is-busy" : "")}
                aria-busy={adding}
            >

                {adding && (
                    <div className="block-overlay">
                        <span className="spinner is-big"></span>
                        <span className="block-overlay-text">
                            {addStatus}
                        </span>
                    </div>
                )}

                <header className="rank-board-head">

                    <div>
                        <h2>The leaderboard</h2>

                        <p>
                            Measured on the same corpus, with the same
                            formula, every time. Click any column to rank
                            by it; click it again to flip, and a third time
                            to hand the order back to the control above.
                        </p>
                    </div>

                    <div className="rank-board-tools">

                        {/* "00 tokenizers" while the search was hiding
                            every row read exactly like an empty board.
                            Saying "of 15" makes it plain the rows are
                            hidden by the search, not gone. */}
                        <p className="rank-board-count">
                            <strong>
                                {String(visible.length).padStart(2, "0")}
                            </strong>
                            {visible.length !== board.length && (
                                <> of {String(board.length).padStart(2, "0")}</>
                            )}
                            {" "}tokenizers &middot; sorted by{" "}
                            {sortSpec.label.toLowerCase()}
                        </p>

                        {/* Every column sorts on click. These three are
                            folded away by default only because nine numeric
                            columns on one row is a table people scan past
                            rather than read. */}
                        <button
                            type="button"
                            className="rank-metrics-toggle"
                            onClick={() =>
                                setShowAllMetrics((open) => !open)
                            }
                            aria-pressed={showAllMetrics}
                        >
                            {showAllMetrics
                                ? "Key metrics"
                                : "All metrics"}
                        </button>

                    </div>

                </header>

                <LeaderboardTable
                    rows={visible}
                    isLoading={isLoading}
                    errorMessage={errorMessage}
                    onRemove={handleRemove}
                    removingId={removingId}
                    disabled={adding || bootstrapping}
                    showAllMetrics={showAllMetrics}
                    colourFor={identityColour}
                    initialsFor={initials}
                    vendorFor={vendor}
                    emptyBecauseFiltered={
                        Boolean(filter.trim()) && board.length > 0
                    }
                />

            </section>

            {/* ---------------- THE LEADER, LANGUAGE BY LANGUAGE ---- */}

            {leader && breakdown.length > 0 && (

                <section className="rank-breakdown">

                    <header className="rank-breakdown-head">

                        <div>
                            <h2>
                                Where{" "}
                                {String(leader.name).split("/").pop()}
                                {" "}struggles
                            </h2>

                            <p>
                                What each language costs next to the same
                                sentence in English. 1.00&times; would be
                                parity; longer is worse.
                            </p>
                        </div>

                        <p className="rank-breakdown-count">
                            {breakdownLoading
                                ? <span className="spinner"></span>
                                : `${breakdown.length} languages`}
                        </p>

                    </header>

                    <ul className="rank-breakdown-list">

                        {breakdown.map((row) => (

                            <li key={row.language}>

                                <span className="rank-breakdown-name">
                                    {row.language}
                                </span>

                                <span className="rank-breakdown-track">
                                    <span
                                        className="rank-breakdown-fill"
                                        style={{
                                            width: `${Math.max(
                                                2,
                                                Math.min(
                                                    100,
                                                    (row.premium /
                                                        BREAKDOWN_CEILING) * 100
                                                )
                                            )}%`
                                        }}
                                    ></span>
                                </span>

                                <span className="rank-breakdown-value">
                                    {row.premium.toFixed(2)}&times;
                                </span>

                            </li>

                        ))}

                    </ul>

                    <p className="rank-breakdown-foot">
                        <span className="status-dot"></span>

                        <span>
                            Every bar is measured on the same FLORES
                            sentences, so the differences are the language
                            and the tokenizer, not the text.
                        </span>
                    </p>

                </section>

            )}

            {/* The whole board at once, not just the leader. */}

            {!errorMessage && (
                <LanguageHeatmap
                    languages={floresLanguages}
                    rows={matrixRows}
                    loadedCount={matrixLoaded}
                    total={matrixRows.length}
                />
            )}

            <footer className="rank-footer">

                <span>
                    MzansiToken &middot; built for curious language people
                </span>

                {weightSentence && (
                    <span className="rank-footer-note">
                        Score weighted {weightSentence}, each part against a
                        fixed scale
                    </span>
                )}

            </footer>

        </div>
    );
}

export default Rank;