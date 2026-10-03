/*
    Compare.test.jsx
    Author: Mukovhe Ranwashe

    Compare.jsx had no tests before this file, despite code having been
    added to and removed from it twice in one session (the MBI boundary
    preview that came in, then came back out). This covers its most
    load-bearing paths: the initial options + default-corpus load (success
    and failure), changing the corpus language, and the two ways the MBI
    comparison effect can come back empty - "Unsupported language" (the
    wording mbi_router.py and Rank.jsx both also key off of) and any other
    failure - plus swapping one tokenizer through the search box.

    Compare reads its selections (language, the two tokenizers) from
    AppStateContext rather than its own state, so it is rendered inside
    the real AppStateProvider - a hand-built stand-in would just be a
    second copy of that context's rules to keep in sync. Its defaults
    persist to localStorage, so that is cleared before every test.
*/

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";

import Compare from "../Compare";
import { AppStateProvider } from "../../context/appStateContext";

vi.mock("../../api/client", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        getOptions: vi.fn(),
        getDefaultCorpus: vi.fn(),
        uploadCorpus: vi.fn(),
        tokenizeText: vi.fn(),
        compareMBI: vi.fn(),
        getTokenizerInfo: vi.fn(),
    };
});

import {
    ApiError,
    getOptions,
    getDefaultCorpus,
    uploadCorpus,
    tokenizeText,
    compareMBI,
    getTokenizerInfo,
} from "../../api/client";

function renderCompare() {
    return render(
        <AppStateProvider>
            <Compare />
        </AppStateProvider>
    );
}

function corpusLabel() {
    return document.querySelector(".compare-corpus-label")?.textContent;
}

function makeMbiSide(overrides = {}) {
    return {
        metrics: {
            precision: 0.5,
            recall: 0.5,
            f1: 0.5,
            aligned_boundaries: 5,
            total_gold_boundaries: 10,
        },
        words_evaluated: 10,
        ...overrides,
    };
}

function makeCorpusResult(tokenizer) {
    return {
        tokenized_text: `tokens from ${tokenizer}`,
        metrics: {
            token_count: 10,
            fertility: 1.1,
            compression: 0.5,
            token_premium: 1.2,
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    getOptions.mockResolvedValue({
        languages: ["isiZulu", "English"],
        limits: { max_text_chars: 5000, max_upload_mb: 5 },
        defaults: { language: "isiZulu" },
    });

    getDefaultCorpus.mockImplementation(async (language, tokenizer) =>
        makeCorpusResult(tokenizer)
    );

    uploadCorpus.mockImplementation(async (file, tokenizer) =>
        makeCorpusResult(tokenizer)
    );

    tokenizeText.mockImplementation(async (text, language, tokenizer) =>
        makeCorpusResult(tokenizer)
    );

    getTokenizerInfo.mockResolvedValue({});

    compareMBI.mockResolvedValue({
        tokenizer_a: makeMbiSide(),
        tokenizer_b: makeMbiSide(),
    });
});

describe("Compare - initial load", () => {

    it("loads the backend options and the default corpus for both tokenizers", async () => {

        renderCompare();

        /*
            corpusLabel is derived straight from the selection state
            (language + both tokenizer ids), which the OPTIONS effect sets
            as soon as getOptions resolves - before the separate corpus-
            loading effect has actually run and called getDefaultCorpus.
            Under load, React can commit that state (and paint the full
            label) a tick before it flushes the later effect, so waiting
            on the label was waiting on the wrong thing - it occasionally
            resolved while getDefaultCorpus still had zero calls. Wait on
            the calls themselves; the label is a consequence of them
            having gone out, not the other way around.
        */
        await vi.waitFor(() => {
            expect(getDefaultCorpus).toHaveBeenCalledWith("isiZulu", "gpt2");
            expect(getDefaultCorpus).toHaveBeenCalledWith(
                "isiZulu",
                "google/gemma-4-12B-it"
            );
        });

        expect(corpusLabel()).toMatch(
            /Built-in corpus.*isiZulu.*gpt2 vs google\/gemma-4-12B-it/
        );

        const isiZuluPill = screen.getByRole("button", { name: "isiZulu" });
        expect(isiZuluPill.className).toMatch(/is-selected/);

        expect(
            screen.getByRole("button", { name: "English" })
        ).toBeInTheDocument();
    });

    it("shows a failed options load as an error, without crashing the page", async () => {

        getOptions.mockRejectedValue(new Error("Failed to fetch"));

        renderCompare();

        const alert = await screen.findByRole("alert");

        expect(alert).toHaveTextContent(/cannot reach the backend/i);
    });

});

describe("Compare - changing the corpus language", () => {

    it("reloads the corpus for both tokenizers when a new language is picked", async () => {

        renderCompare();

        await vi.waitFor(() => {
            expect(corpusLabel()).toMatch(
                /Built-in corpus.*isiZulu.*gpt2 vs google\/gemma-4-12B-it/
            );
        });

        getDefaultCorpus.mockClear();

        const user = userEvent.setup();

        await user.click(screen.getByRole("button", { name: "English" }));

        await vi.waitFor(() => {
            expect(corpusLabel()).toMatch(
                /Built-in corpus.*English.*gpt2 vs google\/gemma-4-12B-it/
            );
        });

        expect(getDefaultCorpus).toHaveBeenCalledWith("English", "gpt2");

        expect(
            await screen.findByText("English ready.")
        ).toBeInTheDocument();
    });

});

describe("Compare - MBI comparison", () => {

    it("flags a language the NCHLT corpus does not cover, instead of a raw error", async () => {

        compareMBI.mockRejectedValue(
            new ApiError("Unsupported language: isiZulu", 400, null)
        );

        renderCompare();

        const alert = await screen.findByRole("alert");

        expect(alert).toHaveTextContent("isiZulu does not have MBI metrics.");
    });

    it("reports any other MBI failure through the same error line", async () => {

        compareMBI.mockRejectedValue(new Error("Failed to fetch"));

        renderCompare();

        const alert = await screen.findByRole("alert");

        expect(alert.textContent).toMatch(
            /morphology metrics could not be loaded/i
        );
        expect(alert.textContent).toMatch(/cannot reach the backend/i);
    });

});

describe("Compare - swapping a tokenizer", () => {

    it("loads a newly typed tokenizer into slot one against the current language", async () => {

        renderCompare();

        await vi.waitFor(() => {
            expect(corpusLabel()).toMatch(/gpt2 vs/);
        });

        getDefaultCorpus.mockClear();

        const user = userEvent.setup();

        const input = screen.getByLabelText(/tokenizer 1/i, { selector: "input" })
            ?? document.getElementById("compare-tokenizer-one");

        await user.clear(input);
        await user.type(input, "facebook/new-one{Enter}");

        expect(
            await screen.findByText("facebook/new-one ready.")
        ).toBeInTheDocument();

        expect(getTokenizerInfo).toHaveBeenCalledWith("facebook/new-one");
        expect(getDefaultCorpus).toHaveBeenCalledWith(
            "isiZulu",
            "facebook/new-one"
        );

        await vi.waitFor(() => {
            expect(corpusLabel()).toMatch(/facebook\/new-one vs/);
        });
    });

});
