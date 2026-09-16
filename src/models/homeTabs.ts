export const homeTabIds = ["horarios", "mapa", "eventos", "setores", "reclamacoes"] as const;

export type HomeTabId = (typeof homeTabIds)[number];
