/*
    MetricCards.jsx
    Author: Mukovhe Ranwashe (RNWMUK001)
    Date: 17 September 2026
*/

/*
    A value of null is not a zero. A tokenizer with no English baseline has
    no premium, and a language with no NCHLT entry has no MBI - both should
    read "N/A" rather than "0.00", which would be a claim we cannot make.
*/

function figure(value, decimals = 2) {
    if (value === null || value === undefined) {
        return "N/A";
    }

    const number = Number(value);

    if (Number.isNaN(number)) {
        return "N/A";
    }

    return number.toFixed(decimals);
}

function Card({ name, value }) {
    return (
        <div className="metric-card">
            <span className="metric-name">
                {name}
            </span>

            <span className="metric-value">
                {value}
            </span>
        </div>
    );
}

/*
    metrics - { tokens, fertility, compression, token_premium }

    mbi - {
        precision,
        recall,
        f1,
        aligned_boundaries,
        total_gold_boundaries
    }

    showMbi - whether this language has NCHLT segmentations at all.
              English does not, so its row is left off entirely rather
              than shown as three N/As.
*/

function MetricCards({
    metrics,
    mbi,
    showMbi = false,
    alignmentLabel = "Morpheme Boundary Alignment",
    alignmentAsPercentage = false
}) {

    /*
        An uploaded file is measured against itself and nothing else, so it
        has no premium at all - both premium formulas divide by a FLORES
        English figure, and the user's file is not a translation of that
        corpus.

        The card is left out rather than shown as N/A. A metric that cannot
        exist for this input is not a missing value to be filled in later;
        printing a placeholder for it invites the reader to treat it as one.
        The row simply has three cards.
    */
    const isStandalone =
        metrics?.token_premium_basis === "standalone";

    let alignmentValue = "N/A";

    if (
        mbi?.aligned_boundaries !== null &&
        mbi?.aligned_boundaries !== undefined &&
        mbi?.total_gold_boundaries !== null &&
        mbi?.total_gold_boundaries !== undefined
    ) {
        if (alignmentAsPercentage) {
            const totalBoundaries = Number(mbi.total_gold_boundaries);
            const alignedBoundaries = Number(mbi.aligned_boundaries);

            alignmentValue = totalBoundaries > 0
                ? `${((alignedBoundaries / totalBoundaries) * 100).toFixed(1)}%`
                : "N/A";
        } else {
            alignmentValue =
                `${Number(mbi.aligned_boundaries).toLocaleString()} / ` +
                `${Number(mbi.total_gold_boundaries).toLocaleString()}`;
        }
    }

    return (
        <div className="tokenization-metrics">

            {/* Efficiency, from the FLORES corpus */}

            <div className="metric-row">

                <Card
                    name="Tokens"
                    value={Number(
                        metrics?.tokens ?? 0
                    ).toLocaleString()}
                />

                <Card
                    name="Fertility"
                    value={figure(metrics?.fertility ?? 0)}
                />

                <Card
                    name="Compression"
                    value={figure(metrics?.compression ?? 0)}
                />

                {!isStandalone && (
                    <Card
                        name="Token Premium"
                        value={figure(metrics?.token_premium)}
                    />
                )}

            </div>

            {isStandalone && (
                <p className="metric-note">
                    Measured on this file alone.
                </p>
            )}

            {/* Morphology, from the NCHLT gold segmentations */}

            {showMbi && (
                <div className="metric-row metric-row-centered">

                    <Card
                        name="Precision"
                        value={figure(mbi?.precision)}
                    />

                    <Card
                        name="F1"
                        value={figure(mbi?.f1)}
                    />

                    <Card
                        name="Recall"
                        value={figure(mbi?.recall)}
                    />

                    <Card
                        name={alignmentLabel}
                        value={alignmentValue}
                    />

                </div>
            )}

        </div>
    );
}

export default MetricCards;
