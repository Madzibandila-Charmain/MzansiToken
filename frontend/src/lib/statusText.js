/*
    statusText.js
    Author: Mukovhe Ranwashe (RNWMUK001)

    Turns a backend sentence into something safe to show: capped in length,
    with any web address pulled out so it can be a link. Split out of
    StatusMessage.jsx because a file exporting both a component and plain
    functions breaks React fast refresh.
*/

/*
    A backend sentence is fine - the line wraps. An unbounded string is not.
*/
const STATUS_LIMIT = 220;

export function shortStatus(text) {

    const value = String(text || "").trim();

    if (value.length <= STATUS_LIMIT) {
        return value;
    }

    return `${value.slice(0, STATUS_LIMIT).trimEnd()}...`;
}

/*
    Split a message into the words around each address and the addresses
    themselves, so an address can be rendered as a link rather than as
    something the user has to copy out by hand.
*/
const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

export function statusParts(text) {

    const value = shortStatus(text);

    const parts = [];

    let cursor = 0;
    let match;

    URL_PATTERN.lastIndex = 0;

    while ((match = URL_PATTERN.exec(value)) !== null) {

        let url = match[0];

        /*
            A sentence usually ends right after the address, and that full
            stop is not part of the address.
        */
        const trailing = url.match(/[.,;:!?)\]]+$/);

        if (trailing) {
            url = url.slice(0, url.length - trailing[0].length);
        }

        if (match.index > cursor) {
            parts.push(value.slice(cursor, match.index));
        }

        /*
            Our own backend address appears in the "is the backend running"
            message. Linking it would invite the user to click something
            that is, by definition, not answering, so it stays plain text.
        */
        if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(url)) {
            parts.push(url);
        }
        else {
            parts.push({ url: url });
        }

        cursor = match.index + url.length;

        URL_PATTERN.lastIndex = cursor;
    }

    if (cursor < value.length) {
        parts.push(value.slice(cursor));
    }

    return parts;
}

/*
    A gated or missing model is fixed on Hugging Face, not in our app. Only
    for those two cases - a dead backend has nothing to do with Hugging Face.
*/
export function modelPageUrl(name, message) {

    const id = String(name || "").trim();

    if (!/^[\w.-]+(\/[\w.-]+)?$/.test(id)) {
        return "";
    }

    const isModelProblem =
        /gated|licen[cs]e|not be found|does not exist|no such|unknown|invalid/i
            .test(String(message || ""));

    if (!isModelProblem) {
        return "";
    }

    return `https://huggingface.co/${id}`;
}
