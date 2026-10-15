/*
    MetricCards.jsx
    Author: Mukovhe Ranwashe (RNWMUK001)
    Date: 17 September 2026
*/

/*
    Turns a number into card text. Nothing to show prints as a zero, so the
    row keeps the same shape instead of breaking into letters mid-way.
*/

/* The full explanation lives in the page's one shared status line, next
   to every other server-side problem (a gated model, an unreachable
   backend). This is only the hover hint on the dashes themselves, kept
   short since the real explanation is already on screen above. */
const MBI_FAILED_NOTE = "Could not load - see the status above.";

function figure(value, decimals = 2) {
    const number = Number(value);

    if (value === null || value === undefined || Number.isNaN(number)) {
        return (0).toFixed(decimals);
    }

    return number.toFixed(decimals);
}

/* For the vocabulary cards: null means the backend measured and there was
   nothing to report, which is a dash - not a zero, which would read as a
   real and very small measurement. */
function reference(value, decimals) {

    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return "—";
    }

    return Number(value).toFixed(decimals);
}

function Card({ name, value, title }) {
    return (
        <div className="metric-card" title={title}>
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
              than shown as three zeros.

    mbiFailed - the fetch for this language's morphology metrics failed,
                as opposed to simply not having run yet. mbi arrives null
                either way, and figure() used to turn that into a plain
                0.0% / 0 of 0 - indistinguishable from a real (and very
                bad) score. This keeps the two apart, showing a dash
                instead. The page's shared status line explains why, in
                the same spot every other server-side error uses - this
                component only needs the boolean.
*/

function MetricCards({
    metrics,
    mbi,
    showMbi = false,
    mbiFailed = false,
    alignmentLabel = "Morpheme Boundary Alignment",
    alignmentAsPercentage = false
}) {

    /*
        An uploaded file is measured against itself and nothing else, so it
        has no premium at all - both premium formulas divide by a FLORES
        English figure, and the user's file is not a translation of that
        corpus.

        The card is left out rather than printed as a zero. A metric that
        cannot exist for this input is not a small one, and a zero would be
        read as a real measurement. The row simply has three cards.
    */
    const isStandalone =
        metrics?.token_premium_basis === "standalone";

    /*
        The second row: Rényi, productivity, idiosyncrasy and byte premium,
        all in the same answer as the row above, so both rows fill in
        together.

        Left out entirely when the backend never sent Rényi (nothing loaded
        yet, or an older backend) rather than shown as a row of dashes.
    */
    const hasVocabulary = metrics?.renyi_efficiency !== undefined;

    /* Only the built-in corpus has one - it needs the same sentences in
       English. A file or typed text gets null and no card. */
    const bytePremium =
        metrics?.byte_premium === null || metrics?.byte_premium === undefined
            ? null
            : Number(metrics.byte_premium);

    const hasBytePremium =
        bytePremium !== null && Number.isFinite(bytePremium);

    let alignmentValue = alignmentAsPercentage ? "0.0%" : "0 / 0";

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
                : "0.0%";
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

            {/* Vocabulary - the same cards as the row above. Byte premium
                is the fourth when there is one, so the row has the same
                shape: four for the built-in corpus, three for a file. */}
            {hasVocabulary && (
                <div className="metric-row">

                    <Card
                        name="Rényi Efficiency"
                        value={reference(metrics.renyi_efficiency, 2)}
                    />

                    <Card
                        name="Productivity"
                        value={reference(metrics.productivity, 1)}
                    />

                    <Card
                        name="Idiosyncrasy"
                        value={reference(metrics.idiosyncrasy, 1)}
                    />

                    {hasBytePremium && (
                        <Card
                            name="Byte Premium"
                            value={`${bytePremium.toFixed(2)}×`}
                        />
                    )}

                </div>
            )}

            {/* Morphology, from the NCHLT gold segmentations */}

            {showMbi && (
                <div className="metric-row metric-row-centered">

                    <Card
                        name="Precision"
                        value={mbiFailed ? "—" : figure(mbi?.precision)}
                        title={mbiFailed ? MBI_FAILED_NOTE : undefined}
                    />

                    <Card
                        name="F1"
                        value={mbiFailed ? "—" : figure(mbi?.f1)}
                        title={mbiFailed ? MBI_FAILED_NOTE : undefined}
                    />

                    <Card
                        name="Recall"
                        value={mbiFailed ? "—" : figure(mbi?.recall)}
                        title={mbiFailed ? MBI_FAILED_NOTE : undefined}
                    />

                    <Card
                        name={alignmentLabel}
                        value={mbiFailed ? "—" : alignmentValue}
                        title={mbiFailed ? MBI_FAILED_NOTE : undefined}
                    />

                </div>
            )}

        </div>
    );
}

export default MetricCards;
