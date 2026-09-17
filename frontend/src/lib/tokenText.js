/*
    tokenText.js
    Author: Mukovhe Ranwashe (RNWMUK001)
    Date: 17 September 2026

    Everything about turning what the backend sends back into something a
    person can read. No React in this file, so it can be unit tested on its
    own and imported by any page without dragging a component along.

    Inspect and Compare each carried their own copy of all of this. The two
    copies had already started to drift, which is exactly the problem: a fix
    applied to one page silently did not reach the other.
*/

/*
    The three markers a tokenizer uses to say "a new word starts here".

      G-with-dot (U+0120)  GPT-2 and other byte-level BPE vocabularies
      lower one eighth block (U+2581)  SentencePiece
      ##  WordPiece, which marks CONTINUATION rather than a new word

    They are written as escapes rather than pasted in, because the first two
    are invisible in most editors and get eaten by a careless copy-paste.
*/
export const GPT2_SPACE = "Ġ";
export const SENTENCEPIECE_SPACE = "▁";
export const WORDPIECE_PREFIX = "##";

/*
    Strip the marker and say whether this token begins a word.

    Returns { text, newWord } rather than a bare string, because the caller
    needs both: the text to print, and the flag that decides whether a space
    is drawn in front of it.
*/
export function readable(token) {

    const value = String(token ?? "");

    if (
        value.startsWith(GPT2_SPACE) ||
        value.startsWith(SENTENCEPIECE_SPACE)
    ) {
        return {
            text: value.slice(1),
            newWord: true
        };
    }

    if (value.startsWith(WORDPIECE_PREFIX)) {
        return {
            text: value.slice(WORDPIECE_PREFIX.length),
            newWord: false
        };
    }

    return {
        text: value,
        newWord: false
    };
}

/*
    Normalise whatever the backend sent into one shape: a list of sentences,
    each a list of tokens.

    The endpoints are not consistent - some return the tokens already nested,
    some return one long string - so every caller would otherwise have to
    guess. Anything unrecognisable becomes an empty list rather than throwing,
    because a malformed reply should show an empty panel, not crash the page.
*/
export function formatTokenizedText(tokenizedText) {

    if (!tokenizedText) {
        return [];
    }

    if (Array.isArray(tokenizedText)) {
        return tokenizedText;
    }

    if (typeof tokenizedText === "string") {

        return tokenizedText
            .split(/\n+/)
            .map((sentence) =>
                sentence
                    .split(/\s+/)
                    .filter(Boolean)
            )
            .filter(
                (sentence) => sentence.length > 0
            );
    }

    return [];
}

/*
    Both pages cap how much of a corpus they draw at once. The number lived
    as a bare 10 in two different slice() calls, so it is named here.
*/
export const MAX_VISIBLE_SENTENCES = 10;