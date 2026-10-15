/*
    useVocabulary.test.jsx
    Author: Mukovhe Ranwashe

    The shared vocabulary request for the chart tabs: one request per
    tokenizer however many charts ask, nothing asked for twice, and a
    failure that can be tried again.
*/

import { renderHook, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../api/client", async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, getVocabulary: vi.fn() };
});

import { getVocabulary } from "../api/client";
import { forgetVocabulary, useVocabulary } from "./useVocabulary";

const ALL = {
    isiZulu: { productivity: 4.2, idiosyncrasy: 1.3 },
    Sesotho: { productivity: 3.1, idiosyncrasy: 1.9 },
    English: { productivity: 9.0, idiosyncrasy: 2.0 },
};

beforeEach(() => {
    vi.clearAllMocks();
    forgetVocabulary();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    getVocabulary.mockResolvedValue(ALL);
});

describe("useVocabulary", () => {

    it("asks for every language at once, and reports the name as waiting until then", async () => {

        const { result } = renderHook(() => useVocabulary(["gpt2"]));

        expect(result.current.loading).toEqual(["gpt2"]);

        await waitFor(() => expect(result.current.loading).toEqual([]));
        expect(result.current.vocabulary.gpt2).toEqual(ALL);
        expect(getVocabulary).toHaveBeenCalledWith("gpt2");
    });

    it("asks once per tokenizer however many ask at the same moment", async () => {

        renderHook(() => useVocabulary(["gpt2", "", null, "gpt2"]));
        renderHook(() => useVocabulary(["gpt2"]));

        await waitFor(() => expect(getVocabulary).toHaveBeenCalledTimes(1));
    });

    it("asks for each tokenizer of a pair", async () => {

        const { result } = renderHook(() => useVocabulary(["gpt2", "xlm-roberta-base"]));

        await waitFor(() => expect(result.current.loading).toEqual([]));
        expect(getVocabulary).toHaveBeenCalledTimes(2);
        expect(Object.keys(result.current.vocabulary)).toEqual(["gpt2", "xlm-roberta-base"]);
    });

    it("hands back an answer it already has without asking again", async () => {

        const first = renderHook(() => useVocabulary(["gpt2"]));
        await waitFor(() => expect(first.result.current.loading).toEqual([]));

        const second = renderHook(() => useVocabulary(["gpt2"]));

        expect(second.result.current.vocabulary.gpt2).toEqual(ALL);
        expect(second.result.current.loading).toEqual([]);
        expect(getVocabulary).toHaveBeenCalledTimes(1);
    });

    it("reports a tokenizer the backend could not answer for, and can try again later", async () => {

        getVocabulary.mockRejectedValueOnce(new Error("Failed to load the vocabulary summary."));

        const { result } = renderHook(() => useVocabulary(["missing/model"]));

        await waitFor(() => expect(result.current.failed).toEqual(["missing/model"]));
        expect(result.current.loading).toEqual([]);

        /* A later visit asks again - a failure is not remembered. */
        const again = renderHook(() => useVocabulary(["missing/model"]));
        await waitFor(() => expect(again.result.current.loading).toEqual([]));
        expect(getVocabulary).toHaveBeenCalledTimes(2);
    });
});
