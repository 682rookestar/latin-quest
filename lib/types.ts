export type Role = "teacher" | "student";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  role: Role;
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  grammar_summary: string | null;
}

export interface VocabItem {
  id: string;
  chapter_id: string;
  latin: string;
  english: string;
  part_of_speech: string | null;
  stem: string | null;
  declension: string | null;
  gender: string | null;
  conjugation: string | null;
  principal_parts: string | null;
  notes: string | null;
}

export interface GrammarTopic {
  id: string;
  chapter_id: string;
  name: string;
  category: string | null;
  description: string | null;
}

export interface Skill {
  id: string;
  code: GameType;
  display_name: string;
  category: string | null;
  description: string | null;
}

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
