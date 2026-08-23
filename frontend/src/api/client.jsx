const API_BASE_URL = "http://localhost:8000";

/* Gets the languages, tokenizers and default settings suppoted by the backend. */
export async function getOptions() {

    const response = await fetch(`${API_BASE_URL}/options`);

    if (!response.ok) {
        throw new Error ( "Could not load backend options.");
    }

    return response.json();
}

/* Gets tokenization and metrics for the default corpus of a selected language. */
export async function getDefaultCorpus (language, tokenizer){

    const response = await fetch ( 
        `${API_BASE_URL}/inspect/default`,
        {
            method: "POST",

            headers: {"Content-Type": "application/json"},

            body: JSON.stringify ({language,tokenizer})
        }
    );

    if (!response.ok) {
        throw new Error ("Could not load the default corpus.");
    }

    return response.json();
}

/* Uploads a user's to FastAPI. */
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

    if (!response.ok) {
        throw new Error ("Could not process the uploaded corpus.");
    }

    return response.json
}

/* Tokenizes text typed into the type anything box. */
export async function tokenizeText (text, language, tokenizer){

    const response = await fetch (
        `${API_BASE_URL}/tokenize-text`,
        {
            method: "POST",

            headers: {"Content-Type": "application/json"},

            body: JSON.stringify ({text, language, tokenizer})
        }
    );

    if(!response.ok) {
        throw new Error ("Could not tokenize the text.");
    }
    return response.json();
}
