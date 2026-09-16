export const createReorganizationController = ({
  asBoolean,
  db,
  positiveInt,
  reorganizationModel,
  roomAssignmentService,
  sanitizeFreeText,
}) => ({
  list: async (req, res, next) => {
    try {
      const paginated = req.query.page || req.query.page_size;
      const page = positiveInt(req.query.page, 1, { max: 100000 });
      const pageSize = positiveInt(req.query.page_size, 100, { min: 10, max: 500 });
      const { rows, total } = await reorganizationModel.list({
        institutionId: req.institution.id,
        paginated,
        page,
        pageSize,
      });
      if (!paginated) return res.json(rows);
      return res.json({ items: rows, paginacao: { pagina: page, por_pagina: pageSize, total } });
    } catch (error) {
      return next(error);
    }
  },

  create: async (req, res, next) => {
    const { aluno, ano, turma, curso, problema, salas } = req.body;
    const shouldReorganizeUpperFloors = asBoolean(req.body?.restricao_andar_superior);
    const rawStudentCount = req.body?.quantidade_alunos;
    const studentCount = rawStudentCount === null || rawStudentCount === undefined || rawStudentCount === "" ? null : Number(rawStudentCount);
    if (!aluno || !ano || !turma || !curso || !problema) {
      return res.status(400).json({ message: "Preencha todos os campos obrigatórios." });
    }
    if (shouldReorganizeUpperFloors && !req.user?.id) {
      return res.status(403).json({ message: "A troca automática de salas exige usuário CPD autenticado." });
    }
    if (studentCount !== null && (!Number.isInteger(studentCount) || studentCount < 1)) {
      return res.status(400).json({ message: "Informe uma quantidade de alunos válida." });
    }

    const conn = await db.getConnection();
    try {
      const institutionId = req.institution.id;
      await conn.beginTransaction();
      const studentId = await reorganizationModel.findOrCreateStudent(conn, { institutionId, aluno, ano, turma, curso });
      const requestId = await reorganizationModel.create(conn, { studentId, problema, file: req.file });
      await reorganizationModel.addRooms(conn, requestId, String(salas || "").split(","));

      let reorganization = null;
      if (shouldReorganizeUpperFloors) {
        reorganization = await roomAssignmentService.applyGroundFloorReorganization(conn, {
          institutionId,
          turma,
          userId: req.user.id,
          studentCount,
          reason: sanitizeFreeText(`Reorganização por acessibilidade: ${problema}`, 255),
        });
        await reorganizationModel.addRooms(conn, requestId, [
          ...reorganization.aplicadas.map((item) => item.sala_anterior),
          ...reorganization.aplicadas.map((item) => item.sala_nova),
          ...reorganization.nao_aplicadas.map((item) => item.sala_anterior),
        ]);
      }
      await conn.commit();
      return res.status(201).json({ id: requestId, reorganizacao: reorganization });
    } catch (error) {
      await conn.rollback();
      return next(error);
    } finally {
      conn.release();
    }
  },

  downloadAttachment: async (req, res, next) => {
    try {
      const attachment = await reorganizationModel.findAttachment({ id: req.params.id, institutionId: req.institution.id });
      if (!attachment?.arquivo_dados) return res.status(404).json({ message: "Arquivo não encontrado." });
      res.setHeader("Content-Disposition", `attachment; filename="${attachment.arquivo_nome}"`);
      res.setHeader("Content-Type", "application/octet-stream");
      return res.send(attachment.arquivo_dados);
    } catch (error) {
      return next(error);
    }
  },

  remove: async (req, res, next) => {
    try {
      await reorganizationModel.delete({ id: req.params.id, institutionId: req.institution.id });
      return res.json({ ok: true });
    } catch (error) {
      return next(error);
    }
  },
});
