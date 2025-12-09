import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, ParsingResult, UserFinancialProfile } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION_PARSER = `
Eres un experto asistente financiero para una aplicación en Argentina llamada "Pesitos". Tu tarea es extraer detalles de transacciones a partir de texto natural.
Fecha Actual: ${new Date().toISOString()}
Moneda Predeterminada: ARS (Pesos Argentinos).
Interpreta fechas relativas (ej: "ayer", "el viernes pasado", "hace 3 días") basándote en la Fecha Actual.
Categoriza inteligentemente basándote en la descripción.

REGLA IMPORTANTE DE CATEGORÍAS:
1. Si la transacción es un INGRESO (cobro sueldo, venta, dinero recibido), la categoría principal DEBE SER SIEMPRE "Ingreso".
2. Si puedes detectar un tipo específico de ingreso (ej. "Sueldo", "Venta", "Freelance"), ponlo en el campo 'subcategory'.
3. Para GASTOS, usa categorías estándar como "Alimentación", "Transporte", "Servicios", etc.
`;

export const parseTransactionInput = async (input: string): Promise<ParsingResult> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Extrae los detalles de la transacción de este texto: "${input}"`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_PARSER,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["EXPENSE", "INCOME"] },
            category: { type: Type.STRING },
            subcategory: { type: Type.STRING },
            date: { type: Type.STRING, description: "ISO 8601 Date string" },
            description: { type: Type.STRING },
            paymentMethod: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["amount", "type", "category", "date", "description"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as ParsingResult;
    }
    throw new Error("No hubo respuesta de la IA");
  } catch (error) {
    console.error("Error analizando la transacción:", error);
    throw error;
  }
};

export const generateFinancialInsights = async (transactions: Transaction[]): Promise<any[]> => {
  if (transactions.length === 0) return [];

  const recentTransactions = transactions.slice(0, 50).map(t => 
    `${t.date}: ${t.type} de ${t.amount} ${t.currency} en ${t.category} (${t.description})`
  ).join("\n");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analiza estas transacciones financieras y proporciona 3 consejos breves y accionables en español (Argentina). Enfócate en hábitos de gasto, anomalías o oportunidades de ahorro. Datos: \n${recentTransactions}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["warning", "opportunity", "neutral"] }
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return [];
  } catch (error) {
    console.error("Error generando insights:", error);
    return [];
  }
};

export const generateFinancialProfile = async (transactions: Transaction[]): Promise<UserFinancialProfile | null> => {
  if (transactions.length < 5) return null;

  const history = transactions.slice(0, 100).map(t => 
    `${t.date}: ${t.type} $${t.amount} (${t.category})`
  ).join("\n");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Basado en este historial de transacciones, genera un perfil financiero divertido y útil para el usuario. 
      Define un "Arquetipo" (ej. "El Rey del Delivery", "Inversor Hormiga", "Ahorrador Serial"), una descripción, puntos fuertes y puntos débiles.
      Historial:
      ${history}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            personaTitle: { type: Type.STRING },
            description: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as UserFinancialProfile;
    }
    return null;
  } catch (error) {
    console.error("Error generando perfil:", error);
    return null;
  }
};