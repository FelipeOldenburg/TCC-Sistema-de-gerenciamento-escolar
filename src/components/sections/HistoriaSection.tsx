import { BookOpen } from "lucide-react";

const HistoriaSection = () => {
  return (
    <div className="animate-fade-in">
      <div className="glass-card rounded-2xl p-6 md:p-10 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-card-foreground">
            História da escola
          </h2>
        </div>
        <div className="space-y-6 text-card-foreground/85 leading-relaxed">
          <p className="text-base md:text-lg text-center">
            A Escola de Ensino Médio Monteiro Lobato tem suas origens no trabalho pioneiro dos professores
            Fernando Carlos Sperber, Harald Alberto Bauer e Arnaldo de Freitas, em 1960. Criada pelo
            Decreto nº 11.439, de 11 de julho do mesmo ano, inicialmente recebeu o nome de <strong>Escola
            Industrial de Taquara</strong>. Dois anos depois, em 1962, passou a chamar-se Escola Industrial Monteiro
            Lobato, tornando-se conhecida pela sigla <strong>CIMOL</strong>.
          </p>
          <div className="w-16 h-0.5 bg-primary/20 mx-auto" />
          <p className="text-base md:text-lg text-center">
            Em 8 de novembro de 1978, em decorrência da Lei nº 5.692/71, o Decreto de reorganização nº
            27.930 alterou novamente sua denominação para Escola Estadual de 2º Grau Monteiro Lobato. O
            nome foi escolhido em homenagem ao escritor brasileiro <strong>José Bento Monteiro Lobato</strong> (1882–1948),
            natural de Taubaté, São Paulo, reconhecido por sua vasta obra literária e pela defesa dos
            interesses nacionais, especialmente no setor industrial.
          </p>
          <div className="w-16 h-0.5 bg-primary/20 mx-auto" />
          <p className="text-base md:text-lg text-center">
            Atualmente, a escola possui uma área total de <strong>5.095 m²</strong>, dos quais 2.279 m² são de área
            construída. O complexo escolar conta com diversos laboratórios técnicos, salas de aula,
            biblioteca, auditório e áreas administrativas, atendendo centenas de alunos em cursos técnicos
            integrados ao ensino médio.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HistoriaSection;
