
import * as pdfjs from 'pdfjs-dist';
import { extractTextFromImage } from '../services/geminiService';


// Since mammoth is loaded via a script tag, it's a global. We declare it to satisfy TypeScript.
declare const mammoth: any;

// The worker is needed for pdf.js to run in a separate thread and not block the UI.
// We point to a CDN-hosted version of the worker file.
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

interface ParsedFileResult {
    content: string;
    pages?: number;
}

/**
 * Parses the content of a file and returns it as a string, along with page count if available.
 * Supports .txt, .pdf, and .docx files.
 * @param file The file to parse.
 * @param setLoadingMessage A callback to update the UI with loading progress.
 * @returns A promise that resolves with the extracted text content and optional page count.
 */
export const parseFile = async (file: File, setLoadingMessage: (message: string) => void): Promise<ParsedFileResult> => {
    const extension = file.name.split('.').pop()?.toLowerCase();

    switch (extension) {
        case 'txt':
            return parseTxt(file);
        case 'pdf':
            return parsePdf(file, setLoadingMessage);
        case 'docx':
            return parseDocx(file);
        case 'doc':
            // .doc is a legacy binary format that is difficult to parse in the browser.
            // Provide a clear error message to the user.
            throw new Error('.doc files are not supported. Please save the file as .docx and try again.');
        default:
            throw new Error(`Unsupported file type: .${extension}. Please use .txt, .pdf, or .docx.`);
    }
};

const parseTxt = (file: File): Promise<ParsedFileResult> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ content: e.target?.result as string });
        reader.onerror = () => reject(new Error('Failed to read the .txt file.'));
        reader.readAsText(file);
    });
};

const parsePdf = async (file: File, setLoadingMessage: (message: string) => void): Promise<ParsedFileResult> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument(arrayBuffer).promise;
        let textContent = '';
        
        setLoadingMessage('Analyzing PDF text content...');
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const text = await page.getTextContent();
            textContent += text.items.map(item => ('str' in item ? item.str : '')).join(' ') + '\n';
        }

        // Heuristic: If the extracted text is very short for a multi-page document,
        // it's likely a scanned PDF. A threshold of 150 characters is a reasonable guess.
        if (textContent.trim().length < 150 && pdf.numPages > 1) {
            textContent = ''; // Reset content to start OCR process
            setLoadingMessage('Detected scanned PDF. Starting image-based text extraction...');

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) {
                throw new Error("Could not create canvas context for PDF rendering.");
            }

            for (let i = 1; i <= pdf.numPages; i++) {
                setLoadingMessage(`Processing page ${i} of ${pdf.numPages}...`);
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR quality
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport: viewport }).promise;

                const imageBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
                if (imageBlob) {
                    const imageFile = new File([imageBlob], `page_${i}.jpg`, { type: 'image/jpeg' });
                    const pageText = await extractTextFromImage(imageFile);
                    textContent += pageText + '\n\n'; // Add newlines to separate page content
                }
            }
            canvas.remove();
        }

        if(!textContent.trim()){
             throw new Error("No text could be extracted from the PDF. It might be empty or in an unsupported format.");
        }


        return { content: textContent, pages: pdf.numPages };
    } catch (error) {
        console.error("Error parsing PDF:", error);
        const errorMessage = (error instanceof Error) ? error.message : "An unknown error occurred.";
        throw new Error(`Failed to parse the PDF file. It may be corrupted, password-protected, or contain unreadable scanned text. Details: ${errorMessage}`);
    }
};

const parseDocx = async (file: File): Promise<ParsedFileResult> => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        // mammoth.js extracts raw text content from the .docx file.
        const result = await mammoth.extractRawText({ arrayBuffer });

        if(!result.value.trim()){
            throw new Error("No text could be extracted from the DOCX file. If it contains scanned images, please convert it to a PDF first for better results.");
        }

        return { content: result.value };
    } catch (error) {
        console.error("Error parsing DOCX:", error);
        throw new Error("Failed to parse the .docx file. It may be corrupted.");
    }
};
