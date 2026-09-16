export const ensureDefaultPublicContent = async (institutionId, db) => {
  const [sectorCount] = await db.query("SELECT COUNT(*) AS total FROM setores WHERE instituicao_id = ?", [institutionId]);
  if (Number(sectorCount[0]?.total || 0) !== 0) return;

  await db.query(
    `INSERT INTO setores
     (instituicao_id, nome, descricao, responsavel, localizacao, contato, horario_atendimento, icone, cor, ativo)
     VALUES
     (?, 'Direção', 'Gestão e administração escolar', NULL, 'Prédio administrativo', NULL, NULL, 'building', 'blue', TRUE),
     (?, 'Coordenação Pedagógica', 'Acompanhamento dos cursos e turmas', NULL, 'Prédio administrativo', NULL, NULL, 'graduation', 'violet', TRUE),
     (?, 'Biblioteca', 'Acervo, leitura e sala de estudo', NULL, 'Bloco principal', NULL, NULL, 'book', 'amber', TRUE),
     (?, 'Laboratórios', 'Ambientes técnicos e científicos', NULL, 'Blocos técnicos', NULL, NULL, 'flask', 'emerald', TRUE),
     (?, 'Oficinas', 'Práticas de mecânica e marcenaria', NULL, 'Área técnica', NULL, NULL, 'wrench', 'slate', TRUE),
     (?, 'Cantina', 'Alimentação e convivência', NULL, 'Pátio central', NULL, NULL, 'coffee', 'orange', TRUE),
     (?, 'Portaria', 'Entrada, orientação e segurança', NULL, 'Acesso principal', NULL, NULL, 'shield', 'indigo', TRUE)`,
    Array(7).fill(institutionId)
  );
};

const floorFromRoom = (roomName) => {
  const match = String(roomName).match(/^[A-E]\s?([1-3])/i);
  return match ? `${match[1]}º andar` : "A conferir";
};

const referenceRooms = [
  ["Bloco A", "A201", "Sala de aula", 38],
  ["Bloco A", "A202", "Sala de aula", 38],
  ["Bloco A", "A203", "Sala de aula", 38],
  ["Bloco A", "A204", "Sala de aula", 38],
  ["Bloco A", "A205", "Sala de aula", 38],
  ["Bloco A", "A206", "Sala de aula", 38],
  ["Bloco A", "A301", "Sala de aula", 29],
  ["Bloco A", "A302", "Sala de aula", 20],
  ["Bloco A", "A303", "Sala de aula", 23],
  ["Bloco A", "A304", "Sala de aula", 30],
  ["Bloco A", "A305", "Sala de aula", 38],
  ["Bloco B", "B101", "Sala de aula", 40],
  ["Bloco B", "B102", "Lab. quimica", null],
  ["Bloco B", "B103", "Sala de aula", 34],
  ["Bloco B", "B104", "Sala de aula", 20],
  ["Bloco B", "B105", "Sala de aula", 20],
  ["Bloco C", "C106", "Lab. design", null],
  ["Bloco C", "C108", "Lab. informatica", null],
  ["Bloco C", "C109", "Sala de aula", 22],
  ["Bloco C", "C201", "Lab. eletricidade", null],
  ["Bloco C", "C202", "Sala de aula", 20],
  ["Bloco C", "C204", "Lab. elo digital", null],
  ["Bloco C", "C205", "Lab. pratica", null],
  ["Bloco C", "C207", "Lab. informatica", null],
  ["Bloco C", "C208", "Lab. prat. prof.", null],
  ["Bloco C", "C210", "Lab. informatica", null],
  ["Bloco C", "C211", "Lab. informatica", null],
  ["Bloco C", "C301", "Lab. materiais", 20],
  ["Bloco C", "C302", "Sala de aula", 20],
  ["Bloco C", "C303", "Sala de aula", 20],
  ["Bloco C", "C304", "Sala de aula", 20],
  ["Bloco C", "C305", "Sala de aula", 20],
  ["Bloco C", "C306", "Sala de aula", 20],
  ["Bloco C", "C307", "Sala de aula", 24],
  ["Bloco C", "C308", "Sala de aula", 20],
  ["Bloco C", "C309", "Sala de aula", 20],
  ["Bloco C", "C311", "Sala de aula", 20],
  ["Bloco C", "C312", "Sala de aula", 20],
  ["Bloco C", "C313", "Lab. informatica", null],
  ["Bloco D", "D101", "Of. mecanica", null],
  ["Bloco D", "D101(A)", "Soldagem", null],
  ["Bloco D", "D101(B)", "Sala of. mecanica", null],
  ["Bloco D", "D101(C)", "CNC", null],
  ["Bloco D", "D201", "Telefonia", 22],
  ["Bloco D", "D202", "Lab. informatica", null],
  ["Bloco D", "D203", "Automacao", null],
  ["Bloco D", "D204", "Lab. desenho", 24],
  ["Bloco D", "D205", "Lab. informatica", null],
  ["Bloco D", "D206", "CLP", null],
  ["Bloco D", "D208", "Lab. eletro III", null],
  ["Bloco D", "D209", "Lab. medidas", null],
  ["Bloco D", "D210", "Lab. eletro II", null],
  ["Bloco D", "D211", "Lab. instalacoes", null],
  ["Bloco D", "D212", "Lab. eletronica", null],
  ["Bloco D", "D213", "Lab. informatica", null],
  ["Bloco E", "E101", "Lab. informatica", null],
  ["Bloco E", "E102", "Lab. meio amb.", 20],
];

export const ensureReferenceRooms = async (institutionId, db) => {
  for (const blockName of ["Bloco A", "Bloco B", "Bloco C", "Bloco D", "Bloco E"]) {
    await db.query(
      `INSERT INTO blocos (instituicao_id, nome, descricao)
       VALUES (?, ?, 'Cadastro base do quadro fotografado de salas e laboratorios.')
       ON CONFLICT (instituicao_id, nome) DO NOTHING`,
      [institutionId, blockName]
    );
  }

  for (const [blockName, name, type, capacity] of referenceRooms) {
    const [blocks] = await db.query("SELECT id FROM blocos WHERE instituicao_id = ? AND nome = ? LIMIT 1", [
      institutionId,
      blockName,
    ]);
    const blockId = blocks[0]?.id;
    if (!blockId) continue;
    const [existingRooms] = await db.query(
      `SELECT id
         FROM salas
        WHERE instituicao_id = ?
          AND bloco_id = ?
          AND REPLACE(UPPER(nome), ' ', '') = REPLACE(UPPER(?), ' ', '')
        LIMIT 1`,
      [institutionId, blockId, name]
    );
    if (existingRooms.length) continue;
    const notes = [
      "Cadastro inicial a partir das fotos IMG_4403/IMG_4404.",
      capacity == null ? "Capacidade ilegivel nas fotos; conferir no CPD." : "",
    ]
      .filter(Boolean)
      .join(" ");
    await db.query(
      `INSERT INTO salas
       (instituicao_id, bloco_id, nome, andar, capacidade, tipo, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (instituicao_id, bloco_id, nome) DO NOTHING`,
      [institutionId, blockId, name, floorFromRoom(name), capacity, type, notes]
    );
  }
};
