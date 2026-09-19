/*
    Reusable Type Anything component
    Author: Madzibandila Charmain

    Amended by Mukovhe Ranwashe (RNWMUK001): renders the shared TokenStream
    instead of taking a render function as a prop, and stops typing at the
    server's character limit instead of letting the request fail.
*/

import TokenStream from "./TokenStream";
import StatusLine from "./StatusLine";
import { capState } from "../lib/statusState";

function TypeAnything({
    inputText,
    onInputChange,
    results,
    maxChars = null
}) {

    const used = inputText.length;
    const full = maxChars !== null && used >= maxChars;

    return (
        <section className="text-input-box">

            {/* Type Anything heading */}
            <div className="text-input-heading">
                Type Anything
            </div>

            {/* maxLength does the stopping; the count just shows where you are. */}
            <textarea
                className="text-input-area"
                value={inputText}
                onChange={(event) =>
                    onInputChange(event.target.value)
                }
                placeholder="Type or paste your text here..."
                maxLength={maxChars ?? undefined}
                aria-describedby={maxChars ? "typed-count" : undefined}
            />

            {maxChars !== null && (
                <StatusLine
                    state={capState(used, maxChars)}
                    text={
                        full
                            ? `That is the most we can take - ${maxChars.toLocaleString()} characters.`
                            : `${used.toLocaleString()} of ${maxChars.toLocaleString()} characters`
                    }
                />
            )}

            {/* Tokenizer results */}
            <div
                className={
                    results.length > 1
                        ? "compare-typed-results"
                        : ""
                }
            >

                {results.map((result, index) => (

                    <div
                        className={
                            results.length > 1
                                ? "compare-typed-result-panel"
                                : ""
                        }
                        key={result.id || index}
                    >

                        <div className="typed-tokenization-result">

                            {/* Tokenizer name - Compare only */}
                            {result.title && (
                                <div
                                    className={
                                        "compare-typed-panel-heading "
                                        + (
                                            index === 0
                                                ? "tokenizer-one-heading"
                                                : "tokenizer-two-heading"
                                        )
                                    }
                                >
                                    <span className="tokenizer-colour-dot"></span>
                                    {result.title}
                                </div>
                            )}

                            {/* Tokenized text */}
                            <div className="typed-result-text">
                                <TokenStream tokens={result.tokens} />
                            </div>

                            {/* Metrics */}
                            <div className="typed-tokenization-metrics">

                                <div className="typed-metric-card">
                                    <span className="typed-metric-name">
                                        Tokens
                                    </span>

                                    <span className="typed-metric-value">
                                        {result.metrics?.tokens ?? 0}
                                    </span>
                                </div>

                                <div className="typed-metric-card">
                                    <span className="typed-metric-name">
                                        Fertility
                                    </span>

                                    <span className="typed-metric-value">
                                        {Number(
                                            result.metrics?.fertility ?? 0
                                        ).toFixed(2)}
                                    </span>
                                </div>

                                <div className="typed-metric-card">
                                    <span className="typed-metric-name">
                                        Compression
                                    </span>

                                    <span className="typed-metric-value">
                                        {Number(
                                            result.metrics?.compression ?? 0
                                        ).toFixed(2)}
                                    </span>
                                </div>

                            </div>

                        </div>

                    </div>

                ))}

            </div>

        </section>
    );
}

export default TypeAnything;