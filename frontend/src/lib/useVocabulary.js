/*
    useVocabulary.js
    Author: Mukovhe Ranwashe (RNWMUK001)

    Productivity and idiosyncrasy for all eight languages, per tokenizer,
    from GET /vocabulary/{name} - what the Productivity and Idiosyncrasy
    tabs on the Inspect wheel and the Compare chart draw.

    The answers are shared and kept for the rest of the visit, so two
    charts asking for the same tokenizer make one request, and coming back
    to a page asks for nothing.

    The backend works these out while the page's own boxes load (see
    /inspect/default), so by the time a box is on screen the answer here
    is already waiting and every chart tab is ready.
*/

import { useEffect, useState } from "react";

import { getVocabulary } from "../api/client";

/* name -> { [language]: { productivity, idiosyncrasy } } */
const answers = new Map();

/* name -> the request still in flight. */
const asking = new Map();

function ask(name) {

    if (!asking.has(name)) {

        asking.set(
            name,
            getVocabulary(name)
                .then((data) => {
                    answers.set(name, data);
                })
                .finally(() => {
                    /* Done either way; a failure can be tried again. */
                    asking.delete(name);
                })
        );
    }

    return asking.get(name);
}

/* Tests start from nothing. */
export function forgetVocabulary() {
    answers.clear();
    asking.clear();
}

/*
    names - tokenizer names; blanks and repeats are ignored.

    Returns {
        vocabulary: { [name]: { [language]: { productivity, idiosyncrasy } } },
        loading:    names still on their way,
        failed:     names the backend could not answer for
    }
*/
export function useVocabulary(names) {

    const wanted = [...new Set(names.filter(Boolean))];

    /* A string for the effect to watch, so it runs when the names really
       change and not on every render. */
    const key = wanted.join("\n");

    const [, setArrivals] = useState(0);
    const [failedNames, setFailedNames] = useState([]);

    useEffect(() => {

        let live = true;

        key
            .split("\n")
            .filter((name) => name && !answers.has(name))
            .forEach((name) => {

                ask(name)
                    .then(() => {
                        if (live) {
                            setArrivals((count) => count + 1);
                        }
                    })
                    .catch((error) => {
                        console.warn(
                            `Could not load the vocabulary measures for ${name}.`,
                            error
                        );

                        if (live) {
                            setFailedNames((current) =>
                                current.includes(name)
                                    ? current
                                    : [...current, name]
                            );
                        }
                    });
            });

        return () => {
            live = false;
        };

    }, [key]);

    const vocabulary = {};
    const loading = [];
    const failed = [];

    for (const name of wanted) {

        if (answers.has(name)) {
            vocabulary[name] = answers.get(name);
        }
        else if (failedNames.includes(name)) {
            failed.push(name);
        }
        else {
            loading.push(name);
        }
    }

    return { vocabulary, loading, failed };
}
