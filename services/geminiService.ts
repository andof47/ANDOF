
import { GoogleGenAI, Modality, ThinkingLevel } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Helper function to convert a File object to a base64 string
const fileToGenerativePart = (file: File): Promise<{inlineData: {data: string, mimeType: string}}> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                const base64Data = reader.result.split(',')[1];
                resolve({
                    inlineData: {
                        data: base64Data,
                        mimeType: file.type,
                    },
                });
            } else {
                reject(new Error("Failed to read file as data URL."));
            }
        };
        reader.onerror = (error) => reject(error);
    });
};

export const generateSpeech = async (text: string, voiceName: string, language: string): Promise<string> => {
    if (!text || !text.trim()) {
        throw new Error("Cannot generate speech for empty text.");
    }

    try {
        // We send only the pure text. The voiceName in config is the source of truth for the voice.
        // Adding prefixes can cause the model to change its tone or persona between chunks.
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("The model did not return audio data. The text might be too long or complex.");
        return base64Audio;
    } catch (error) {
        const detailedMessage = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`TTS Error: ${detailedMessage}`);
    }
};

export const generateSummary = async (text: string, targetLanguage: string): Promise<string> => {
    try {
        const languageInstruction = targetLanguage === 'Original' 
            ? "the same language as the source text" 
            : targetLanguage;

        const prompt = `You are an expert content summarizer.
        Target Language: ${languageInstruction}
        
        Instructions:
        1. Analyze the provided text deeply.
        2. Create a structured executive summary in ${languageInstruction}.
        3. Identify key points, author's tone, and main conclusions.
        4. If the target language is "the same language as the source text", detect the language of the input and use it for the summary.
        
        Text to summarize:
        ${text}`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', // Upgraded to Flash 3 for speed and fluidity
            contents: prompt,
            config: {
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, // Low thinking level for faster response in summaries
                tools: [{ googleSearch: {} }]
            }
        });
        return response.text || "Não foi possível gerar o resumo.";
    } catch (error) {
        console.error("Summary error:", error);
        throw new Error(`Erro no resumo: ${error instanceof Error ? error.message : "Falha na API"}`);
    }
};

export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
    if (targetLanguage === 'Original') return text;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', // Ultra-fast translation
            contents: `You are a professional translator. 
            Target Language: ${targetLanguage}
            
            Instructions:
            1. Translate the following text to ${targetLanguage}.
            2. If the text is already in ${targetLanguage}, return it exactly as it is.
            3. Maintain the original tone, formatting, and technical terms.
            4. Return ONLY the translated text. No meta-talk.
            
            Text:
            ${text}`,
            config: {
                thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } // Minimal thinking for maximum speed in translation
            }
        });
        return response.text.trim() || text;
    } catch (error) {
        console.error("Translation error:", error);
        return text;
    }
}

export const extractTextFromImage = async (imageFile: File): Promise<string> => {
    try {
        const imagePart = await fileToGenerativePart(imageFile);
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', // Superior vision capabilities
            contents: { parts: [imagePart, { text: "Extract all text from this image accurately. Maintain the layout if possible. Return ONLY the extracted text." }] },
            config: {
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
            }
        });
        return response.text || "";
    } catch (error) {
        throw new Error("Erro no OCR da imagem.");
    }
};

export const fetchArticleContent = async (url: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Acesse e extraia o conteúdo principal deste artigo (ignore menus/anúncios): ${url}`,
            config: {
                tools: [{ googleSearch: {} }] // Usa a busca para garantir que pega o conteúdo mais atual/correto
            }
        });
        return response.text || "";
    } catch (error) {
        throw new Error("Erro ao acessar URL.");
    }
};
