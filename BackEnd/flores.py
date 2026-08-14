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