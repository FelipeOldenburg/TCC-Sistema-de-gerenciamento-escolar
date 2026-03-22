const HistoriaSection = () => {
  return (
    <div className="animate-fade-in">
      <div className="bg-card rounded-xl border border-border p-6 md:p-10 shadow-sm max-w-4xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-heading font-bold text-card-foreground mb-8">
          História da escola
        </h2>
        <div className="prose prose-lg max-w-none text-card-foreground/90 text-center leading-relaxed space-y-6">
          <p className="font-semibold text-lg">
            A Escola de Ensino Médio Monteiro Lobato tem suas origens no trabalho pioneiro dos professores
            Fernando Carlos Sperber, Harald Alberto Bauer e Arnaldo de Freitas, em 1960. Criada pelo
            Decreto nº 11.439, de 11 de julho do mesmo ano, inicialmente recebeu o nome de Escola
            Industrial de Taquara. Dois anos depois, em 1962, passou a chamar-se Escola Industrial Monteiro
            Lobato, tornando-se conhecida pela sigla CIMOL.
          </p>
          <p className="font-semibold text-lg">
            Em 8 de novembro de 1978, em decorrência da Lei nº 5.692/71, o Decreto de reorganização nº
            27.930 alterou novamente sua denominação para Escola Estadual de 2º Grau Monteiro Lobato. O
            nome foi escolhido em homenagem ao escritor brasileiro José Bento Monteiro Lobato (1882–1948),
            natural de Taubaté, São Paulo, reconhecido por sua vasta obra literária e pela defesa dos
            interesses nacionais, especialmente no setor industrial.
          </p>
          <p className="font-semibold text-lg">
            Atualmente, a escola possui uma área total de 5.095 m², dos quais 2.279 m² são de área
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
