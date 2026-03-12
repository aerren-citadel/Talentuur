const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const json = (statusCode, payload) => ({
  statusCode,
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(payload)
});

const getBody = (event) => {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
};

const getAdminRole = (event) => {
  const token = event.headers["x-admin-token"] || event.headers["X-Admin-Token"];
  if (!token) return null;
  if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) return "admin";
  if (process.env.ROOSTER_TOKEN && token === process.env.ROOSTER_TOKEN) return "rooster";
  return null;
};

const norm = (value) => String(value || "").trim();

const getStudentTakenTalents = async (client, studentId, currentPeriodId) => {
  const { rows } = await client.query(
    `
    SELECT a.assigned_talent_code AS code
    FROM assignments a
    WHERE a.student_id = $1
      AND a.period_id <> $2
    `,
    [studentId, currentPeriodId]
  );
  return new Set(rows.map((r) => r.code));
};

const getTalentsMap = async (client) => {
  const { rows } = await client.query(
    "SELECT code, label, allow_repeat, is_active, sort_order FROM talents ORDER BY sort_order, label"
  );
  const map = new Map();
  rows.forEach((r) => map.set(r.code, r));
  return { rows, map };
};

const isPeriodOpenNow = (period) => {
  if (!period.is_open) return false;
  const now = Date.now();
  if (period.open_at && now < new Date(period.open_at).getTime()) return false;
  if (period.close_at && now > new Date(period.close_at).getTime()) return false;
  return true;
};

const getPath = (event) => {
  const full = event.path || "";
  const idx = full.indexOf("/api/");
  if (idx === -1) return "/";
  return full.slice(idx + 4);
};

exports.handler = async (event) => {
  if (!process.env.DATABASE_URL) {
    return json(500, { error: "DATABASE_URL ontbreekt in environment variables." });
  }

  const method = event.httpMethod;
  const path = getPath(event);
  const client = await pool.connect();

  try {
    if (method === "GET" && path === "/health") {
      return json(200, { ok: true });
    }

    if (method === "GET" && path === "/talents") {
      const { rows } = await getTalentsMap(client);
      return json(200, { talents: rows });
    }

    if (method === "GET" && path === "/periods") {
      const { rows } = await client.query(
        "SELECT id, name, school_year, year_level, period_number, is_open, open_at, close_at, available_talents FROM periods ORDER BY school_year, year_level, period_number"
      );
      const periods = rows.map((p) => ({ ...p, is_open_now: isPeriodOpenNow(p) }));
      return json(200, { periods });
    }

    if (method === "GET" && path === "/admin/session") {
      const role = getAdminRole(event);
      if (!role) return json(401, { error: "Niet geautoriseerd." });
      return json(200, { role });
    }

    if (method === "GET" && path === "/student/options") {
      const studentNumber = norm(event.queryStringParameters?.studentNumber);
      const className = norm(event.queryStringParameters?.className);
      const periodId = Number(event.queryStringParameters?.periodId);
      if (!studentNumber || !className || !periodId) {
        return json(400, { error: "studentNumber, className en periodId zijn verplicht." });
      }

      const { rows: periodRows } = await client.query(
        "SELECT id, is_open, open_at, close_at, available_talents FROM periods WHERE id = $1",
        [periodId]
      );
      if (!periodRows.length) return json(404, { error: "Periode niet gevonden." });
      const period = periodRows[0];
      if (!isPeriodOpenNow(period)) {
        return json(400, { error: "Deze periode is (nog) niet open voor inschrijving." });
      }

      const { rows: students } = await client.query(
        "SELECT id, class_name FROM students WHERE student_number = $1",
        [studentNumber]
      );
      if (students.length && students[0].class_name && students[0].class_name !== className) {
        return json(403, { error: "Leerlingnummer en klas komen niet overeen." });
      }

      const { rows: allTalents, map } = await getTalentsMap(client);
      const allowedCodes = new Set(period.available_talents || []);

      let taken = new Set();
      if (students.length) {
        taken = await getStudentTakenTalents(client, students[0].id, periodId);
        const { rows: assignedRows } = await client.query(
          `
          SELECT a.assigned_talent_code, t.label
          FROM assignments a
          LEFT JOIN talents t ON t.code = a.assigned_talent_code
          WHERE a.student_id = $1 AND a.period_id = $2
          `,
          [students[0].id, periodId]
        );
        if (assignedRows.length) {
          return json(200, {
            locked: true,
            assignedTalentCode: assignedRows[0].assigned_talent_code,
            assignedLabel: assignedRows[0].label || assignedRows[0].assigned_talent_code,
            options: []
          });
        }
      }

      const options = allTalents
        .filter((t) => t.is_active && allowedCodes.has(t.code))
        .map((t) => {
          const blockedBecauseTaken = taken.has(t.code) && !t.allow_repeat;
          return {
            code: t.code,
            label: t.label,
            disabled: blockedBecauseTaken,
            reason: blockedBecauseTaken ? "Al gevolgd in een eerdere periode." : ""
          };
        });

      return json(200, { locked: false, options });
    }

    if (method === "POST" && path === "/student/choices") {
      const body = getBody(event);
      const studentNumber = norm(body.studentNumber);
      const className = norm(body.className);
      const periodId = Number(body.periodId);
      const choices = Array.isArray(body.choices) ? body.choices.map(norm) : [];

      if (!studentNumber || !className || !periodId) {
        return json(400, { error: "Vul leerlingnummer, klas en periode in." });
      }

      if (choices.length !== 4 || new Set(choices).size !== 4 || choices.some((c) => !c)) {
        return json(400, { error: "Je moet 4 verschillende keuzes invullen." });
      }

      await client.query("BEGIN");
      const { rows: periodRows } = await client.query(
        "SELECT id, available_talents, is_open, open_at, close_at FROM periods WHERE id = $1 FOR UPDATE",
        [periodId]
      );
      if (!periodRows.length) {
        await client.query("ROLLBACK");
        return json(404, { error: "Periode niet gevonden." });
      }
      const period = periodRows[0];
      if (!isPeriodOpenNow(period)) {
        await client.query("ROLLBACK");
        return json(400, { error: "Deze periode is gesloten voor inschrijving." });
      }

      const allowedCodes = new Set(period.available_talents || []);
      if (choices.some((c) => !allowedCodes.has(c))) {
        await client.query("ROLLBACK");
        return json(400, { error: "Een of meer gekozen talenturen zijn niet beschikbaar in deze periode." });
      }

      const { map: talentMap } = await getTalentsMap(client);
      const upsert = await client.query(
        `
        INSERT INTO students (student_number, first_name, last_name, class_name)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (student_number)
        DO UPDATE SET
          first_name = '',
          last_name = '',
          class_name = EXCLUDED.class_name
        RETURNING id
        `,
        [studentNumber, "", "", className]
      );
      const studentId = upsert.rows[0].id;
      const { rows: lockedRows } = await client.query(
        "SELECT 1 FROM assignments WHERE student_id = $1 AND period_id = $2",
        [studentId, periodId]
      );
      if (lockedRows.length) {
        await client.query("ROLLBACK");
        return json(400, { error: "Je bent al handmatig ingedeeld voor deze periode en kunt geen keuzes meer invullen." });
      }

      const taken = await getStudentTakenTalents(client, studentId, periodId);
      for (const code of choices) {
        const talent = talentMap.get(code);
        if (!talent) {
          await client.query("ROLLBACK");
          return json(400, { error: `Onbekend talentuur: ${code}` });
        }
        if (taken.has(code) && !talent.allow_repeat) {
          await client.query("ROLLBACK");
          return json(400, { error: `Talentuur ${talent.label} is al gevolgd en kan niet opnieuw gekozen worden.` });
        }
      }

      await client.query("DELETE FROM choices WHERE student_id = $1 AND period_id = $2", [studentId, periodId]);
      for (let i = 0; i < choices.length; i += 1) {
        await client.query(
          "INSERT INTO choices (student_id, period_id, choice_rank, talent_code) VALUES ($1, $2, $3, $4)",
          [studentId, periodId, i + 1, choices[i]]
        );
      }
      await client.query("COMMIT");
      return json(200, { ok: true });
    }

    if (method === "GET" && path === "/admin/overview") {
      const role = getAdminRole(event);
      if (!role) return json(401, { error: "Niet geautoriseerd." });
      const periodId = Number(event.queryStringParameters?.periodId);
      if (!periodId) return json(400, { error: "periodId is verplicht." });

      const { rows } = await client.query(
        `
        SELECT
          s.student_number,
          s.class_name,
          MAX(CASE WHEN c.choice_rank = 1 THEN t1.label END) AS choice1,
          MAX(CASE WHEN c.choice_rank = 2 THEN t1.label END) AS choice2,
          MAX(CASE WHEN c.choice_rank = 3 THEN t1.label END) AS choice3,
          MAX(CASE WHEN c.choice_rank = 4 THEN t1.label END) AS choice4,
          a.assigned_talent_code,
          t2.label AS assigned_label
        FROM students s
        LEFT JOIN choices c ON c.student_id = s.id AND c.period_id = $1
        LEFT JOIN talents t1 ON t1.code = c.talent_code
        LEFT JOIN assignments a ON a.student_id = s.id AND a.period_id = $1
        LEFT JOIN talents t2 ON t2.code = a.assigned_talent_code
        GROUP BY s.id, s.student_number, s.class_name, a.assigned_talent_code, t2.label
        ORDER BY s.class_name, s.student_number
        `,
        [periodId]
      );

      return json(200, { rows });
    }

    if (method === "POST" && path === "/admin/assign") {
      const role = getAdminRole(event);
      if (!role) return json(401, { error: "Niet geautoriseerd." });
      if (role !== "admin") return json(403, { error: "Alleen admin mag indelingen wijzigen." });
      const body = getBody(event);
      const studentNumber = norm(body.studentNumber);
      const assignedTalentCode = norm(body.assignedTalentCode);
      const periodId = Number(body.periodId);
      const assignedBy = norm(body.assignedBy || "coordinator");

      if (!studentNumber || !assignedTalentCode || !periodId) {
        return json(400, { error: "studentNumber, periodId en assignedTalentCode zijn verplicht." });
      }

      await client.query("BEGIN");
      const { rows: studentRows } = await client.query(
        "SELECT id FROM students WHERE student_number = $1 FOR UPDATE",
        [studentNumber]
      );
      if (!studentRows.length) {
        await client.query("ROLLBACK");
        return json(404, { error: "Leerling niet gevonden." });
      }
      const studentId = studentRows[0].id;

      const { rows: periodRows } = await client.query(
        "SELECT available_talents FROM periods WHERE id = $1",
        [periodId]
      );
      if (!periodRows.length) {
        await client.query("ROLLBACK");
        return json(404, { error: "Periode niet gevonden." });
      }
      const available = new Set(periodRows[0].available_talents || []);
      if (!available.has(assignedTalentCode)) {
        await client.query("ROLLBACK");
        return json(400, { error: "Toegewezen talentuur staat niet open in deze periode." });
      }

      await client.query(
        `
        INSERT INTO assignments (student_id, period_id, assigned_talent_code, assigned_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (student_id, period_id)
        DO UPDATE SET
          assigned_talent_code = EXCLUDED.assigned_talent_code,
          assigned_by = EXCLUDED.assigned_by,
          assigned_at = NOW()
        `,
        [studentId, periodId, assignedTalentCode, assignedBy]
      );
      await client.query("COMMIT");
      return json(200, { ok: true });
    }

    if (method === "GET" && path === "/admin/students") {
      const role = getAdminRole(event);
      if (!role) return json(401, { error: "Niet geautoriseerd." });
      const className = norm(event.queryStringParameters?.className);
      const sortBy = norm(event.queryStringParameters?.sortBy || "student_number");
      const allowedSort = new Set(["student_number", "class_name", "created_at"]);
      const orderBy = allowedSort.has(sortBy) ? sortBy : "student_number";
      const params = [];
      let where = "";
      if (className) {
        params.push(className);
        where = "WHERE class_name = $1";
      }
      const { rows } = await client.query(
        `
        SELECT id, student_number, class_name, created_at
        FROM students
        ${where}
        ORDER BY ${orderBy}, student_number
        `,
        params
      );
      return json(200, { rows });
    }

    if (method === "POST" && path === "/admin/students") {
      const role = getAdminRole(event);
      if (!role) return json(401, { error: "Niet geautoriseerd." });
      if (role !== "admin") return json(403, { error: "Alleen admin mag leerlingen wijzigen." });
      const body = getBody(event);
      const studentNumber = norm(body.studentNumber);
      const className = norm(body.className);
      if (!studentNumber || !className) return json(400, { error: "studentNumber en className zijn verplicht." });
      await client.query(
        `
        INSERT INTO students (student_number, first_name, last_name, class_name)
        VALUES ($1, '', '', $2)
        ON CONFLICT (student_number)
        DO UPDATE SET class_name = EXCLUDED.class_name
        `,
        [studentNumber, className]
      );
      return json(200, { ok: true });
    }

    if (method === "DELETE" && path === "/admin/students") {
      const role = getAdminRole(event);
      if (!role) return json(401, { error: "Niet geautoriseerd." });
      if (role !== "admin") return json(403, { error: "Alleen admin mag leerlingen verwijderen." });
      const studentNumber = norm(event.queryStringParameters?.studentNumber);
      if (!studentNumber) return json(400, { error: "studentNumber is verplicht." });
      await client.query("DELETE FROM students WHERE student_number = $1", [studentNumber]);
      return json(200, { ok: true });
    }

    if (method === "GET" && path === "/admin/talents") {
      const role = getAdminRole(event);
      if (!role) return json(401, { error: "Niet geautoriseerd." });
      const { rows } = await getTalentsMap(client);
      return json(200, { rows });
    }

    if (method === "POST" && path === "/admin/talents") {
      const role = getAdminRole(event);
      if (!role) return json(401, { error: "Niet geautoriseerd." });
      if (role !== "admin") return json(403, { error: "Alleen admin mag talenturen wijzigen." });
      const body = getBody(event);
      const code = norm(body.code).toLowerCase().replace(/\s+/g, "");
      const label = norm(body.label);
      const allowRepeat = Boolean(body.allowRepeat);
      const isActive = Boolean(body.isActive);
      const sortOrder = Number(body.sortOrder || 0);
      if (!code || !label) return json(400, { error: "code en label zijn verplicht." });
      await client.query(
        `
        INSERT INTO talents (code, label, allow_repeat, is_active, sort_order)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (code)
        DO UPDATE SET
          label = EXCLUDED.label,
          allow_repeat = EXCLUDED.allow_repeat,
          is_active = EXCLUDED.is_active,
          sort_order = EXCLUDED.sort_order
        `,
        [code, label, allowRepeat, isActive, sortOrder]
      );
      return json(200, { ok: true });
    }

    if (method === "DELETE" && path === "/admin/talents") {
      const role = getAdminRole(event);
      if (!role) return json(401, { error: "Niet geautoriseerd." });
      if (role !== "admin") return json(403, { error: "Alleen admin mag talenturen verwijderen." });
      const code = norm(event.queryStringParameters?.code);
      if (!code) return json(400, { error: "code is verplicht." });
      await client.query("UPDATE talents SET is_active = FALSE WHERE code = $1", [code]);
      return json(200, { ok: true });
    }

    if (method === "POST" && path === "/admin/periods") {
      const role = getAdminRole(event);
      if (!role) return json(401, { error: "Niet geautoriseerd." });
      if (role !== "admin") return json(403, { error: "Alleen admin mag periodes beheren." });
      const body = getBody(event);
      const id = Number(body.id || 0);
      const name = norm(body.name);
      const schoolYear = norm(body.schoolYear);
      const yearLevel = Number(body.yearLevel);
      const periodNumber = Number(body.periodNumber);
      const isOpen = Boolean(body.isOpen);
      const openAt = body.openAt ? new Date(body.openAt).toISOString() : null;
      const closeAt = body.closeAt ? new Date(body.closeAt).toISOString() : null;
      const availableTalents = Array.isArray(body.availableTalents)
        ? body.availableTalents.map(norm).filter(Boolean)
        : [];

      if (!name || !schoolYear || !yearLevel || !periodNumber || availableTalents.length === 0) {
        return json(400, { error: "Naam, schooljaar, leerjaar, periode en minimaal 1 talentuur zijn verplicht." });
      }

      if (id) {
        await client.query(
          `
          UPDATE periods
          SET name = $1,
              school_year = $2,
              year_level = $3,
              period_number = $4,
              is_open = $5,
              available_talents = $6,
              open_at = $7,
              close_at = $8
          WHERE id = $9
          `,
          [name, schoolYear, yearLevel, periodNumber, isOpen, availableTalents, openAt, closeAt, id]
        );
      } else {
        await client.query(
          `
          INSERT INTO periods (name, school_year, year_level, period_number, is_open, available_talents, open_at, close_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [name, schoolYear, yearLevel, periodNumber, isOpen, availableTalents, openAt, closeAt]
        );
      }

      return json(200, { ok: true });
    }

    if (method === "GET" && path === "/admin/periods") {
      const role = getAdminRole(event);
      if (!role) return json(401, { error: "Niet geautoriseerd." });
      const { rows } = await client.query(
        `
        SELECT id, name, school_year, year_level, period_number, is_open, open_at, close_at, available_talents
        FROM periods
        ORDER BY school_year, year_level, period_number
        `
      );
      return json(200, { rows: rows.map((p) => ({ ...p, is_open_now: isPeriodOpenNow(p) })) });
    }

    return json(404, { error: "Endpoint niet gevonden." });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // no-op
    }
    return json(500, { error: error.message || "Interne serverfout." });
  } finally {
    client.release();
  }
};
