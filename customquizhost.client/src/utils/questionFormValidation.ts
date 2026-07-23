import type { QuestionType } from "../types/GameState";

export function getQuestionFormValidationMessage(
  categoryId: string,
  questionType: QuestionType,
  questionText: string,
  hasMedia: boolean,
): string | null {
  if (!categoryId) return "Select a category.";
  if (questionType === "Standard" && !questionText.trim()) {
    return "Enter the question text.";
  }
  if (questionType === "Image" || questionType === "ImageMozaik") {
    return hasMedia ? null : "Select an image file.";
  }
  if (questionType === "Audio") {
    return hasMedia ? null : "Select an audio file.";
  }
  if (questionType === "Video") {
    return hasMedia ? null : "Select a video file.";
  }
  return null;
}
