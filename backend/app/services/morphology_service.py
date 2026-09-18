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

@dataclass
class MBIResult:
    """Aggregated metric results."""
    precision: float
    recall: float
    f1: float
    aligned_boundaries: int
    total_gold_boundaries: int

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
            # Only mark a boundary when the delimiter sits between two
            # characters in the surface word.
            if 1 <= pos <= len(vector):
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
            f"Length mismatch predicted={len(predicted_vector)}, gold={len(gold_vector)}"
        )

    # handle case where boundary vectors are empty
    if len(predicted_vector) == 0 and len(gold_vector) == 0:
        TP = FP = FN = 0 #No boundaries to compare, so don't consider it
    else:
        # Not empty
        for i in range(len(predicted_vector)):
            if predicted_vector[i] == 1 and gold_vector[i] == 1:
                TP += 1
            elif predicted_vector[i] == 1 and gold_vector[i] == 0:
                FP += 1
            elif predicted_vector[i] == 0 and gold_vector[i] == 1:
                FN += 1

    return WordResult(predicted.word, tp=TP, fp=FP, fn=FN)
            
def aggregate_results(word_results: list[WordResult]) -> MBIResult:
    """
    Micro-average TP/FP/FN across all words into overall precision/recall/F1

    Args:
        word_results: List of WordResult Objects

    Return:
        An MBIResult object with a that contains the precision/recall/F1 for all words 
    
    """

    tot_tp = 0
    tot_fp = 0
    tot_fn = 0

    # get the total amount of of FP/FP/FN to aggregate all words
    for word_result in word_results:
        tot_tp += word_result.tp
        tot_fp += word_result.fp
        tot_fn += word_result.fn

    # Calulate resulte, handle case where metrics are zero
    precision = tot_tp / (tot_tp + tot_fp) if (tot_tp + tot_fp) > 0 else 0.0
    recall = tot_tp / (tot_tp + tot_fn) if (tot_tp + tot_fn) > 0 else 0.0
    f1 = (2 * (precision * recall) / (precision + recall) 
        if (precision + recall) > 0
        else 0.0)

    # Boundary alignment across the entire dataset.
    #
    # TP = gold boundaries correctly predicted by the tokenizer.
    # TP + FN = all gold boundaries in the dataset.
    aligned_boundaries = tot_tp
    total_gold_boundaries = tot_tp + tot_fn

    return MBIResult(
        precision=precision,
        recall=recall,
        f1=f1,
        aligned_boundaries=aligned_boundaries,
        total_gold_boundaries=total_gold_boundaries,
    )
   