/*
    Inspect Page
    Author: Madzibandila Charmain
    Date: 21 August 2026
*/

import { useRef, useState } from "react";

function Inspect() {

    /* Stores the currently selected language(Default = English) */
    const [language, setLanguage] = useState("English");

    /* Stores the currently selected tokenizer(Default = XLM-RoBERTa) */
    const [tokenizer, setTokenizer] = useState("XLM-RoBERTa");

    /* Stores the name of the uploaded corpus file. */
    const [fileName, setFileName] = useState("default");

    /* reference to the actual file input */
    const fileInputRef = useRef(null);

    /* Handled file slection from user computer. */
    function handleFileChange(event) {
        const selectedFile = event.target.files[0];

        if (selectedFile) {
            setFileName(selectedFile.name);
        }
    }

    /* Returns the corpus back to the default state */
    function handleDefault() {
        setFileName("default");

        /* Clear the actual file selected in the browser. */
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    return (
        <>
            <section className="inspect-intro">

                {/* Description of what the Inspect page does */}
                <p className="inspect-label">
                    INSPECT 
                </p>

                <h1>
                    From isiXhosa to Setswana, See the Language Beneath.
                </h1>

                <p className="inspect-description">
                    Pick a tokenizer, choose a language and explore how your 
                    text is broken down into subword tokens the model can understand.
                </p>

            </section>

            {/* Tokenizer and Language selection box */}
            <section className="inspect-controls">

                {/* Left side containing the 2 dropdowns */}
                <div className="inspect-filters">

                    {/* Tokenizer Dropdown */}
                    <div className="filter-group">
                        <label htmlFor="tokenizer">
                            Tokenizer
                        </label>

                        <select 
                            id="tokenizer"
                            value={tokenizer}
                            onChange={(event) => setTokenizer(event.target.value)}
                        >

                            <option value="XLM-RoBERTa">
                                XLM-RoBERTa
                            </option>

                            <option value="mBERTA">
                                mBERT
                            </option>

                            <option value="BPE">
                                BPE
                            </option>

                            <option value="WordPiece">
                                WordPiece
                            </option>

                            <option value="SentencePiece">
                                SentencePiece
                            </option>

                        </select>
                    </div>
                    
                    {/* Language dropdown */}
                    <div className="filter-group">
                        <label htmlFor="language">
                            Language
                        </label>

                        <select 
                            id="language"
                            value={language}
                            onChange={(event) => setLanguage(event.target.value)}
                        >

                            <option value="english">
                                English
                            </option>

                            <option value="isiZulu">
                                isiZulu
                            </option>

                            <option value="isiXhosa">
                                isiXhosa
                            </option>

                            <option value="ndebele">
                                Ndebele
                            </option>

                            <option value="sestwana">
                                Setswana
                            </option>

                            <option value="sepedi">
                                Sepedi
                            </option>

                            <option value="xitsonga">
                                Xitsonga
                            </option>

                            <option value="sesotho">
                                Sesotho
                            </option>
                        </select>
                    </div>

                </div>

            </section>

            {/* Corpus tokenization box */}
            <section className="corpus-box">

                <div className="corpus-heading">
                    Mzansi Explorer • Corpus Tokenization
                </div>

                <p className="corpus-label">
                    {fileName} • {language} • {tokenizer}
                </p>

                <div className="upload-container">
                    <input
                        type="file"
                        id="corpus-upload"
                        ref={fileInputRef}
                        accept=".txt,.pdf"
                        onChange={handleFileChange}
                    />

                    <label htmlFor="corpus-upload" className="upload-button">
                        Upload your corpus(text)
                    </label>

                    {/* Shows Default button */}
                    {fileName !== "default" && (
                        <button
                            type="button"
                            className="default-button"
                            onClick={handleDefault}
                        >
                            Default
                        </button>
                    )}

                </div>

                {/* Tokenization Result */}
                <div className="tokenization-result">

                    <div className="tokenization-text">
                        Hello_Mutalukanyi_This_Is_Just_A_Placeholder_Replace_with_a_State
                    </div>
                </div>
 
            </section>
        </>
        
    );
}

export default Inspect;