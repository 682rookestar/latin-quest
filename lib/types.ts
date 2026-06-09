export type GameType =
  | "vocab_match"
  | "fill_gap"
  | "word_type_sort"
  | "tense_id"
  | "case_id"
  | "adjective_agree"
  | "adverb_use"
  | "preposition_picture"
  | "translation"
  | "multiple_choice"
  | "boss";

export interface Exercise {
  id: string;
  chapter_id: string;
  skill_id: string | null;
  grammar_topic_id: string | null;
  title: string;
  description: string | null;
  game_type: GameType;
  difficulty: number;
  position: number;
  is_boss: boolean;
}

export interface ExerciseQuestion {
  id: string;
  exercise_id: string;
  position: number;
  prompt: string;
  correct_answer: string;
  options: any | null;
  metadata: any | null;
}
