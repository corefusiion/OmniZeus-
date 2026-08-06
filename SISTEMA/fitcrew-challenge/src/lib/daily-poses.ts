// Lista fixa de poses disponíveis para a mecânica "Pose do Dia".
export type PoseOption = {
  key: string;
  emoji: string;
  name: string;
};

export const DAILY_POSES: PoseOption[] = [
  { key: "muque", emoji: "💪", name: "Muque (Mostrando o bíceps)" },
  { key: "paz", emoji: "✌️", name: "Paz e Amor (V de Vitória)" },
  { key: "joinha", emoji: "👍", name: "Joinha (Tudo certo)" },
  { key: "hang_loose", emoji: "🤙", name: "Hang Loose (De boa)" },
  { key: "careta", emoji: "🤪", name: "Caretinha (Rosto engraçado)" },
  { key: "mao_cabeca", emoji: "✋", name: "Mão na cabeça" },
  { key: "rock", emoji: "🤘", name: "Rock and Roll" },
];

export function findPose(key: string | null | undefined): PoseOption | null {
  if (!key) return null;
  return DAILY_POSES.find((p) => p.key === key) ?? null;
}
