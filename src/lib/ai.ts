import { createOpenAiServerClient, isOpenAiConfigured } from "@/lib/openai/server";

type QuizDraftItem = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  sourceQuote: string;
  sourcePage: number;
};

export type SummaryReviewDraft = {
  qualityScore: number;
  factualityScore: number;
  issues: string[];
  improvementNotes: string[];
  correctedContent: string;
};

export type SummarySourceMode = "legacy" | "knowledge_base";

export async function applyImprovementToSummaryDraft(input: {
  lessonTitle: string;
  sourceText: string;
  currentSummary: string;
  improvementNote: string;
}) {
  if (!isOpenAiConfigured()) {
    throw new Error("OpenAI nincs bekötve a javítás alkalmazásához.");
  }

  const client = createOpenAiServerClient();
  const response = await client.responses.create({
    model: "gpt-5-nano",
    input: [
      {
        role: "system",
        content:
          "A megadott forrasszoveg, jelenlegi osszefoglalo es javitasi javaslat alapjan keszits uj, magyar nyelvu osszefoglalot. A javitasi javaslatot tenylegesen epitsd be, ne idezd vissza utasitaskent. Ne irj metakommentet. Ne hasznalj kulso tudast. Tartsd meg a tomor, tanulhato stilust es a **dupla csillagos** kiemelest a kulcsfogalmaknal.",
      },
      {
        role: "user",
        content: `Lecke: ${input.lessonTitle}\n\nJavitasi javaslat:\n${input.improvementNote}\n\nJelenlegi osszefoglalo:\n${input.currentSummary.slice(0, 5000)}\n\nForrasszoveg:\n${input.sourceText.slice(0, 9000)}`,
      },
    ],
  });

  return {
    mode: "openai" as const,
    content: response.output_text.trim(),
  };
}

export async function applyImprovementToKeyPointsDraft(input: {
  lessonTitle: string;
  sourceText: string;
  currentKeyPoints: string[];
  improvementNote: string;
}) {
  if (!isOpenAiConfigured()) {
    throw new Error("OpenAI nincs bekötve a javítás alkalmazásához.");
  }

  const client = createOpenAiServerClient();
  const response = await client.responses.create({
    model: "gpt-5-mini",
    text: {
      format: {
        type: "json_schema",
        name: "updated_key_points",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            keyPoints: {
              type: "array",
              minItems: 5,
              maxItems: 7,
              items: { type: "string" },
            },
          },
          required: ["keyPoints"],
        },
      },
    },
    input: [
      {
        role: "system",
        content:
          "A megadott forrasszoveg, jelenlegi vazlatpontok es javitasi javaslat alapjan keszits uj, magyar nyelvu 5-7 pontos vazlatot. A javitasi javaslatot tenylegesen epitsd be, ne idezd vissza utasitaskent. Minden pont egy tomor allitas legyen. Ne irj feladatot, metakommentet vagy kulso tudast.",
      },
      {
        role: "user",
        content: `Lecke: ${input.lessonTitle}\n\nJavitasi javaslat:\n${input.improvementNote}\n\nJelenlegi vazlatpontok:\n${input.currentKeyPoints.map((point) => `- ${point}`).join("\n")}\n\nForrasszoveg:\n${input.sourceText.slice(0, 9000)}`,
      },
    ],
  });

  const parsed = JSON.parse(response.output_text) as { keyPoints?: string[] };

  return {
    mode: "openai" as const,
    keyPoints: (parsed.keyPoints ?? []).map((item) => item.trim()).filter(Boolean),
  };
}

export async function generateLessonKeyPointsDraft(input: {
  lessonTitle: string;
  sourceText: string;
}) {
  if (!isOpenAiConfigured()) {
    return {
      mode: "disabled" as const,
      keyPoints: [
        "A legfontosabb fogalmak és szereplők rövid kivonata.",
        "A témához tartozó fő események és összefüggések.",
        "Ezt még finomítani kell, ha az OpenAI be lesz kötve.",
      ],
    };
  }

  const client = createOpenAiServerClient();
  const response = await client.responses.create({
    model: "gpt-5-mini",
    text: {
      format: {
        type: "json_schema",
        name: "lesson_key_points",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            keyPoints: {
              type: "array",
              minItems: 5,
              maxItems: 7,
              items: { type: "string" },
            },
          },
          required: ["keyPoints"],
        },
      },
    },
    input: [
      {
        role: "system",
        content:
          "Csak a megadott forrasszoveg alapjan keszits 5-7 rovid, magyar nyelvu vazlatpontot. Minden pont egyetlen tomor allitas legyen. A lecke cime csak cimke: ha egy allitas nincs benne a forrasszovegben, ne ird bele. Fedd le a tema fo reszeit es reszmotívumait is, ha azok tenyleg szerepelnek a forrasszovegben. Feladatokat, kerdeseket, utasitasokat, oldalhivatkozasokat es forrasmegjeloleseket ne emelj be. Ne kezdd ugy, hogy 'A szoveg szerint' vagy 'Ebben a reszben'.",
      },
      {
        role: "user",
        content: `Lecke: ${input.lessonTitle}\n\nForrasszoveg:\n${input.sourceText.slice(0, 12000)}`,
      },
    ],
  });

  const parsed = JSON.parse(response.output_text) as { keyPoints?: string[] };

  return {
    mode: "openai" as const,
    keyPoints: (parsed.keyPoints ?? []).map((item) => item.trim()).filter(Boolean),
  };
}

export async function generateLessonSummaryDraft(input: {
  lessonTitle: string;
  sourceText: string;
  keyPoints?: string[];
}) {
  if (!isOpenAiConfigured()) {
    return {
      mode: "disabled" as const,
      summary:
        "OpenAI nincs bekotve, ezert csak placeholder summary erheto el ebben a fazisban.",
    };
  }

  const client = createOpenAiServerClient();
  const response = await client.responses.create({
    model: "gpt-5-mini",
    input: [
      {
        role: "system",
        content:
          "Csak a megadott forrasszoveg alapjan irj magyar nyelvu, leiro, tenyszeru osszefoglalot. Ne adj hozza kulso tudast. A lecke cime csak cimke: ne kovetkeztess belole cselekmenyt vagy reszletet, ha az nincs a forrasban. 3-4 rovid, de informaciodus bekezdes legyen. A legfontosabb fogalmakat vagy neveket jelold **dupla csillaggal**. Maradjon benne minden fo resztema, ami a forrasban erdemben szerepel. Feladatokat, utasitasokat, kerdeseket, felszolitasokat, oldalhivatkozasokat es forrasmegjeloleseket hagyd ki. Ne kezdd ugy, hogy 'A szoveg szerint', 'Ebben a reszben', 'A lecke bemutatja'. Ha kapsz kulcspontokat, azokat hasznald szerkezeti tamaszkent, de csak olyan allitast irj le, amit a forrasszoveg alatamaszt.",
      },
      {
        role: "user",
        content: `Lecke: ${input.lessonTitle}\n\nKulcspontok:\n${
          input.keyPoints?.length ? input.keyPoints.map((point) => `- ${point}`).join("\n") : "nincs megadva"
        }\n\nForrasszoveg:\n${input.sourceText.slice(0, 12000)}`,
      },
    ],
  });

  return {
    mode: "openai" as const,
    summary: response.output_text,
  };
}

export async function generateChildFriendlyExplanationDraft(input: {
  lessonTitle: string;
  sourceText: string;
}) {
  if (!isOpenAiConfigured()) {
    return {
      mode: "disabled" as const,
      explanation:
        "OpenAI nincs bekotve, ezert csak placeholder magyarazat erheto el ebben a fazisban.",
    };
  }

  const client = createOpenAiServerClient();
  const response = await client.responses.create({
    model: "gpt-5-mini",
    input: [
      {
        role: "system",
        content:
          "Csak a megadott forrasszoveg alapjan irj egyszeru, 10-12 eves gyereknek szolo magyar nyelvu magyarazatot. Ne adj hozza kulso tudast, ne talalj ki tenyeken tuli reszleteket. Legyen vilagos, rovid, es ne tartalmazzon feladatot, utasitast vagy kerdest. Ne kezdd ugy, hogy 'Kepzeld el' vagy 'Most megtanuljuk'.",
      },
      {
        role: "user",
        content: `Lecke: ${input.lessonTitle}\n\nForrasszoveg:\n${input.sourceText.slice(0, 12000)}`,
      },
    ],
  });

  return {
    mode: "openai" as const,
    explanation: response.output_text,
  };
}

export async function generateLessonQuizDraft(input: {
  lessonTitle: string;
  sourceText: string;
}) {
  if (!isOpenAiConfigured()) {
    return {
      mode: "disabled" as const,
      items: [
        {
          question: `${input.lessonTitle}: miről szól röviden ez a rész?`,
          options: [
            "A tananyag egyik fő témájáról",
            "Egy teljesen más tantárgyról",
            "Egy véletlen példáról",
            "Egy nem kapcsolódó játékról",
          ],
          correctAnswer: "A tananyag egyik fő témájáról",
          explanation: "Placeholder kvíz, mert az OpenAI nincs bekötve.",
          sourceQuote: input.sourceText.slice(0, 160),
          sourcePage: 1,
        },
      ],
    };
  }

  const client = createOpenAiServerClient();
  const response = await client.responses.create({
    model: "gpt-5-mini",
    text: {
      format: {
        type: "json_schema",
        name: "lesson_quiz",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            items: {
              type: "array",
              minItems: 3,
              maxItems: 4,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  question: { type: "string" },
                  options: {
                    type: "array",
                    minItems: 4,
                    maxItems: 4,
                    items: { type: "string" },
                  },
                  correctAnswer: { type: "string" },
                  explanation: { type: "string" },
                  sourceQuote: { type: "string" },
                  sourcePage: { type: "integer" },
                },
                required: [
                  "question",
                  "options",
                  "correctAnswer",
                  "explanation",
                  "sourceQuote",
                  "sourcePage",
                ],
              },
            },
          },
          required: ["items"],
        },
      },
    },
    input: [
      {
        role: "system",
        content:
          "Csak a megadott forrasszoveg alapjan keszits 3-4 darab magyar nyelvu feleletvalasztos kerdest 10-12 eves gyereknek. Negy opcio legyen, pontosan egy helyes valasszal. Ne hasznalj kulso tudast. Csak olyan allitasra kerdezz ra, ami kifejezetten benne van a forrasszovegben. A helyes valasz szovegszeruen vagy egyertelmuen kovetkezzen a forrasbol. Ne kerdezz olyan reszletre, ami nincs benne a kivonatban vagy osszefoglaloban.",
      },
      {
        role: "user",
        content: `Lecke: ${input.lessonTitle}\n\nForrasszoveg:\n${input.sourceText.slice(0, 12000)}`,
      },
    ],
  });

  const parsed = JSON.parse(response.output_text) as { items?: QuizDraftItem[] };

  return {
    mode: "openai" as const,
    items: (parsed.items ?? []).filter(
      (item) =>
        item.question &&
        Array.isArray(item.options) &&
        item.options.length === 4 &&
        item.correctAnswer &&
        item.explanation,
    ),
  };
}

export async function reviewLessonSummaryDraft(input: {
  lessonTitle: string;
  sourceText: string;
  summaryType: "short_summary" | "key_points";
  draftContent: string;
  sourceTextLimit?: number;
  draftContentLimit?: number;
}) {
  if (!isOpenAiConfigured()) {
    return {
      mode: "disabled" as const,
      review: {
        qualityScore: 0,
        factualityScore: 0,
        issues: [],
        improvementNotes: [],
        correctedContent: input.draftContent.trim(),
      } satisfies SummaryReviewDraft,
    };
  }

  const client = createOpenAiServerClient();
  const response = await client.responses.create({
    model: "gpt-5-mini",
    text: {
      format: {
        type: "json_schema",
        name: "lesson_summary_review",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            qualityScore: { type: "integer", minimum: 0, maximum: 100 },
            factualityScore: { type: "integer", minimum: 0, maximum: 100 },
            issues: {
              type: "array",
              maxItems: 6,
              items: { type: "string" },
            },
            improvementNotes: {
              type: "array",
              maxItems: 6,
              items: { type: "string" },
            },
            correctedContent: { type: "string" },
          },
          required: [
            "qualityScore",
            "factualityScore",
            "issues",
            "improvementNotes",
            "correctedContent",
          ],
        },
      },
    },
    input: [
      {
        role: "system",
        content:
          "A megadott forrasszoveghez kepest ellenorizd a draft osszefoglalot. Adj minosegi es tenyszerusegi pontszamot 0-100 kozott. Sorold fel a hibakat es rovid javitasi javaslatokat. Utana keszits javitott, magyar nyelvu vegleges valtozatot. Csak a forrasszovegre tamaszkodhatsz. Ne adj hozza kulso tudast. A javitott valtozat legyen tomor, pontos, feladatok es utasitasok nelkul. Kizarolag ket hibatipust vizsgalj: (1) tenybeli tevedes vagy felreallitas, (2) olyan hiany, ahol a forrasban hangsulyos allitas kimaradt. Szinonima, atfogalmazas vagy stilusbeli kulonbseg onmagaban nem hiba. Ne minositsd hibakent, ha a jelentest helyesen adja vissza mas megfogalmazassal. Stilust, tipografiat, felkover kiemelest vagy szerkesztesi izlest ne minosits hibakent. Fontos: az improvementNotes elemei ne instrukciok legyenek, hanem KESZ, beillesztheto szovegdarabok. Ne irj olyat, hogy 'szurd be', 'emeld ki', 'ird at', 'foglald ossze'. Ehelyett konkret mondatokat/rovid bekezdeseket adj, amelyek azonnal beilleszthetok a summaryType-nak megfeleloen.",
      },
      {
        role: "user",
        content: `Lecke: ${input.lessonTitle}\nTipus: ${input.summaryType}\n\nForrasszoveg:\n${input.sourceText.slice(0, input.sourceTextLimit ?? 5000)}\n\nDraft:\n${input.draftContent.slice(0, input.draftContentLimit ?? 2200)}`,
      },
    ],
  });

  const parsed = JSON.parse(response.output_text) as Partial<SummaryReviewDraft>;

  return {
    mode: "openai" as const,
    review: {
      qualityScore: Number(parsed.qualityScore ?? 0),
      factualityScore: Number(parsed.factualityScore ?? 0),
      issues: Array.isArray(parsed.issues) ? parsed.issues.map((item) => item.trim()).filter(Boolean) : [],
      improvementNotes: Array.isArray(parsed.improvementNotes)
        ? parsed.improvementNotes.map((item) => item.trim()).filter(Boolean)
        : [],
      correctedContent: String(parsed.correctedContent ?? input.draftContent).trim(),
    } satisfies SummaryReviewDraft,
  };
}
