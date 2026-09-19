/*
    API client for the MzansiToken frontend.

    All communication between React and FastAPI
    is handled in this file.

    Author: Madzibandila Charmain
*/

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    "http://127.0.0.1:8000";


/*
    An error that still knows its HTTP status, so callers can tell a bad
    request from a dead backend without parsing the message text.
*/
export class ApiError extends Error {

    constructor(message, status, detail) {
        super(message);

        this.name = "ApiError";
        this.status = status;
        this.detail = detail;
    }
}

/*
    FastAPI sends `detail` as a string for our own HTTPExceptions, but as an
    ARRAY of validation objects for a 422. The old code assigned that array
    straight into new Error(), which stringifies to "[object Object]" - so a
    bad request told the user nothing at all.
*/
function readDetail(detail, fallback) {

    if (typeof detail === "string" && detail.trim()) {
        return detail;
    }

    if (Array.isArray(detail)) {

        const parts = detail
            .map((item) => {

                if (typeof item === "string") {
                    return item;
                }

                const where = Array.isArray(item?.loc)
                    ? item.loc.filter((p) => p !== "body").join(".")
                    : "";

                const what = item?.msg || "is not valid";

                return where ? `${where}: ${what}` : what;
            })
            .filter(Boolean);

        if (parts.length) {
            return parts.join("; ");
        }
    }

    if (detail && typeof detail === "object" && typeof detail.message === "string") {
        return detail.message;
    }

    return fallback;
}

/*
    Turns a rejected fetch into something a user can act on. A dead backend
    rejects with "Failed to fetch", which is true but useless.
*/
export function friendlyError(err, what = "the backend") {

    /* A cancelled request is not a failure - nothing should be shown. */
    if (err?.name === "AbortError") {
        return "";
    }

    if (err instanceof ApiError) {
        return err.message;
    }

    const raw = String(err?.message || err);

    if (/failed to fetch|networkerror|load failed|fetch failed/i.test(raw)) {
        return `Cannot reach ${what} at ${API_BASE_URL}. Is the backend running?`;
    }

    return raw || "Something went wrong.";
}


/*
 *RESPONSE HANDLER
 */

async function handleResponse(
    response,
    defaultMessage
) {

    if (response.ok) {
        return response.json();
    }

    let detail = null;

    try {
        detail = (await response.json())?.detail ?? null;
    }
    catch {
        /* Not JSON - a proxy error page, or the server died mid-reply. */
    }

    let message = readDetail(detail, defaultMessage);

    /*
        A 5xx is our bug, not the user's. Say so, and point at where the
        traceback actually is.
    */
    if (response.status >= 500) {
        message = `${message} (server error ${response.status} `
            + `- check the backend terminal)`;
    }

    throw new ApiError(message, response.status, detail);
}


/*
 * OPTIONS
 */


export async function getOptions(
    signal
) {

    const response = await fetch(
        `${API_BASE_URL}/options`,
        {
            signal,
        }
    );

    return handleResponse(
        response,
        "Could not load backend options."
    );
}


/* 
 * DEFAULT CORPUS
 */ 

export async function getDefaultCorpus(
    language,
    tokenizer,
    signal
) {

    const response = await fetch(
        `${API_BASE_URL}/inspect/default`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
            },

            body: JSON.stringify({
                language,
                tokenizer,
            }),

            signal,
        }
    );

    return handleResponse(
        response,
        "Could not load the default corpus."
    );
}


/*
 * UPLOAD CORPUS
 */
export async function uploadCorpus(
    file,
    tokenizer,
    signal
) {

    const formData = new FormData();

    formData.append(
        "file",
        file
    );

    formData.append(
        "tokenizer",
        tokenizer
    );

    const response = await fetch(
        `${API_BASE_URL}/inspect/upload`,
        {
            method: "POST",
            body: formData,
            signal,
        }
    );

    return handleResponse(
        response,
        "Could not process the uploaded corpus."
    );

}


/*
 * TOKENIZE CUSTOM TEXT
 */

export async function tokenizeText(
    text,
    language,
    tokenizer,
    signal
) {

    const response = await fetch(
        `${API_BASE_URL}/tokenize-text`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
            },

            body: JSON.stringify({
                text,
                language,
                tokenizer,
            }),

            signal,
        }
    );

    return handleResponse(
        response,
        "Could not tokenize the text."
    );
}


/*
 * METRICS
 */

export async function getMetrics(
    tokenizer,
    signal
) {

    const response = await fetch(
        `${API_BASE_URL}/metrics/${encodeURIComponent(
            tokenizer
        )}`,
        {
            signal,
        }
    );

    return handleResponse(
        response,
        "Failed to load metrics."
    );
}


/*
 * TOKENIZER INFORMATION
 */

export async function getTokenizerInfo(tokenizer, signal) {
    const response = await fetch(
        `${API_BASE_URL}/tokenizer/${encodeURIComponent(tokenizer)}`,
        {
            signal,
        }
    );

    /*
        The old inline block here threw a plain Error before handleResponse
        ever ran, so a 422 arrived as "[object Object]" and a dead backend
        as "Failed to fetch". One handler for every endpoint instead.
    */
    return handleResponse(
        response,
        "Failed to load tokenizer."
    );
}


/*
 * MBI METRICS
 */

export async function getMBI(
    tokenizer,
    language,
    signal
) {

    const params = new URLSearchParams({
        language,
    });

    const response = await fetch(
        `${API_BASE_URL}/mbi/${encodeURIComponent(
            tokenizer
        )}?${params.toString()}`,
        {
            signal,
        }
    );

    return handleResponse(
        response,
        "Failed to load MBI metrics."
    );
}


/*
    Which languages NCHLT can score for morphology.

    Not the same list as /options, which is FLORES: NCHLT has isiNdebele and
    Tshivenda but no English, so seven of the eight overlap. RANK asks rather
    than hard-coding the overlap, so adding or removing a dataset file does
    not silently leave a wrong list in the JavaScript.
*/
export async function getMorphologyLanguages(
    signal
) {

    const response = await fetch(
        `${API_BASE_URL}/morphology-languages`,
        {
            signal,
        }
    );

    return handleResponse(
        response,
        "Could not load the morphology languages."
    );
}


export async function compareMBI(
    tokenizerA,
    tokenizerB,
    language,
    signal
) {

    const params = new URLSearchParams({
        model_a: tokenizerA,
        model_b: tokenizerB,
        language,
    });

    const response = await fetch(
        `${API_BASE_URL}/compare_mbi?${params.toString()}`,
        {
            signal,
        }
    );

    return handleResponse(
        response,
        "Failed to compare MBI metrics."
    );
}


export async function getExample(
    tokenizer,
    index = -1,
    signal
) {

    const response = await fetch(
        `${API_BASE_URL}/example/model/${encodeURIComponent(
            tokenizer
        )}?index=${index}`,
        {
            signal,
        }
    );

    return handleResponse(
        response,
        "Failed to load example."
    );
}

// SENTENCE COUNT

export async function getSentenceCount(
    signal
) {

    const response = await fetch(
        `${API_BASE_URL}/sentence-count`,
        {
            signal,
        }
    );

    return handleResponse(
        response,
        "Failed to load sentence count."
    );
}

// COMPARE TOKENIZERS

/*
    This POSTed to /compare with a JSON body, but the backend serves
    GET /compare?model_a=...&model_b=... - a guaranteed 405 the moment
    anything called it. Nothing does today, because CompareCharts reads
    GET /metrics/{model} twice instead, so the mismatch sat here unnoticed.
    Corrected to the route that exists.
*/
export async function compareTokenizers(
    tokenizerA,
    tokenizerB,
    signal
) {

    const params = new URLSearchParams({
        model_a: tokenizerA,
        model_b: tokenizerB,
    });

    const response = await fetch(
        `${API_BASE_URL}/compare?${params.toString()}`,
        {
            signal,
        }
    );

    return handleResponse(
        response,
        "Failed to compare tokenizers."
    );
}

// BACKEND STATUS

export async function getBackendStatus(
    signal
) {

    const response = await fetch(
        `${API_BASE_URL}/status`,
        {
            signal,
        }
    );

    return handleResponse(
        response,
        "Failed to load backend status."
    );
}

// LEADERBOARD

export async function getLeaderboard(
    {
        sortBy = "overall_score",
        descending = true,
    } = {},
    signal
) {

    const params = new URLSearchParams({
        sort_by: sortBy,
        descending: String(descending),
    });

    const response = await fetch(
        `${API_BASE_URL}/leaderboard?${params.toString()}`,
        {
            signal,
        }
    );

    return handleResponse(
        response,
        "Failed to load leaderboard data."
    );
}

export async function getSavedLeaderboardEntry(name, signal) {
    const response = await fetch(
        `${API_BASE_URL}/leaderboard/saved/${encodeURIComponent(name)}`,
        {signal}
    );

    return handleResponse(
        response,
        "Failed to load saved leaderboard entry."
    );
}

/*
    The formula behind overall_score: which metrics count and how much.

    Read from the backend rather than written out again here, so the page
    explains the score the server actually computed. A second copy of the
    weights in JavaScript would be right on the day it was typed and wrong
    the first time anybody tuned them.
*/
export async function getScoring(
    signal
) {

    const response = await fetch(
        `${API_BASE_URL}/leaderboard/scoring`,
        {
            signal,
        }
    );

    return handleResponse(
        response,
        "Could not load the scoring formula."
    );
}


export async function createOrUpdateLeaderboardEntry(
    name,
    signal
) {
    const response = await fetch(
        `${API_BASE_URL}/leaderboard`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name,
            }),
            signal,
        }
    );

    return handleResponse(
        response,
        "Failed to save leaderboard entry."
    );
}

export async function deleteLeaderboardEntry(
    tokenizerId,
    signal
) {

    const response = await fetch(
        `${API_BASE_URL}/leaderboard/${encodeURIComponent(
            tokenizerId
        )}`,
        {
            method: "DELETE",
            signal,
        }
    );

    return handleResponse(
        response,
        "Failed to remove leaderboard entry."
    );
}