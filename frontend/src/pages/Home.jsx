/*
    Home Page
    Author: Mukovhe Ranwashe (RNWMUK001)
    Date: 17 September 2026

    The landing page. It is the first thing a marker or a visitor sees, so
    it has to say what MzansiToken is, show that it is alive, and get the
    person into one of the three working pages in a single click.

    The numbers are read from GET /status rather than typed in, so the page
    cannot quietly go out of date, and a visitor can tell at a glance whether
    the backend is actually running.

    What the numbers mean, so nobody has to guess:
      languages  - len(corpus) from flores.py, which loads English plus the
                   seven South African languages in its LANGUAGES map.
      sentences  - get_sentence_count(), the MINIMUM length across those
                   files, so it is sentences PER LANGUAGE (997 for the
                   FLORES dev set), not a total across the corpus.
*/

import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import { getBackendStatus, friendlyError } from "../api/client";

import { WHEEL, LANGUAGE_ORDER } from "../components/languageColours";

/*
    A real sentence, split the way a byte-level tokenizer splits it. It sits
    behind the headline so the page demonstrates the idea before it explains
    it in words.
*/
const HERO_TOKENS = [
    "Ngi", "ya", "bo", "nga", "ka", "khu", "lu"
];

function Stat({ value, label, note, icon }) {

    return (
        <div className="home-stat">

            <span className="home-stat-icon">
                {icon}
            </span>

            <span className="home-stat-value">
                {value}
            </span>

            <span className="home-stat-label">
                {label}
            </span>

            <span className="home-stat-note">
                {note}
            </span>

        </div>
    );
}

function Feature({ icon, title, children }) {

    return (
        <div className="home-feature">

            <span className="home-feature-icon">
                {icon}
            </span>

            <h3>{title}</h3>

            <p>{children}</p>

        </div>
    );
}

/* Small line icons, inline so the page needs no icon library. */
const IconLayers = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 2 8l10 5 10-5-10-5Z" />
        <path d="m2 14 10 5 10-5" />
    </svg>
);

const IconText = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h16M4 12h10M4 18h13" />
    </svg>
);

const IconScale = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v18M5 7h14" />
        <path d="m5 7-3 6h6l-3-6Zm14 0-3 6h6l-3-6Z" />
    </svg>
);

const IconChart = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
);

const IconTrophy = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M7 6H4v1a3 3 0 0 0 3 3m10-4h3v1a3 3 0 0 1-3 3" />
        <path d="M9 20h6M12 14v6" />
    </svg>
);

const IconGlobe = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
    </svg>
);

const IconUpload = (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 16V4m0 0L8 8m4-4 4 4" />
        <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
);

function Home() {

    const [status, setStatus] = useState(null);
    const [statusError, setStatusError] = useState("");

    useEffect(() => {

        const controller = new AbortController();

        getBackendStatus(controller.signal)
            .then((result) => {
                setStatus(result);
                setStatusError("");
            })
            .catch((err) => {

                const detail = friendlyError(err);

                /* An aborted request is not a failure worth reporting. */
                if (detail) {
                    setStatusError(detail);
                }
            });

        return () => controller.abort();

    }, []);

    /*
        English is the baseline and has no NCHLT segmentations, so the
        morphology dataset covers every language here except that one.
        Derived rather than typed in, so it follows the corpus.
    */
    const morphologyLanguages =
        typeof status?.languages === "number"
            ? Math.max(status.languages - 1, 0)
            : null;

    const number = (value) => (
        typeof value === "number"
            ? value.toLocaleString()
            : "—"
    );

    return (
        <div className="home">

            {/* ---------------- HERO ---------------- */}

            <section className="home-hero">

                {/* The idea, demonstrated, before it is explained. */}
                <div className="home-hero-tokens" aria-hidden="true">
                    {HERO_TOKENS.map((piece, index) => (
                        <span
                            key={index}
                            className="home-hero-token"
                            style={{
                                background: WHEEL[index % WHEEL.length],
                                animationDelay: `${index * 0.09}s`
                            }}
                        >
                            {piece}
                        </span>
                    ))}
                </div>

                <span className="home-pill">
                    <span className="home-pill-dot"></span>
                    CSC3003S Capstone &middot; University of Cape Town
                </span>

                <h1 className="home-title">
                    See the language
                    <span className="home-title-accent">
                        beneath the tokens
                    </span>
                </h1>

                <p className="home-lede">
                    Every language model reads text as tokens, not words &mdash;
                    and it charges by the token. MzansiToken shows you exactly
                    how today&rsquo;s tokenizers cut up seven South African
                    languages, and what that costs next to the same sentence
                    in English.
                </p>

                <div className="home-cta">

                    <Link className="home-button is-primary" to="/inspect">
                        Start inspecting
                        <span aria-hidden="true">&rarr;</span>
                    </Link>

                    <Link className="home-button" to="/compare">
                        Compare two tokenizers
                    </Link>

                </div>

            </section>

            {/* ---------------- LIVE NUMBERS ---------------- */}

            <section className="home-stats" aria-label="The corpora at a glance">

                <Stat
                    icon={IconGlobe}
                    value={number(status?.languages)}
                    label="Languages"
                    note="seven South African, plus English as the baseline"
                />

                <Stat
                    icon={IconText}
                    value={number(status?.sentences)}
                    label="Sentences each"
                    note="the same FLORES passages, translated into all of them"
                />

                <Stat
                    icon={IconScale}
                    value={number(morphologyLanguages)}
                    label="With gold morphemes"
                    note="NCHLT segmentations, behind the MBI score"
                />

                <Stat
                    icon={IconLayers}
                    value={number(status?.suggested_tokenizers)}
                    label="Tokenizers ready"
                    note="or type any model id from Hugging Face"
                />

            </section>

            {statusError && (
                <p className="home-offline">
                    <span className="status-dot"></span>
                    {statusError}
                </p>
            )}

            {/* ---------------- WHY ---------------- */}

            <section className="home-section">

                <h2 className="home-heading">
                    Why MzansiToken?
                </h2>

                <p className="home-sub">
                    Tokenizers are built and benchmarked on English. When the
                    same sentence costs several times as many tokens in isiZulu,
                    that is a bill, a context limit and a quality gap that nobody
                    is measuring. MzansiToken measures it on two published
                    datasets &mdash; FLORES for efficiency, NCHLT for whether the
                    splits land on real morpheme boundaries.
                </p>

                <div className="home-features">

                    <Feature icon={IconText} title="Token by token">
                        Read a real corpus the way the model reads it. Word
                        boundaries, sub-word pieces and continuation marks are
                        all shown as they actually arrive.
                    </Feature>

                    <Feature icon={IconScale} title="Measured, not guessed">
                        Tokens per word, bytes per token, total tokens and the
                        cost relative to English &mdash; all computed on the same
                        FLORES sentences in every language, so the comparison is
                        like for like.
                    </Feature>

                    <Feature icon={IconGlobe} title="All eight at once">
                        Every language on one set of axes, coloured by family,
                        so the Nguni and Sotho-Tswana patterns are visible
                        rather than inferred.
                    </Feature>

                </div>

            </section>

            {/* ---------------- WHAT YOU CAN DO ---------------- */}

            <section className="home-section">

                <h2 className="home-heading">
                    Three ways in
                </h2>

                <p className="home-sub">
                    Each page answers a different question. Start wherever
                    yours is.
                </p>

                <div className="home-cards">

                    <Link className="home-card" to="/inspect">

                        <span className="home-card-icon">
                            {IconText}
                        </span>

                        <h3>Inspect</h3>

                        <p>
                            Pick a tokenizer and up to two languages, and watch
                            the corpus split in front of you. Charts underneath
                            put all eight languages side by side.
                        </p>

                        <span className="home-card-go">
                            Open Inspect &rarr;
                        </span>

                    </Link>

                    <Link className="home-card" to="/compare">

                        <span className="home-card-icon">
                            {IconChart}
                        </span>

                        <h3>Compare</h3>

                        <p>
                            Put two tokenizers head to head on the same text.
                            One chart, four measures, and a plain-language
                            verdict on which one is ahead and by how much.
                        </p>

                        <span className="home-card-go">
                            Open Compare &rarr;
                        </span>

                    </Link>

                    <Link className="home-card" to="/rank">

                        <span className="home-card-icon">
                            {IconTrophy}
                        </span>

                        <h3>Rank</h3>

                        <p>
                            Build a leaderboard of the tokenizers you have
                            tested, scored across every language, and keep it
                            as you go.
                        </p>

                        <span className="home-card-go">
                            Open Rank &rarr;
                        </span>

                    </Link>

                    <div className="home-card is-static">

                        <span className="home-card-icon">
                            {IconUpload}
                        </span>

                        <h3>Bring your own corpus</h3>

                        <p>
                            Upload a text file on the Inspect page and it is
                            tokenized and measured with the same pipeline as
                            the built-in corpus.
                        </p>

                        <span className="home-card-go is-quiet">
                            On the Inspect page
                        </span>

                    </div>

                </div>

            </section>

            {/* ---------------- CLOSING ---------------- */}

            <section className="home-closing">

                <h2>Ready to look underneath?</h2>

                <p>
                    Nothing to install and nothing to sign up for &mdash; the
                    corpus is already loaded.
                </p>

                <div className="home-cta">

                    <Link className="home-button is-primary" to="/inspect">
                        Open Inspect
                        <span aria-hidden="true">&rarr;</span>
                    </Link>

                    <Link className="home-button" to="/rank">
                        See the leaderboard
                    </Link>

                </div>

            </section>

            {/* ---------------- FOOTER ---------------- */}

            <footer className="home-footer">

                <div className="home-footer-brand">
                    <span className="brand-mark">M</span>
                    MzansiToken
                </div>

                <p>
                    Built by the Token Tribe team for the CSC3003S Capstone
                    Project
                </p>

                <p className="home-footer-fine">
                    University of Cape Town &middot; Department of Computer
                    Science
                </p>

                <div className="home-footer-wheel" aria-hidden="true">
                    {LANGUAGE_ORDER.slice(0, WHEEL.length).map((name, index) => (
                        <span
                            key={name}
                            title={name}
                            style={{ background: WHEEL[index] }}
                        ></span>
                    ))}
                </div>

            </footer>

        </div>
    );
}

export default Home;