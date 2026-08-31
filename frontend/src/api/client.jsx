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
 *RESPONSE HANDLER
 */

async function handleResponse(
    response,
    defaultMessage
) {

    if (response.ok) {
        return response.json();
    }

    let message = defaultMessage;

    try {

        const errorData = await response.json();

        if (errorData.detail) {
            message = errorData.detail;
        }

    } catch {
        // Keep default message.
    }

    throw new Error(message);
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
    language,
    tokenizer,
    signal
) {

    const formData = new FormData();

    formData.append(
        "file",
        file
    );

    formData.append(
        "language",
        language
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

export async function getTokenizerInfo(
    tokenizer,
    signal
) {

    const response = await fetch(
        `${API_BASE_URL}/tokenizer/${encodeURIComponent(
            tokenizer
        )}`,
        {
            signal,
        }
    );

    return handleResponse(
        response,
        "Failed to load tokenizer information."
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

export async function compareTokenizers(
    tokenizerA,
    tokenizerB,
    signal
) {

    const response = await fetch(
        `${API_BASE_URL}/compare`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
            },

            body: JSON.stringify({
                tokenizer_a: tokenizerA,
                tokenizer_b: tokenizerB,
            }),

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

export async function createOrUpdateLeaderboardEntry(
    name,
    metrics,
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
                metrics,
            }),

            signal,
        }
    );

    return handleResponse(
        response,
        "Failed to save leaderboard entry."
    );
}