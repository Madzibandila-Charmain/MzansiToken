/*
    TokenStream.jsx
    Author: Mukovhe Ranwashe (RNWMUK001)
    Date: 17 September 2026

    Draws a tokenized corpus as coloured pills, one row per sentence.

    This was a renderTokens() function written out twice - once in Inspect
    and once in Compare - and the two copies had already drifted: one of them
    passed a raw token to the title attribute, which React warns about when
    the token is not a string. That is the whole argument for this file.

    TokenizationMetrics used to take renderTokens as a PROP, which only made
    sense while the function lived inside a page. It renders this instead.
*/

import {
    readable,
    formatTokenizedText,
    MAX_VISIBLE_SENTENCES
} from "../lib/tokenText";

/* How many pill colours the stylesheet defines. */
const PILL_COLOURS = 8;

function TokenStream({
    tokens,
    empty = "Your tokenized text will appear here.",
    limit = MAX_VISIBLE_SENTENCES
}) {

    /*
        Accept either shape the backend uses - a flat list of tokens, or a
        list of sentences - so no caller has to normalise first.
    */
    const normalised = formatTokenizedText(tokens);

    if (normalised.length === 0) {
        return (
            <span className="token-empty">
                {empty}
            </span>
        );
    }

    const sentences = Array.isArray(normalised[0])
        ? normalised
        : [normalised];

    const visibleSentences = sentences.slice(0, limit);

    return (
        <>
            {visibleSentences.map((sentence, sentenceIndex) => (

                <div
                    key={`sentence-${sentenceIndex}`}
                    className="token-sentence"
                >

                    {sentence.map((token, tokenIndex) => {

                        const colourIndex = tokenIndex % PILL_COLOURS;

                        /*
                            A token can arrive as an array of byte pieces,
                            so it is joined before it is read.
                        */
                        const raw = Array.isArray(token)
                            ? token.join("")
                            : String(token);

                        const { text, newWord } = readable(raw);

                        return (
                            <span
                                key={`${sentenceIndex}-${tokenIndex}-${raw}`}
                                className={
                                    `token-pill token-colour-${colourIndex}`
                                    + (newWord ? " token-new-word" : "")
                                }
                                title={raw}
                            >
                                {text}
                            </span>
                        );
                    })}

                </div>

            ))}
        </>
    );
}

export default TokenStream;