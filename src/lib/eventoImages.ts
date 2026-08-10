import eventoFeira from "@/assets/evento-feira.jpg";
import eventoPingpong from "@/assets/evento-pingpong.jpg";
import eventoTalentos from "@/assets/evento-talentos.jpg";

type EventoImageInput = {
  titulo: string;
  descricao: string | null;
  local: string | null;
  imagem_url: string | null;
};

const eventImageRules = [
  {
    image: eventoPingpong,
    terms: ["ping", "pong", "tenis", "esporte", "jogo", "campeonato", "torneio"],
  },
  {
    image: eventoTalentos,
    terms: ["talento", "show", "musica", "arte", "cultura", "danca", "teatro", "apresentacao"],
  },
  {
    image: eventoFeira,
    terms: ["feira", "mostra", "ciencia", "tecnologia", "projeto", "workshop", "seminario"],
  },
];

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const getEventoImage = (evento: EventoImageInput) => {
  if (evento.imagem_url) return evento.imagem_url;

  const text = normalizeSearchText(`${evento.titulo} ${evento.descricao || ""} ${evento.local || ""}`);
  return eventImageRules.find((rule) => rule.terms.some((term) => text.includes(term)))?.image || eventoFeira;
};
