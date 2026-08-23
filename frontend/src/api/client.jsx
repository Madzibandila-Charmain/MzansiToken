/*
    API client for the MzansiToken frontend.
    This file contains all required communication between React and FastAPI backend
    Author: Madzibandila Charmain
    Date: 23 August 2026
*/

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Converts a failed FastAPI response into a useful error. 
async function handleResponse(response, defaultMessage) {

    if (response.ok) {
        return response.json();
    }

    let message = defaultMessage;

    try {
        const errorData = await response.json();

        if (errorData.detail) {
            message = errorData.detail;
        }
    }
    catch {
        //Keeps the default message if the response is not JSON
    }

    throw new Error(message);
}

// Gets the languages, tokenizers and default settings suppoted by the backend.
export async function getOptions() {

    const response = await fetch(`${API_BASE_URL}/options`);

    return handleResponse(
        response,
        "Could not load backend options."
    );
}

// Gets tokenization and metrics for the default corpus of a selected language. 
export async function getDefaultCorpus (language, tokenizer){

    const response = await fetch ( 
        `${API_BASE_URL}/inspect/default`,
        {
            method: "POST",

            headers: {"Content-Type": "application/json"},

            body: JSON.stringify ({language,tokenizer})
        }
    );

    return handleResponse(
        response,
        "Could not load the default corpus."
    );
}

// Uploads a user's to FastAPI. 
export async function uploadCorpus (file, language, tokenizer) {
    const formData = new FormData();

    formData.append("file", file);
    formData.append("language", language);
    formData.append("tokenizer", tokenizer);

    const response = await fetch( 
        `${API_BASE_URL}/inspect/upload`,
        {
            method: "POST",
            body: formData
        }
    );

    return handleResponse(
        response,
        "Could not process the uploaded corpus."
    );
}

// Tokenizes text typed into the type anything box. 
export async function tokenizeText (text, language, tokenizer){

    const response = await fetch (
        `${API_BASE_URL}/tokenize-text`,
        {
            method: "POST",

            headers: {"Content-Type": "application/json"},

            body: JSON.stringify ({text, language, tokenizer})
        }
    );

    return handleResponse(
        response,
        "Could not tokenize the text."
    );
}
