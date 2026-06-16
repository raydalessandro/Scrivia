// Canone EAR e grammatica strutturale — etichette leggibili per la UI.
// Specchio di seme_config.yaml (resta la fonte di verità del motore).

export const ATTRIBUTE_LABEL: Record<string, string> = {
  distinguere: "Distinguere — accorgersi",
  connettere: "Connettere — avvicinarsi",
  cambiare: "Cambiare — attraversare",
};

export const ENTRY_POINTS: Record<string, string> = {
  A: "Dialogo in medias res",
  B: "Immagine ferma",
  C: "Voce esterna che irrompe",
  D: "Pensiero interno del protagonista",
  E: "Suono prima che immagine",
  F: "Gesto isolato",
};

export const CLOSURES: Record<number, string> = {
  1: "Frase rituale di una figura saggia (mai esplicativa)",
  2: "Immagine ferma senza dialogo",
  3: "Gesto silenzioso del protagonista",
  4: "Domanda non risposta, lasciata sospesa",
  5: "Suono o sensazione fisica",
  6: "Battuta laterale che taglia il momento alto",
  7: "Colpo di coda: una piccola aggiunta che ricolloca il peso",
};

export const REGISTERS: Record<string, string> = {
  basso: "Basso — prosa quotidiana, frasi cortissime",
  medio: "Medio — alternanza, qualche immagine",
  alto: "Alto — più lirico, immagini concentrate",
};

export const TIME_SPANS: Record<string, string> = {
  un_pomeriggio: "Un pomeriggio",
  un_giorno: "Un giorno",
  piu_giorni: "Più giorni",
  una_stagione: "Una stagione",
};

export const THEME_TO_ATTRIBUTE: Record<string, string> = {
  paura: "distinguere",
  scoperta: "distinguere",
  differenza: "distinguere",
  curiosita: "distinguere",
  amicizia: "connettere",
  aiuto: "connettere",
  gentilezza: "connettere",
  appartenenza: "connettere",
  perdita: "cambiare",
  crescere: "cambiare",
  cambiamento: "cambiare",
  passaggio: "cambiare",
};

// Assi di voce (crocette opzionali nel seeding).
export const VOICE_AXES: { key: keyof VoiceAxisMap; label: string; values: string[] }[] = [
  { key: "temperamento", label: "Temperamento", values: ["terrosa", "sospesa", "ironica", "tenera", "cantilenante"] },
  { key: "ritmo", label: "Ritmo", values: ["corte_secche", "onda_lunga", "spezzato_paratattico"] },
  { key: "distanza", label: "Distanza", values: ["dentro_la_testa", "sulla_spalla", "sguardo_da_lontano"] },
  { key: "lente_sensoriale", label: "Lente", values: ["suono", "tatto", "luce", "odore_sapore"] },
  { key: "umorismo", label: "Umorismo", values: ["asciutto", "battute_laterali", "niente"] },
];
export type VoiceAxisMap = {
  temperamento: string;
  ritmo: string;
  distanza: string;
  lente_sensoriale: string;
  umorismo: string;
};

export const ACTOR_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  you: { label: "Tu", color: "var(--color-you)", bg: "var(--color-you-bg)" },
  claude: { label: "Claude (IA)", color: "var(--color-claude)", bg: "var(--color-claude-bg)" },
  manus: { label: "Manus", color: "var(--color-manus)", bg: "var(--color-manus-bg)" },
  det: { label: "Sistema", color: "var(--color-det)", bg: "var(--color-det-bg)" },
};

export const WORLD_FLAVORS = [
  "animali_del_bosco",
  "spazio",
  "sottomarino",
  "citta",
  "casa",
  "fiabesco",
];
