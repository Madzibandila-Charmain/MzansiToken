/*
    tokenText.test.js
    Author: Mukovhe Ranwashe (RNWMUK001)
    Date: 17 September 2026

    These are the cases that used to be duplicated in two pages with no test
    under either copy. Pulling the functions into lib/ is what made them
    testable at all - a page component cannot be checked this cheaply.

    Run with:  npm run test:run
*/

import { describe, it, expect } from "vitest";

import {
    readable,
    formatTokenizedText,
    GPT2_SPACE,
    SENTENCEPIECE_SPACE,
    WORDPIECE_PREFIX,
    MAX_VISIBLE_SENTENCES
} from "./tokenText";

describe("readable", () => {

    it("strips the GPT-2 byte-level marker and reports a new word", () => {

        expect(readable(`${GPT2_SPACE}Ngiyabonga`)).toEqual({
            text: "Ngiyabonga",
            newWord: true
        });
    });

    it("strips the SentencePiece marker and reports a new word", () => {

        expect(readable(`${SENTENCEPIECE_SPACE}kakhulu`)).toEqual({
            text: "kakhulu",
            newWord: true
        });
    });

    it("strips the WordPiece prefix and reports a CONTINUATION", () => {

        /* ## means the opposite of the other two - it continues a word. */
        expect(readable(`${WORDPIECE_PREFIX}nge`)).toEqual({
            text: "nge",
            newWord: false
        });
    });

    it("leaves an unmarked token alone", () => {

        expect(readable("ya")).toEqual({ text: "ya", newWord: false });
    });

    it("does not throw on a non-string token", () => {

        expect(readable(null)).toEqual({ text: "", newWord: false });
        expect(readable(42)).toEqual({ text: "42", newWord: false });
    });
});

describe("formatTokenizedText", () => {

    it("passes an already-nested list through untouched", () => {

        const nested = [["a", "b"], ["c"]];

        expect(formatTokenizedText(nested)).toBe(nested);
    });

    it("splits a plain string into sentences of tokens", () => {

        expect(formatTokenizedText("one two\nthree")).toEqual([
            ["one", "two"],
            ["three"]
        ]);
    });

    it("drops blank lines and runs of whitespace", () => {

        expect(formatTokenizedText("one  two\n\n\nthree ")).toEqual([
            ["one", "two"],
            ["three"]
        ]);
    });

    it("returns an empty list for anything unusable", () => {

        /* A malformed reply must show an empty panel, never crash a page. */
        expect(formatTokenizedText(null)).toEqual([]);
        expect(formatTokenizedText(undefined)).toEqual([]);
        expect(formatTokenizedText("")).toEqual([]);
        expect(formatTokenizedText(7)).toEqual([]);
        expect(formatTokenizedText({ tokens: ["a"] })).toEqual([]);
    });
});

describe("the markers themselves", () => {

    it("are the code points the tokenizers actually emit", () => {

        /* Written as escapes because both are invisible in an editor and
           are easily lost to a copy-paste. */
        expect(GPT2_SPACE.codePointAt(0)).toBe(0x0120);
        expect(SENTENCEPIECE_SPACE.codePointAt(0)).toBe(0x2581);
        expect(WORDPIECE_PREFIX).toBe("##");
    });

    it("caps how many sentences a panel draws", () => {

        expect(MAX_VISIBLE_SENTENCES).toBe(10);
    });
});