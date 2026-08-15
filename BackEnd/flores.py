"""
flores.py - FLORES dataset loader for the TAD backend
TAD Capstone Project
 
Usage:
    from flores import load_flores, LANGUAGES
"""

from pathlib import Path

# Maps human-readable language names to their FLORES filename codes.
# These are the 9 South African languages in the project scope.
LANGUAGES = {
    "Afrikaans": "afr_Latn",
    "English":   "eng_Latn",
    "Sepedi":    "nso_Latn",
    "Sesotho":   "sot_Latn",
    "siSwati":   "ssw_Latn",
    "Setswana":  "tsn_Latn",
    "Xitsonga":  "tso_Latn",
    "isiXhosa":  "xho_Latn",
    "isiZulu":   "zul_Latn",
}

def load_flores(data_dir: str) -> dict[str, list[str]]:
    """
    Load the FLORES dev set from a folder of .dev files.

    Args:
        data_dir: Path to the folder containing the .dev files
                  e.g. "Capstone/dev"

    Returns:
        dict mapping language name -> list of 997 sentences
        e.g. {"English": ["On Monday...", ...], "isiZulu": [...], ...}
    """
    # Convert the string path into a Path object for safer handling
    data_dir = Path(data_dir)

    # Check that the directory exists before proceeding
    if not data_dir.exists():
        raise FileNotFoundError(
            f"Data directory '{data_dir}' not found. "
            f"Check the path and make sure FLORES is downloaded."
        )

    corpus = {}  # Will hold language -> list of sentences

    # Iterate through all languages defined in LANGUAGES dict
    for language_name, file_code in LANGUAGES.items():
        # Build the full file path (e.g. "eng.dev")
        filepath = data_dir / f"{file_code}.dev"

        # Skip if the file doesn’t exist
        if not filepath.exists():
            print(f"Warning: {filepath} not found, skipping {language_name}")
            continue

        # Read the file line by line, stripping whitespace
        with open(filepath, encoding="utf-8") as f:
            sentences = []
            for line in f:
                stripped = line.strip()
                if stripped:  # Ignore blank lines
                    sentences.append(stripped)

        # Skip empty files to avoid divide-by-zero errors later
        if not sentences:
            print(f"Warning: {filepath} is empty, skipping {language_name}")
            continue

        # Add the list of sentences to the corpus
        corpus[language_name] = sentences

        # Print a quick sanity check (should be 997 sentences per FLORES file)
        print(f"Loaded {len(sentences)} sentences for {language_name}")

    return corpus

# This blocks only runs when you execute this file diretly: python BackEnd/flores.py DataSet/FLORES
# It does not run when another file imports this file e.g frome flores impor load_flores

if __name__ == "__main__":
    import sys
 
    # sys.argv is the list of command-line arguments.
    # sys.argv[0] is always the script name itself ("flores.py").
    # sys.argv[1] is the first argument the user typed after the script name.
    # If the user didn't provide an argument, we default to "DataSets/FLORES".
    DATA_DIR = sys.argv[1] if len(sys.argv) > 1 else "DataSets/FLORES"
 
    print(f"\n=== Loading FLORES from '{DATA_DIR}' ===\n")
 
    # Attempts laoding the corpus, stops cleanly if the folder is missing
    try:
        corpus = load_flores(DATA_DIR)
    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)
 
    # Print a summary of what was loaded
    print(f"\nSummary: loaded {len(corpus)} languages")
    for lang, sentences in corpus.items():
        print(f"  {lang:<12}: {len(sentences)} sentences")