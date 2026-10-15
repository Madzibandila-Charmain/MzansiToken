/*
    VocabularySummary.jsx
    Author: Mukovhe Ranwashe (RNWMUK001)

    The note under "All eight languages at once" when the wheel is showing
    one of the research-paper measures - Rényi efficiency, productivity,
    idiosyncrasy or bytes against English. Written from the numbers, like
    the per-word note it stands in for, so it stays true for any tokenizer.

    measure - the key of the measure the wheel is showing.
    data    - { [language]: { [measure]: value } } for that measure.

    Renders nothing for any other measure, or when there is not enough to
    say (fewer than two South African languages with a number). Which
    measures have a note is `ownNote` in lib/measures.js - the wheel and
    this file both read it from there.
*/

import { MEASURES } from "../lib/measures";

const BASELINE = "English";

/* Whichever measures say they have a note of their own. */
const SUMMARISED_MEASURES = MEASURES
    .filter((measure) => measure.ownNote)
    .map((measure) => measure.key);

/* Highest and lowest South African language for one measure. */
function extremes(data, key) {

    const order = Object.keys(data || {})
        .filter((language) => language !== BASELINE)
        .filter((language) => {
            const value = data[language]?.[key];
            return value !== null && value !== undefined && Number.isFinite(Number(value));
        })
        .sort((a, b) => data[b][key] - data[a][key]);

    if (order.length < 2) {
        return null;
    }

    return {
        top: order[0],
        bottom: order[order.length - 1],
        high: Number(data[order[0]][key]),
        low: Number(data[order[order.length - 1]][key]),
    };
}

function sentence(measure, x) {

    switch (measure) {

        case "renyi_efficiency":
            return (
                <>
                    On the wheel <b>{x.top}</b> has the longest petal &mdash;
                    its tokens are spread the most evenly (Rényi{" "}
                    {x.high.toFixed(2)}) &mdash; and <b>{x.bottom}</b> the
                    shortest ({x.low.toFixed(2)}). The papers disagree on
                    whether more even is better, so neither end is a win.
                </>
            );

        case "productivity":
            return (
                <>
                    <b>{x.top}</b>&rsquo;s subwords are the most reused &mdash;
                    each turns up in {x.high.toFixed(1)} different words on
                    average &mdash; and <b>{x.bottom}</b>&rsquo;s the least
                    ({x.low.toFixed(1)}). A high number means a few pieces,
                    like a prefix, doing work across many words. It describes
                    the tokenizer; it does not score it.
                </>
            );

        case "idiosyncrasy":
            return (
                <>
                    <b>{x.top}</b>&rsquo;s subwords sit in the most common
                    words ({x.high.toFixed(1)} on average) and{" "}
                    <b>{x.bottom}</b>&rsquo;s in the rarest
                    ({x.low.toFixed(1)}). A high number means subwords tied to
                    a few words that come up again and again.
                </>
            );

        case "byte_premium":
            return (
                <>
                    Before any tokenizer splits them, <b>{x.top}</b>&rsquo;s
                    sentences take the most bytes ({x.high.toFixed(2)}&times;
                    English) and <b>{x.bottom}</b>&rsquo;s the fewest
                    ({x.low.toFixed(2)}&times;). Every tokenizer sees the same
                    bytes, so this wheel looks the same whichever one you pick.
                </>
            );

        default:
            return null;
    }
}

function VocabularySummary({ measure, data }) {

    if (!SUMMARISED_MEASURES.includes(measure)) {
        return null;
    }

    const x = extremes(data, measure);

    if (!x) {
        return null;
    }

    return (
        <p className="chart-note">
            {sentence(measure, x)}
        </p>
    );
}

export default VocabularySummary;
