/*
    Reusable tokenization and metrics display
    Author: Madzibandila Charmain

    Amended by Mukovhe Ranwashe (RNWMUK001), 17 September 2026: the
    renderTokens prop is gone. Passing a render function in was only ever a
    way of reaching the copy of it that lived in the calling page; the shared
    TokenStream component is imported directly.
*/

import TokenStream from "./TokenStream";

import MetricCards from "./MetricCards";

function TokenizationMetrics({
    title,
    tokens,
    metrics,
    mbi,
    showMbi,
    tokenizerSelector,
    tokenizerType,
    busy = false,
    busyLabel = "Loading\u2026"
}) {

    return (
        <div
            className={
                "tokenization-display-block"
                + (busy ? " is-busy" : "")
            }
        >

            {/* Same treatment as the Inspect panels: the numbers stay in
                place and go soft, so nobody reads the previous tokenizer's
                figures as if they belonged to the new one. */}
            {busy && (
                <div className="block-overlay">
                    <span className="spinner"></span>
                    <span className="block-overlay-text">
                        {busyLabel}
                    </span>
                </div>
            )}

            {/* Tokenizer heading */}
            <div
                className={`tokenization-display-heading ${
                    tokenizerType === "1"
                        ? "tokenizer-one-heading"
                        : "tokenizer-two-heading"
                }`}
            >
                <span className="tokenizer-colour-dot"></span>
                <span>{title}</span>
            </div>

            {/* Optional tokenizer selector */}

            {tokenizerSelector}

            {/* Tokenization result */}

            <div className="tokenization-result">

                <div className="tokenization-text">

                    <TokenStream tokens={tokens} />

                </div>

            </div>

            {/* Tokenization metrics */}

            <MetricCards
                metrics={metrics}
                mbi={mbi}
                showMbi={showMbi}
            />

        </div>
    );
}

export default TokenizationMetrics;