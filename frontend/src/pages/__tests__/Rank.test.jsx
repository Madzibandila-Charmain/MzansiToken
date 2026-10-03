/*
    Rank.test.jsx
    Author: Mukovhe Ranwashe
*/

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

import Rank from "../Rank";
import { AppStateProvider } from "../../context/appStateContext.js";

vi.mock("../../api/client", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getOptions: vi.fn(),
        getScoring: vi.fn(),
        getTokenizerInfo: vi.fn(),
        getSavedLeaderboardEntry: vi.fn(),
        createOrUpdateLeaderboardEntry: vi.fn(),
        restoreLeaderboardEntry: vi.fn(),
        deleteLeaderboardEntry: vi.fn(),
        getLeaderboard: vi.fn(),
        getMetrics: vi.fn(),
        getMetricsBulk: vi.fn(),
    };
});

import {
    ApiError,
    getOptions,
    getScoring,
    getTokenizerInfo,
    getSavedLeaderboardEntry,
    createOrUpdateLeaderboardEntry,
    restoreLeaderboardEntry,
    deleteLeaderboardEntry,
    getLeaderboard,
    getMetrics,
    getMetricsBulk,
} from "../../api/client";

function renderRank() {
    return render(
        <AppStateProvider>
            <Rank />
        </AppStateProvider>
    );
}

/*
    A fully-measured saved entry, for the restore path. Every field
    hasCompleteLeaderboardMetrics checks for, present and finite.
*/
function makeSavedEntry(overrides = {}) {
    return {
        token_count: 12000,
        fertility: 1.2,
        compression: 0.6,
        token_premium: 1.3,
        f1: 0.6,
        precision: 0.55,
        recall: 0.5,
        ...overrides,
    };
}

function makeRow(overrides = {}) {
    return {
        id: 1,
        name: "openai/gpt-4o",
        overall_score: 80,
        token_count: 12000,
        compression: 0.6,
        fertility: 1.2,
        token_premium: 1.3,
        f1: 0.6,
        precision: 0.55,
        recall: 0.5,
        ...overrides,
    };
}

/* Only the leaderboard table itself - not the spotlight's "Close at
   the top" list or the per-language heatmap, which repeat the same
   row names and would otherwise make every text query ambiguous. */
function leaderboardRows() {
    return within(document.querySelector(".rank-board"));
}

function leaderName() {
    return document.querySelector(".rank-leader-name")?.textContent;
}

/*
    Lets a test control what the NEXT getLeaderboard() call returns,
    without having to know how many times Rank has already called it
    (once on mount, again after every add/remove).
*/
let board = [];

function setBoard(rows) {
    board = rows;
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    board = [];

    getOptions.mockResolvedValue({ languages: ["English", "isiZulu"] });
    getScoring.mockResolvedValue({ weights: null });

    /* Every INITIAL_TOKENIZERS name counts as already measured by
       default, so a plain render restores instead of measuring - the
       cheap, common case, and it means getTokenizerInfo only has to
       be mocked by tests that actually exercise the "new tokenizer"
       path through handleAdd. */
    getSavedLeaderboardEntry.mockImplementation(async () => makeSavedEntry());
    getTokenizerInfo.mockResolvedValue({});
    createOrUpdateLeaderboardEntry.mockResolvedValue({
        metrics: {
            languages_measured: 8,
            morphology_measured: 7,
            failed_languages: [],
        },
    });
    restoreLeaderboardEntry.mockResolvedValue({});
    deleteLeaderboardEntry.mockResolvedValue({});

    getLeaderboard.mockImplementation(async () => board);

    getMetrics.mockResolvedValue({});
    getMetricsBulk.mockResolvedValue({ metrics: {}, errors: {} });
});

describe("Rank - initial load", () => {

    it("restores the starter board and shows the current leader", async () => {

        setBoard([
            makeRow({ id: 1, name: "openai/gpt-4o", overall_score: 91.2 }),
            makeRow({ id: 2, name: "google/byt5-small", overall_score: 71.2 }),
        ]);

        renderRank();

        expect(await screen.findByText("Current leader")).toBeInTheDocument();

        /* The leader is whichever row scores highest, not whichever the
           backend listed first - gpt-4o here, not byt5-small. */
        expect(leaderName()).toBe("gpt-4o");

        expect(
            document.querySelector(".rank-board-count").textContent
        ).toMatch(/02\s*tokenizers.*sorted by/i);

        /* describeDefaults("restored 4", "") - all four starters were
           already-measured, so every one of them restored and none
           had to be measured from scratch. */
        expect(
            await screen.findByText("Leaderboard ready — restored 4.")
        ).toBeInTheDocument();

        expect(getTokenizerInfo).not.toHaveBeenCalled();
    });

    it("measures a starter tokenizer that has never been saved before", async () => {

        getSavedLeaderboardEntry.mockImplementation(async (name) => {
            if (name === "gpt2") {
                throw new ApiError("Not found", 404, null);
            }
            return makeSavedEntry();
        });

        setBoard([makeRow()]);

        renderRank();

        expect(
            await screen.findByText("Leaderboard ready — restored 3 and measured 1.")
        ).toBeInTheDocument();

        /* gpt2 is the one starter with no saved entry, so it is the
           only one that should have gone through the slow, real
           tokenizer-info check. */
        expect(getTokenizerInfo).toHaveBeenCalledTimes(1);
        expect(getTokenizerInfo).toHaveBeenCalledWith(
            "gpt2",
            expect.anything()
        );
    });

    it("shows a failed initial load as an error, without crashing the page", async () => {

        getOptions.mockRejectedValue(new Error("Failed to fetch"));

        renderRank();

        const alert = await screen.findByRole("alert");

        expect(alert).toHaveTextContent(/cannot reach the backend/i);

        /* errorMessage is for a board that could not load at all - the
           table underneath renders nothing of its own (same contract
           LeaderboardTable.test.jsx checks in isolation), and the
           spotlight is hidden with it. */
        expect(
            document.querySelector(".rank-board").querySelector("table")
        ).not.toBeInTheDocument();
        expect(screen.queryByText("Current leader")).not.toBeInTheDocument();
    });

});

describe("Rank - adding a tokenizer", () => {

    it("measures a brand-new tokenizer and reports what it found", async () => {

        setBoard([makeRow({ id: 1, name: "openai/gpt-4o" })]);

        renderRank();
        await screen.findByText("Current leader");

        getSavedLeaderboardEntry.mockImplementation(async (name) => {
            if (name === "facebook/new-tokenizer") {
                throw new ApiError("Not found", 404, null);
            }
            return makeSavedEntry();
        });

        createOrUpdateLeaderboardEntry.mockResolvedValue({
            metrics: {
                languages_measured: 8,
                morphology_measured: 7,
                failed_languages: [],
            },
        });

        setBoard([
            makeRow({ id: 1, name: "openai/gpt-4o" }),
            makeRow({ id: 2, name: "facebook/new-tokenizer", overall_score: 60 }),
        ]);

        const user = userEvent.setup();

        await user.type(
            screen.getByLabelText("Find a tokenizer"),
            "facebook/new-tokenizer"
        );

        await user.click(screen.getByRole("button", { name: /add tokenizer/i }));

        expect(
            await screen.findByText(
                "facebook/new-tokenizer scored on 8 languages, morphology on 7."
            )
        ).toBeInTheDocument();

        expect(
            await leaderboardRows().findByText("new-tokenizer")
        ).toBeInTheDocument();
    });

    it("marks a partial measurement when morphology fails on some languages", async () => {

        setBoard([makeRow({ id: 1 })]);

        renderRank();
        await screen.findByText("Current leader");

        getSavedLeaderboardEntry.mockImplementation(async (name) => {
            if (name === "some/model") {
                throw new ApiError("Not found", 404, null);
            }
            return makeSavedEntry();
        });

        createOrUpdateLeaderboardEntry.mockResolvedValue({
            metrics: {
                languages_measured: 8,
                morphology_measured: 6,
                failed_languages: [
                    { language: "isiZulu", detail: "no gold segmentations" },
                ],
            },
        });

        const user = userEvent.setup();

        await user.type(screen.getByLabelText("Find a tokenizer"), "some/model");
        await user.click(screen.getByRole("button", { name: /add tokenizer/i }));

        const status = await screen.findByText(
            /some\/model scored on 8 languages, morphology on 6\./
        );

        expect(status).toBeInTheDocument();
        expect(status.textContent).toMatch(
            /Morphology failed on isiZulu: no gold segmentations/
        );

        expect(
            document.querySelector(".selection-status.is-partial")
        ).toBeTruthy();
    });

    it("reports a failed add without wiping the existing board", async () => {

        setBoard([makeRow({ id: 1, name: "openai/gpt-4o" })]);

        renderRank();
        await screen.findByText("Current leader");

        getTokenizerInfo.mockRejectedValue(
            new ApiError(
                "Model 'bad/name' not found on Hugging Face. Check the model " +
                    "name at https://huggingface.co/models",
                400,
                null
            )
        );

        const user = userEvent.setup();

        const findInput = screen.getByLabelText("Find a tokenizer");

        await user.type(findInput, "bad/name");
        await user.click(screen.getByRole("button", { name: /add tokenizer/i }));

        expect(
            await screen.findByText(/model 'bad\/name' not found/i)
        ).toBeInTheDocument();

        expect(
            document.querySelector(".selection-status.is-error")
        ).toBeTruthy();

        /* The board itself never heard about this failure - still
           showing the one row it had before the failed add. The find
           box still holds the failed search text, which filters the
           table down to nothing, so clear it before checking. */
        await user.clear(findInput);

        expect(leaderName()).toBe("gpt-4o");
        expect(
            await leaderboardRows().findByText("gpt-4o")
        ).toBeInTheDocument();
    });

    it("restores a tokenizer that already has a saved measurement, instead of re-measuring it", async () => {

        setBoard([makeRow({ id: 1, name: "openai/gpt-4o" })]);

        renderRank();
        await screen.findByText("Current leader");

        /* Everything up to here (mount) has already called
           createOrUpdateLeaderboardEntry once per starter tokenizer -
           clear that history so the assertions below describe only
           the add this test is actually about. */
        vi.clearAllMocks();
        getLeaderboard.mockImplementation(async () => board);
        getSavedLeaderboardEntry.mockResolvedValue(makeSavedEntry());
        restoreLeaderboardEntry.mockResolvedValue({});

        setBoard([
            makeRow({ id: 1, name: "openai/gpt-4o" }),
            makeRow({ id: 2, name: "google/byt5-small" }),
        ]);

        const user = userEvent.setup();

        await user.type(screen.getByLabelText("Find a tokenizer"), "google/byt5-small");
        await user.click(screen.getByRole("button", { name: /add tokenizer/i }));

        expect(
            await screen.findByText(
                "google/byt5-small restored using its previous measurement."
            )
        ).toBeInTheDocument();

        /* The slow path - a real measurement - must not have run. */
        expect(createOrUpdateLeaderboardEntry).not.toHaveBeenCalled();
        expect(restoreLeaderboardEntry).toHaveBeenCalledWith(
            "google/byt5-small",
            expect.anything()
        );
    });

});

describe("Rank - removing a tokenizer", () => {

    it("removes a row and reloads the board", async () => {

        setBoard([
            makeRow({ id: 1, name: "openai/gpt-4o" }),
            makeRow({ id: 2, name: "google/byt5-small", overall_score: 50 }),
        ]);

        renderRank();
        await screen.findByText("Current leader");

        expect(
            await leaderboardRows().findByText("byt5-small")
        ).toBeInTheDocument();

        setBoard([makeRow({ id: 1, name: "openai/gpt-4o" })]);

        const user = userEvent.setup();

        await user.click(
            screen.getByRole("button", {
                name: "Remove google/byt5-small from the leaderboard",
            })
        );

        expect(
            await screen.findByText("google/byt5-small removed.")
        ).toBeInTheDocument();

        expect(
            leaderboardRows().queryByText("byt5-small")
        ).not.toBeInTheDocument();
        expect(deleteLeaderboardEntry).toHaveBeenCalledWith(2);
    });

    it("reports a failed remove and leaves the row in place", async () => {

        setBoard([makeRow({ id: 1, name: "openai/gpt-4o" })]);

        renderRank();
        await screen.findByText("Current leader");

        deleteLeaderboardEntry.mockRejectedValue(
            new ApiError("Could not reach the database.", 500, null)
        );

        const user = userEvent.setup();

        await user.click(
            screen.getByRole("button", {
                name: "Remove openai/gpt-4o from the leaderboard",
            })
        );

        expect(
            await screen.findByText(/could not reach the database/i)
        ).toBeInTheDocument();

        /* Still there - the delete never went through. */
        expect(leaderName()).toBe("gpt-4o");
    });

});

describe("Rank - sorting and filtering the board", () => {

    it("re-sorts the board when the rank-by control changes", async () => {

        setBoard([
            makeRow({ id: 1, name: "openai/gpt-4o", overall_score: 80, compression: 0.9 }),
            makeRow({ id: 2, name: "google/byt5-small", overall_score: 60, compression: 0.2 }),
        ]);

        renderRank();
        await screen.findByText("Current leader");

        function namesInOrder() {
            return leaderboardRows()
                .getAllByText(/^(gpt-4o|byt5-small)$/)
                .map((node) => node.textContent);
        }

        /* Default: ranked by overall score, best first - gpt-4o leads. */
        expect(namesInOrder()).toEqual(["gpt-4o", "byt5-small"]);

        const user = userEvent.setup();

        /* Switch "best first" to "worst first" on Compression - lower
           compression value (byt5-small, 0.2) should lead over
           gpt-4o's 0.9. */
        await user.selectOptions(screen.getByDisplayValue("Overall score"), "compression");
        await user.selectOptions(screen.getByDisplayValue("Best first"), "worst");

        expect(namesInOrder()).toEqual(["byt5-small", "gpt-4o"]);
    });

    it("filters the board by name and updates the visible count", async () => {

        setBoard([
            makeRow({ id: 1, name: "openai/gpt-4o" }),
            makeRow({ id: 2, name: "google/byt5-small" }),
        ]);

        renderRank();
        await screen.findByText("Current leader");

        const user = userEvent.setup();

        await user.type(screen.getByLabelText("Find a tokenizer"), "byt5");

        expect(leaderboardRows().queryByText("gpt-4o")).not.toBeInTheDocument();
        expect(leaderboardRows().getByText("byt5-small")).toBeInTheDocument();

        expect(
            document.querySelector(".rank-board-count").textContent
        ).toMatch(/01\s*tokenizers.*sorted by/i);
    });

});
