"""
MBI service - Morphological Binary Identification
Service that compares tokenization with gold morpheme segmentations according to the NCHLT dataset

Author: Ethan Ngwetjana
Student Number: NGWETH001

Usage:
    import app.services.morphology_service

"""

from dataclasses import dataclass


@dataclass
class BoundaryVector:
    """Binary vector of boundary decisions (len = n_letters - 1) for one word."""
    word: str
    boundaries: list[int] # 0->no boundary  1->boundary

@dataclass
class WordResult:
    """TP/FP/FN counts for a single word."""
    word: str
    tp: int
    fp: int
    fn: int


def to_boundary_vector(surf_word: str, split_word: str, delimeter="_") -> BoundaryVector:
    """
        Converts tokenised/segmented words to boundary vector to make them directly compararible

        Args:
            surface_word: surface word before segmentation/tokenisation
            split_word: word after it has been tokenised/segmented
            Delimeter: what is used it indicate separation (default = '_')

        Return:
            A boundaryVector object which shows whether there is a boundary between two separations
    """

    # Initialise the vector 
    vector = [0] * (len(surf_word) - 1)

    # Initialise position of original word
    pos = 0

    i = 0

    # Iterate through each character in split_word
    while i < len(split_word):
        # If character is a delimeter
        if split_word[i] == delimeter:
            # set the vector to true in coresponding position
            vector[pos-1] = 1
            i += 1  #move to next character in spit word
        else:
            # normal character
            pos += 1 # move to next character
            i += 1

    return BoundaryVector(surf_word, vector)



    
def compare_boundaries(predicted: BoundaryVector, gold: BoundaryVector) -> WordResult:
    """
        Compute TP/FP/FN by comparing predicted boundaries from tokenizer against gold segmentation boundaries for one word

        Args:
            predicted: tokenizer boundaries
            gold: gold boundaries from dataset

        Return:
            A WordResult object which contains the TP/FP/FN results for a word
    """
    TP = 0
    FP = 0
    FN = 0

    predicted_vector = predicted.boundaries
    gold_vector = gold.boundaries

    if len(predicted_vector) != len(gold_vector):
        raise ValueError(
            f"Length mismatch predicted={len(predicted)}, gold={len(gold)}"
        )

    # handle case where boundary vectors are empty
    if len(predicted_vector) == 0 and len(gold_vector) == 0:
        TP = FP = FN = 0
    else:
        # Not empty
        for i in range(len(predicted_vector)):
            if predicted_vector[i] == 1 and gold_vector[i] == 1:
                TP += 1
            elif predicted_vector[i] == 1 and gold_vector[i] == 0:
                FP += 1
            elif predicted_vector[i] == 0 and gold_vector[i] == 1:
                FN += 1

    return WordResult(TP, FP, FN)
            
            

